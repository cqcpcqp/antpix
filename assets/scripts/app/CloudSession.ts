import { sys } from 'cc';
import { todayKey } from '../domain/profile/profile';
import type { CloudState } from '../platform/wechat/cloudGame';
import {
    CloudGame,
    CloudGameError,
    wechatAvailable,
    wechatTransport,
} from '../platform/wechat/cloudGame';
import { showRewardedVideo } from '../platform/wechat/rewardAd';
import type { GardenRuntime } from './GardenRuntime';
import { GREEN, PAPER } from '../presentation/gameVisuals';

/** Coordinates cloud requests and explicit, isolated local/cloud play sessions. */
export class CloudSession {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'startup'
            | 'profile'
            | 'home'
            | 'cloudStatus'
            | 'host'
            | 'overlays'
            | 'ui'
            | 'session'
            | 'notices'
        >,
    ) {}
    rewardDay() {
        if (!this.cloudMode) return todayKey();
        const date = new Date(Date.now() + this.serverOffset + 8 * 3600000);
        return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    }

    initializeMode() {
        try {
            if (sys.localStorage.getItem('ant-play-mode') === 'local') this.cloudMode = false;
        } catch {
            // Mode selection still works for this session when device storage is unavailable.
        }
    }

    private rememberMode(mode: 'local' | 'cloud') {
        try {
            sys.localStorage.setItem('ant-play-mode', mode);
        } catch {
            console.warn('本机存储不可用');
        }
    }

    enterOffline() {
        if (!this.cloudMode) return;
        // Invalidate all callbacks before changing profiles; pending writes remain for cloud replay.
        this.cloudRequest++;
        this.requestTimeout = null;
        this.cloudMode = false;
        this.cloudReady = false;
        this.cloudBusy = false;
        this.cloudCancellable = false;
        this.cloudRetry = null;
        this.cloudMessage = '';
        this.offlineAvailable = false;
        this.cloudRunId = '';
        this.cloud = null;
        this.rememberMode('local');
        this.game.session.won = true;
        this.game.session.pendingVictory = false;
        this.game.profile.readSave();
        this.game.home.showHome();
        this.game.startup.refresh();
        this.game.notices.notify('已进入离线模式', '进度仅保存在本机，可在设置中切换云存档');
    }

    useCloud() {
        if (this.cloudMode || !wechatAvailable()) return;
        this.game.profile.persist();
        this.cloudMode = true;
        this.cloudReady = false;
        this.game.session.won = true;
        this.game.session.pendingVictory = false;
        this.game.profile.readSave();
        this.game.home.showHome();
        this.connectCloud();
    }

    update(dt: number) {
        if (!this.cloudBusy || !this.requestTimeout) return;
        this.requestElapsed += dt;
        if (this.requestElapsed >= 8) this.requestTimeout();
    }

    connectCloud() {
        this.cloudTask(
            async () => {
                if (!this.cloud) this.cloud = new CloudGame(wechatTransport(), sys.localStorage);
                return this.cloud.login();
            },
            (state) => {
                this.applyCloudState(state);
                this.cloudReady = true;
                this.rememberMode('cloud');
                this.game.profile.save.selected = this.game.profile.save.unlocked;
                if (this.game.startup.active) this.game.startup.refresh();
                else this.game.home.showHome(true);
            },
            '正在同步进度…',
            false,
            true,
        );
    }

    applyCloudState(state: CloudState) {
        const { sound, music } = this.game.profile.save;
        this.game.profile.save = state.profile;
        this.game.profile.save.sound = sound;
        this.game.profile.save.music = music;
        this.cloudHighest = state.highest;
        this.cloudReachedAt = state.reachedAt;
        this.serverOffset = state.serverTime - Date.now();
        this.game.profile.persist();
    }

    cloudTask<T>(
        task: () => Promise<T>,
        complete: (result: T) => void,
        message: string,
        cancellable = false,
        offlineOnFailure = false,
    ) {
        if (this.cloudBusy) return;
        this.cloudBusy = true;
        this.cloudCancellable = cancellable;
        const request = ++this.cloudRequest;
        let inFlight = false;
        let attemptId = 0;
        const attempt = () => {
            if (inFlight || request !== this.cloudRequest) return;
            inFlight = true;
            const currentAttempt = ++attemptId;
            const active = () =>
                this.game.host.isValid &&
                request === this.cloudRequest &&
                currentAttempt === attemptId;
            this.cloudBusy = true;
            this.cloudRetry = null;
            this.offlineAvailable = false;
            this.cloudMessage = message;
            this.requestElapsed = 0;
            const failed = (error: unknown) => {
                if (!active()) return;
                attemptId++;
                this.requestTimeout = null;
                inFlight = false;
                const rejected = error instanceof CloudGameError;
                if (!rejected && offlineOnFailure) {
                    this.enterOffline();
                    return;
                }
                console.error('Cloud game request failed', error);
                this.offlineAvailable = !rejected;
                if (
                    rejected &&
                    this.cloudReady &&
                    error.code !== 'LOGIN' &&
                    error.code !== 'VERSION'
                )
                    this.cloudBusy = false;
                if (rejected && error.code === 'SESSION') {
                    this.cloudRunId = '';
                    this.cloudRetry = null;
                    this.cloudMessage = '';
                    const n = this.game.overlays.openModal('需要重新开始', error.message, 440);
                    this.game.ui.button(n, '返回主页', -142, -105, 240, 70, PAPER, () =>
                        this.game.home.showHome(),
                    );
                    this.game.ui.button(n, '重新开始', 142, -105, 240, 70, GREEN, () =>
                        this.game.session.startLevel(this.game.profile.save.selected),
                    );
                    return;
                }
                this.cloudMessage = rejected
                    ? `${error.message} · 点击重试`
                    : '连接未完成，点击重试';
                this.cloudRetry = attempt;
                this.game.cloudStatus.refreshCloudStatus();
            };
            this.requestTimeout = () => {
                failed(new Error('Cloud request timed out'));
                if (this.cloudMode && this.cloudRetry) {
                    // Reconnect through login to resolve any persisted write before new actions.
                    this.cloudRetry = () => {
                        this.cloudBusy = false;
                        this.cloud = null;
                        this.connectCloud();
                    };
                }
            };
            this.game.cloudStatus.refreshCloudStatus();
            // The executor also captures synchronous SDK/storage failures.
            new Promise<T>((resolve) => resolve(task()))
                .then((result) => {
                    if (!active()) return;
                    this.requestTimeout = null;
                    this.cloudBusy = false;
                    this.cloudCancellable = false;
                    this.cloudMessage = '';
                    this.game.cloudStatus.refreshCloudStatus();
                    complete(result);
                })
                .catch(failed);
        };
        attempt();
    }

    claimCloudRewards() {
        if (!this.cloudReady) return;
        const view = this.game.overlays.modal;
        this.cloudTask(
            () => this.cloud!.mutate('claim'),
            (state) => {
                this.applyCloudState(state);
                if (this.game.overlays.modal === view) this.game.home.showHome();
                else if (this.game.home.home) this.game.home.showHome(true);
                this.game.notices.notify(
                    '奖励已收下',
                    `${state.output.amount!} 金币已经放进你的小窝`,
                    'success',
                );
            },
            '正在领取奖励…',
        );
    }

    watchCloudAd(placement: 'speed' | 'slot', complete: () => void) {
        this.cloudTask(
            () => this.cloud!.mutate('adStart', { runId: this.cloudRunId, placement }),
            (state) => {
                this.game.overlays.openModal('准备中', '', 360);
                const request = this.cloudRequest;
                showRewardedVideo().then((ok) => {
                    if (!this.game.host.isValid || !this.cloudMode || request !== this.cloudRequest)
                        return;
                    this.game.overlays.closeModal();
                    if (!ok) {
                        this.game.notices.notify('未能完成', '请重试', 'warning');
                        return;
                    }
                    this.cloudTask(
                        () => this.cloud!.mutate('adComplete', { adId: state.output.adId! }),
                        (result) => {
                            this.applyCloudState(result);
                            complete();
                        },
                        '正在确认…',
                    );
                });
            },
            '正在准备…',
        );
    }

    private requestTimeout: (() => void) | null = null;
    private requestElapsed = 0;
    offlineAvailable = false;

    cloudMode = wechatAvailable();

    cloud: CloudGame | null = null;

    cloudBusy = false;

    cloudReady = false;

    cloudRequest = 0;

    cloudMessage = '';

    cloudRetry: (() => void) | null = null;

    cloudCancellable = false;

    cloudRunId = '';

    cloudHighest = -1;

    cloudReachedAt = 0;

    serverOffset = 0;
}
