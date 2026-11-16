import { Node, view } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import type {
    IdentityButton,
    IdentityPermission,
    PlayerIdentity,
} from '../../platform/wechat/playerIdentity';
import {
    authorizePrivacy,
    createIdentityButton,
    identityPermission,
    openIdentitySettings,
    privacyRequired,
    readIdentity,
} from '../../platform/wechat/playerIdentity';

/** Owns the native ranking entry; authorization belongs to WeChat, never account age. */
export class LeaderboardIdentity {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'cloud' | 'home' | 'lifecycle' | 'overlays' | 'notices' | 'social' | 'host' | 'startup'
        >,
    ) {}
    private entry: Node | null = null;
    private button: IdentityButton | null = null;
    private generation = 0;
    private needsPrivacy = true;
    private privacyPending = false;
    private ready = false;
    private preparing = false;
    private permission: IdentityPermission | 'checking' | 'error' = 'checking';
    private suppliedIdentity: PlayerIdentity | null = null;
    private nativeError: Error | null = null;
    private visible = false;
    private board: Node | null = null;
    private page = 0;
    private buttonBoard: Node | null = null;
    authorized = false;

    get settingsAvailable() {
        return this.permission === false;
    }

    // Native dialogs can background the game. Preserve their button and callbacks on resume.
    get retainEntry() {
        return this.button !== null || this.privacyPending;
    }

    attach(entry: Node) {
        this.detach();
        if (!this.game.cloud.cloudMode) return;
        this.entry = entry;
        const generation = this.generation;
        entry.on(Node.EventType.NODE_DESTROYED, () => {
            if (this.entry === entry) this.detach();
        });
        void this.prepare(generation);
    }
    detach() {
        this.generation++;
        this.entry = null;
        this.ready = false;
        this.preparing = false;
        this.permission = 'checking';
        this.suppliedIdentity = null;
        this.nativeError = null;
        this.privacyPending = false;
        this.buttonBoard = null;
        this.board = null;
        this.hide();
        this.button?.destroy();
        this.button = null;
    }
    hide() {
        this.button?.hide();
        this.visible = false;
    }
    private async prepare(generation: number) {
        if (this.preparing) return;
        this.preparing = true;
        try {
            const [permission, needsPrivacy] = await Promise.all([
                identityPermission(),
                privacyRequired(),
            ]);
            if (generation !== this.generation || !this.game.host.isValid) return;
            this.permission = permission;
            this.needsPrivacy = needsPrivacy;
            this.authorized = permission === true && !needsPrivacy;
            this.hide();
            this.button?.destroy();
            this.button = null;
            if (permission === undefined && !needsPrivacy) {
                this.installButton(220, -this.game.lifecycle.screenHeight / 2 + 145, 144, 138);
            }
            this.ready = true;
            this.update();
            this.trace('prepared');
        } catch (error) {
            if (generation === this.generation && this.game.host.isValid) {
                this.permission = 'error';
                this.ready = true;
                this.report(error);
            }
        } finally {
            if (generation === this.generation) this.preparing = false;
        }
    }
    /** Both targets use centred logical canvas coordinates, converted to WeChat CSS pixels. */
    private installButton(
        x: number,
        y: number,
        width: number,
        height: number,
        board: Node | null = null,
    ) {
        this.hide();
        this.button?.destroy();
        this.buttonBoard = board;
        const generation = this.generation;
        const frame = view.getFrameSize();
        const scale = frame.width / this.game.lifecycle.screenWidth;
        this.button = createIdentityButton(
            {
                left: frame.width / 2 + (x - width / 2) * scale,
                top: frame.height / 2 - (y + height / 2) * scale,
                width: width * scale,
                height: height * scale,
            },
            (identity, error) => {
                if (
                    generation !== this.generation ||
                    !this.entry?.isValid ||
                    !this.game.host.isValid ||
                    (board
                        ? this.game.overlays.modal !== board || !board.isValid
                        : !!this.game.overlays.modal)
                )
                    return;
                this.suppliedIdentity = identity;
                this.nativeError = error;
                if (identity) this.permission = true;
                this.trace('native-tap', { granted: identity !== null });
                this.button?.destroy();
                this.button = null;
                this.buttonBoard = null;
                this.game.social.worldLeaderboard(board ? this.page : 0);
            },
        );
        this.button.hide();
    }
    get consentAvailable() {
        return this.permission === undefined && !this.needsPrivacy;
    }
    offerConsent(board: Node, y: number) {
        if (!this.consentAvailable || this.game.overlays.modal !== board) return;
        this.installButton(0, y, 360, 60, board);
        this.update();
    }
    private eligible() {
        return (
            !!this.entry?.isValid &&
            !!this.game.home.home?.active &&
            (this.buttonBoard
                ? this.game.overlays.modal === this.buttonBoard && this.buttonBoard.isValid
                : !this.game.overlays.modal) &&
            !this.game.lifecycle.paused &&
            !this.game.startup.active &&
            this.game.cloud.cloudMode &&
            this.game.cloud.cloudReady &&
            !this.game.cloud.cloudBusy
        );
    }
    update() {
        // closeModal clears ownership before Cocos flushes deferred node destruction.
        if (this.board && (this.game.overlays.modal !== this.board || !this.board.isValid)) {
            this.releaseBoard();
        }
        // Notifications live at the top. Hiding this bottom trigger while leaving the
        // canvas tile clickable made the privacy-success toast bypass native consent.
        const visible = this.ready && this.eligible();
        if (visible === this.visible) return;
        this.visible = visible;
        if (visible) this.button?.show();
        else this.button?.hide();
    }
    open() {
        if (!this.game.cloud.cloudMode) {
            this.game.social.leaderboard();
            return;
        }
        if (!this.game.cloud.cloudReady || this.game.cloud.cloudBusy || this.privacyPending) return;
        this.trace('canvas-tap');
        if (!this.ready) {
            void this.prepare(this.generation);
            this.game.notices.notify('正在准备微信授权', '请再次点击排行榜');
            return;
        }
        if (this.permission === 'error') {
            this.game.social.worldLeaderboard(0);
            return;
        }
        if (this.needsPrivacy) {
            const generation = this.generation;
            this.privacyPending = true;
            authorizePrivacy().then(
                () => {
                    if (generation !== this.generation || !this.entry?.isValid) return;
                    this.privacyPending = false;
                    this.needsPrivacy = false;
                    this.game.social.worldLeaderboard(0);
                },
                (error) => {
                    if (generation !== this.generation) return;
                    this.privacyPending = false;
                    this.report(error);
                    this.game.social.worldLeaderboard(0);
                },
            );
            return;
        }
        if (this.permission === undefined) {
            // Canvas touch forwarding must not open the board before native onTap.
            if (!this.button) {
                this.ready = false;
                void this.prepare(this.generation);
                this.game.notices.notify('正在准备微信授权', '请再次点击排行榜');
            } else this.update();
            return;
        }
        this.game.social.worldLeaderboard(0);
    }
    boardOpened(board: Node, page: number) {
        this.hide();
        this.button?.destroy();
        this.button = null;
        this.buttonBoard = null;
        this.board = board;
        this.page = page;
        board.on(Node.EventType.NODE_DESTROYED, () => {
            if (this.board !== board) return;
            this.releaseBoard();
        });
    }
    private releaseBoard() {
        this.board = null;
        this.hide();
        this.button?.destroy();
        this.button = null;
        this.buttonBoard = null;
        if (this.entry?.isValid && this.game.host.isValid) void this.prepare(this.generation);
    }
    /** Finish consent reconciliation before the cancellable ranking read. */
    async synchronize() {
        const cloud = this.game.cloud.cloud!;
        const request = this.game.cloud.cloudRequest;
        const active = () =>
            this.game.host.isValid &&
            cloud === this.game.cloud.cloud &&
            request === this.game.cloud.cloudRequest &&
            this.game.cloud.cloudMode;
        let identity = this.suppliedIdentity;
        this.suppliedIdentity = null;
        const nativeError = this.nativeError;
        this.nativeError = null;
        let permission: IdentityPermission = identity ? true : undefined;
        let needsPrivacy = false;
        try {
            if (!identity) {
                [permission, needsPrivacy] = await Promise.all([
                    identityPermission(),
                    privacyRequired(),
                ]);
                if (permission === true && !needsPrivacy) identity = await readIdentity();
            }
        } catch (error) {
            if (active()) {
                this.permission = 'error';
                this.authorized = false;
                this.report(error);
            }
            // SDK failures do not establish refusal and must not clear public data.
            return;
        }
        if (!active()) return;
        this.permission = permission;
        this.needsPrivacy = needsPrivacy;
        this.authorized = identity !== null;
        this.trace('synchronize');
        if (nativeError && permission !== false) this.report(nativeError);
        await cloud.mutate('identity', {
            consentVersion: 1,
            nickname: identity === null ? null : identity.nickname,
            avatarUrl: identity === null ? null : identity.avatarUrl,
        });
    }
    settings() {
        if (this.game.cloud.cloudBusy) return;
        const board = this.board;
        // openSetting must run in the click, before any promise continuation.
        openIdentitySettings().then(
            () => {
                if (board?.isValid && this.game.overlays.modal === board)
                    this.game.social.worldLeaderboard(this.page);
            },
            (error) => this.report(error),
        );
    }
    private trace(stage: string, details: Record<string, boolean> = {}) {
        // Diagnose native hit delivery on device without logging names or avatar URLs.
        console.info('WeChat identity flow', {
            stage,
            permission: this.permission === undefined ? 'first' : this.permission,
            needsPrivacy: this.needsPrivacy,
            nativeVisible: this.visible && !!this.button,
            ...details,
        });
    }
    private report(error: unknown) {
        if (!this.game.host.isValid) return;
        console.warn('WeChat identity unavailable', error);
        this.game.notices.notify('微信资料未完成', '请重试', 'warning');
    }
}
