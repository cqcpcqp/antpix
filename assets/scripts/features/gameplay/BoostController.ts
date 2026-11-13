import { Label } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { INK, PAPER } from '../../presentation/gameVisuals';
import { rewardedVideoConfigured, showRewardedVideo } from '../../platform/wechat/rewardAd';
import { EXPANSION_COLUMNS, EXTRA_SLOT_Y, queueColumnX } from '../../presentation/boardLayout';

/** Coordinates rewarded speed and extra-slot actions. */
export class BoostController {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'session'
            | 'cloud'
            | 'layout'
            | 'overlays'
            | 'ui'
            | 'notices'
            | 'host'
            | 'dispatch'
            | 'containers'
        >,
    ) {}
    requestSpeed() {
        if (this.game.session.won || this.rewardAdDemo || this.game.cloud.cloudBusy) return;
        if (this.game.session.model.finishing) {
            this.game.session.updateFinishing();
            return;
        }
        if (this.game.session.speedUnlocked) {
            this.game.session.speed = this.game.session.speed === 1 ? 2 : 1;
            this.game.layout.speedLabel.string = `${this.game.session.speed}×`;
            return;
        }
        if (this.offlineAdUnavailable()) return;
        const n = this.game.overlays.openModal('开启二倍速', '', 360);
        const status = this.game.ui.text(
            n,
            rewardedVideoConfigured() ? '准备中…' : '3',
            0,
            0,
            48,
            INK,
            520,
        );
        this.game.ui.button(n, '取消', 0, -115, 300, 64, PAPER, () =>
            this.game.overlays.closeModal(),
        );
        const complete = () => {
            this.game.session.speedUnlocked = true;
            this.game.session.speed = 2;
            this.game.layout.speedLabel.string = '2×';
            this.game.notices.notify('二倍速已开启', '蚂蚁会更快完成搬运', 'success');
        };
        if (rewardedVideoConfigured()) {
            if (this.game.cloud.cloudMode) {
                this.game.cloud.watchCloudAd('speed', complete);
                return;
            }
            showRewardedVideo().then((ok) => {
                if (!this.game.host.isValid || this.game.overlays.modal !== n) return;
                this.game.overlays.closeModal();
                if (ok) complete();
                else this.game.notices.notify('未能开启', '请重试开启二倍速', 'warning');
            });
            return;
        }
        this.rewardAdDemo = { remaining: 3, label: status, complete };
    }

    private offlineAdUnavailable() {
        if (this.game.cloud.cloudMode || !rewardedVideoConfigured()) return false;
        this.game.notices.notify('广告暂不可用', '请联网后使用云存档再观看广告', 'info');
        return true;
    }

    updateExpansionBoard() {
        const expanded = this.game.session.model.slots.length - 5;
        this.game.layout.expansionBoard.active = expanded < EXPANSION_COLUMNS.length;
        if (this.game.layout.expansionBoard.active)
            this.game.layout.expansionBoard.setPosition(
                queueColumnX(EXPANSION_COLUMNS[expanded]),
                EXTRA_SLOT_Y,
            );
    }

    requestSlotExpansion() {
        if (
            this.game.session.model.slots.length >= 5 + EXPANSION_COLUMNS.length ||
            this.game.session.won ||
            this.rewardAdDemo ||
            this.game.cloud.cloudBusy
        )
            return;
        if (this.offlineAdUnavailable()) return;
        const n = this.game.overlays.openModal('扩展收集槽位', '', 360);
        const status = this.game.ui.text(
            n,
            rewardedVideoConfigured() ? '准备中…' : '3',
            0,
            0,
            48,
            INK,
            520,
        );
        this.game.ui.button(n, '取消', 0, -115, 300, 64, PAPER, () =>
            this.game.overlays.closeModal(),
        );
        const complete = () => {
            this.game.session.model.slots.push(null);
            this.game.dispatch.dispatchClocks[this.game.session.model.slots.length - 1] = 0;
            this.game.dispatch.dispatchJarIds[this.game.session.model.slots.length - 1] = -1;
            this.game.containers.drawSlots();
            this.updateExpansionBoard();
            this.game.notices.notify(
                '收集槽已扩展',
                `现在可以同时容纳 ${this.game.session.model.slots.length} 个容器`,
                'success',
            );
        };
        if (rewardedVideoConfigured()) {
            if (this.game.cloud.cloudMode) {
                this.game.cloud.watchCloudAd('slot', complete);
                return;
            }
            showRewardedVideo().then((ok) => {
                if (!this.game.host.isValid || this.game.overlays.modal !== n) return;
                this.game.overlays.closeModal();
                if (ok) complete();
                else this.game.notices.notify('未能扩展', '请重试扩展槽位', 'warning');
            });
            return;
        }
        this.rewardAdDemo = { remaining: 3, label: status, complete };
    }

    rewardAdDemo: { remaining: number; label: Label; complete: () => void } | null = null;
}
