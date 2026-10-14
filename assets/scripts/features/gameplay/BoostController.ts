import { Label } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { INK, MUTED, PAPER } from '../../presentation/gameVisuals';
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
        const n = this.game.overlays.openModal(
            '开启二倍速',
            '观看完整广告后，蚂蚁会以二倍速度工作',
            420,
        );
        const status = this.game.ui.text(
            n,
            rewardedVideoConfigured() ? '广告准备中…' : '测试广告 3 秒',
            0,
            45,
            28,
            INK,
            520,
        );
        this.game.ui.text(
            n,
            rewardedVideoConfigured() ? '完整观看视频即可获得' : '当前为测试演示，不会播放真实广告',
            0,
            0,
            24,
            MUTED,
            560,
        );
        this.game.ui.text(n, '仅本关生效 · 取消不会消耗任何物品', 0, -52, 23, MUTED, 560);
        this.game.ui.button(n, '取消', 0, -145, 300, 64, PAPER, () =>
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
                else this.game.notices.notify('广告未完成', '看完广告后才能开启二倍速', 'warning');
            });
            return;
        }
        this.rewardAdDemo = { remaining: 3, label: status, complete };
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
        const n = this.game.overlays.openModal(
            '扩展收集槽位',
            '观看完整广告后增加一个容器位置',
            420,
        );
        const status = this.game.ui.text(
            n,
            rewardedVideoConfigured() ? '广告准备中…' : '测试广告 3 秒',
            0,
            45,
            28,
            INK,
            520,
        );
        this.game.ui.text(
            n,
            rewardedVideoConfigured() ? '完整观看视频即可获得' : '当前为测试演示，不会播放真实广告',
            0,
            0,
            24,
            MUTED,
            560,
        );
        this.game.ui.text(n, '仅本关生效 · 新槽位会出现在托盘上方', 0, -52, 23, MUTED, 560);
        this.game.ui.button(n, '取消', 0, -145, 300, 64, PAPER, () =>
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
                else this.game.notices.notify('广告未完成', '看完广告后才能扩展槽位', 'warning');
            });
            return;
        }
        this.rewardAdDemo = { remaining: 3, label: status, complete };
    }

    rewardAdDemo: { remaining: number; label: Label; complete: () => void } | null = null;
}
