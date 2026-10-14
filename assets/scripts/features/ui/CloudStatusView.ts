import { Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { INK, MUTED } from '../../presentation/gameVisuals';

/** Displays cloud progress and retry actions in the active screen. */
export class CloudStatusView {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'layout' | 'cloud' | 'home' | 'overlays' | 'lifecycle' | 'ui'
        >,
    ) {}
    refreshCloudStatus() {
        if (this.cloudStatus) {
            this.cloudStatus.active = false;
            this.cloudStatus.destroy();
            this.cloudStatus = null;
        }
        if (this.game.layout.queueCount)
            this.game.layout.queueCount.node.active =
                (!this.game.cloud.cloudBusy && !this.game.cloud.cloudMessage) ||
                !!this.game.home.home ||
                !!this.game.overlays.modal;
        if (this.game.home.homePlayLabel)
            this.game.home.homePlayLabel.node.active =
                !!this.game.overlays.modal ||
                this.game.cloud.cloudReady ||
                !this.game.cloud.cloudMode;
        if (this.game.home.homeRewardButton)
            this.game.home.homeRewardButton.active =
                !this.game.cloud.cloudBusy && !this.game.cloud.cloudMessage;
        if (this.game.overlays.drawerSubtitle)
            this.game.overlays.drawerSubtitle.node.active =
                !this.game.cloud.cloudBusy && !this.game.cloud.cloudMessage;
        if (!this.game.cloud.cloudBusy && !this.game.cloud.cloudMessage) return;
        const parent =
            this.game.overlays.drawerSheet ??
            this.game.overlays.modal ??
            this.game.home.home ??
            this.game.lifecycle.gameRoot;
        const inGame = parent === this.game.lifecycle.gameRoot;
        const homeLogin = parent === this.game.home.home && !this.game.cloud.cloudReady;
        const y = this.game.overlays.drawerSubtitle
            ? this.game.overlays.drawerSubtitle.node.position.y
            : this.game.overlays.modal
              ? this.game.overlays.modalStatusY
              : this.game.home.home
                ? homeLogin
                    ? -233
                    : -585
                : 670;
        const width = inGame ? 300 : homeLogin || this.game.overlays.drawerSheet ? 500 : 610;
        const n = this.game.ui.node2d(
            'Cloud status',
            parent,
            inGame ? 170 : 0,
            y,
            width,
            this.game.lifecycle.touchSize,
        );
        this.cloudStatus = n;
        this.game.ui.text(
            n,
            this.game.cloud.cloudMessage,
            0,
            0,
            homeLogin ? 28 : 22,
            homeLogin ? INK : MUTED,
            width,
        );
        n.on(Node.EventType.TOUCH_END, () => this.game.cloud.cloudRetry?.());
    }

    cloudStatus: Node | null = null;
}
