import { sys } from 'cc';
import { todayKey } from '../domain/profile/profile';
import type { CloudState } from '../platform/wechat/cloudGame';
import {
    CloudGame,
    CloudGameError,
    wechatAvailable,
    wechatTransport,
} from '../platform/wechat/cloudGame';
import { syncFriendScore } from '../platform/wechat/friendBoard';
import { showRewardedVideo } from '../platform/wechat/rewardAd';
import type { GardenRuntime } from './GardenRuntime';
import { GREEN, PAPER } from '../presentation/gameVisuals';

/** Coordinates cloud requests, retries and authoritative profile updates. */
export class CloudSession {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'profile' | 'home' | 'cloudStatus' | 'host' | 'overlays' | 'ui' | 'session' | 'notices'
        >,
    ) {}
    rewardDay() {
        if (!this.cloudMode) return todayKey();
        const date = new Date(Date.now() + this.serverOffset + 8 * 3600000);
        return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
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
                this.game.profile.save.selected = this.game.profile.save.unlocked;
                this.game.home.showHome(true);
            },
            '正在同步进度…',
        );
    }

    applyCloudState(state: CloudState) {
        const { sound, music } = this.game.profile.save;
        this.game.profile.save = state.profile;
        this.game.profile.save.sound = sound;
        this.game.profile.save.music = music;
        if (state.highest !== this.cloudHighest || state.reachedAt !== this.cloudReachedAt)
            syncFriendScore(state.highest, state.reachedAt).catch((error) =>
                console.warn('Friend score sync failed; retry when opening friends', error),
            );
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
    ) {
        if (this.cloudBusy) return;
        this.cloudBusy = true;
        this.cloudCancellable = cancellable;
        const request = ++this.cloudRequest;
        let inFlight = false;
        const attempt = () => {
            if (inFlight || request !== this.cloudRequest) return;
            inFlight = true;
            this.cloudBusy = true;
            this.cloudRetry = null;
            this.cloudMessage = message;
            this.game.cloudStatus.refreshCloudStatus();
            task()
                .then((result) => {
                    if (!this.game.host.isValid || request !== this.cloudRequest) return;
                    this.cloudBusy = false;
                    this.cloudCancellable = false;
                    this.cloudMessage = '';
                    this.game.cloudStatus.refreshCloudStatus();
                    complete(result);
                })
                .catch((error) => {
                    if (!this.game.host.isValid || request !== this.cloudRequest) return;
                    console.error('Cloud game request failed', error);
                    inFlight = false;
                    const rejected = error instanceof CloudGameError;
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
                });
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
                this.game.overlays.openModal('广告准备中', '完整观看视频即可获得', 360);
                showRewardedVideo().then((ok) => {
                    if (!this.game.host.isValid) return;
                    this.game.overlays.closeModal();
                    if (!ok) {
                        this.game.notices.notify('广告未完成', '看完广告后才能获得奖励', 'warning');
                        return;
                    }
                    this.cloudTask(
                        () => this.cloud!.mutate('adComplete', { adId: state.output.adId! }),
                        (result) => {
                            this.applyCloudState(result);
                            complete();
                        },
                        '正在确认广告奖励…',
                    );
                });
            },
            '正在准备广告…',
        );
    }

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
