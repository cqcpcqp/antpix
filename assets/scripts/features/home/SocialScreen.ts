import { SubContextView } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import { makeLevel } from '../../domain/levels/levels';
import { claimRewards, rewardAmount } from '../../domain/profile/profile';
import {
    authorizeFriends,
    changeFriendPage,
    showFriendPage,
    syncFriendScore,
} from '../../platform/wechat/friendBoard';

/** Displays rewards and leaderboards via existing platform adapters. */
export class SocialScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'cloud' | 'profile' | 'lifecycle' | 'overlays' | 'ui' | 'home' | 'notices'
        >,
    ) {}
    leaderboard(page = 0) {
        if (this.game.cloud.cloudMode) {
            this.worldLeaderboard(page);
            return;
        }
        const records = [...this.game.profile.save.best].sort((a, b) => a.seconds - b.seconds);
        const gap = Math.max(100, this.game.lifecycle.touchSize + 4);
        const n = this.game.overlays.openModal(
            '排行榜',
            '本机速通榜 · 按每关最佳用时排序',
            760 + 2 * (gap - 100),
        );
        if (!records.length) {
            this.game.ui.text(n, '还没有通关成绩', 0, 80, 30);
            this.game.ui.text(n, '完成一幅作品后，成绩会记录在这里', 0, 28, 23, MUTED);
        }
        records
            .slice(page * 6, page * 6 + 6)
            .forEach((r, i) =>
                this.game.ui.text(
                    n,
                    `${page * 6 + i + 1}.  ${makeLevel(r.level).name}    ${Math.floor(r.seconds / 60)}分${Math.floor(r.seconds % 60)}秒`,
                    0,
                    165 - i * 61,
                    25,
                    INK,
                    550,
                ),
            );
        if (page > 0)
            this.game.ui.button(n, '上一页', -190, -205, 150, 48, PAPER, () =>
                this.leaderboard(page - 1),
            );
        if ((page + 1) * 6 < records.length)
            this.game.ui.button(n, '下一页', 190, -205, 150, 48, PAPER, () =>
                this.leaderboard(page + 1),
            );
        this.game.ui.text(n, '仅展示本机真实记录，未接入联网排名', 0, -252, 21, MUTED);
        this.game.ui.button(
            n,
            '返回',
            0,
            -205 - gap,
            480,
            64,
            GREEN,
            () => this.game.overlays.closeModal(),
            '#FFFFFF',
        );
    }

    rewards() {
        const day = this.game.cloud.rewardDay(),
            amount = rewardAmount(this.game.profile.save, day),
            unclaimed = this.game.profile.save.completed.filter(
                (i) => !this.game.profile.save.claimed.includes(i),
            ).length;
        const n = this.game.overlays.openModal('收集奖励', '金币可以在商店兑换小窝装扮', 570);
        this.game.ui.text(
            n,
            `今日来访    ${this.game.profile.save.daily === day ? '已领取' : '+30 金币'}`,
            0,
            80,
            28,
        );
        this.game.ui.text(n, `画作首通    ${unclaimed} 幅 × 100 金币`, 0, 24, 28);
        this.game.ui.text(
            n,
            amount ? `可领取 ${amount} 金币` : '奖励已领完，完成新画作再来吧',
            0,
            -50,
            25,
            '#366650',
        );
        this.game.ui.button(
            n,
            amount ? '领取全部' : '返回主页',
            0,
            -167,
            470,
            76,
            GREEN,
            () => {
                if (this.game.cloud.cloudMode) {
                    this.game.cloud.claimCloudRewards();
                    return;
                }
                if (amount) {
                    claimRewards(this.game.profile.save, day);
                    this.game.profile.persist();
                }
                this.game.home.showHome();
                if (amount)
                    this.game.notices.notify(
                        '奖励已收下',
                        `${amount} 金币已经放进你的小窝`,
                        'success',
                    );
            },
            '#FFFFFF',
        );
    }

    worldLeaderboard(page: number) {
        if (
            !this.game.cloud.cloudReady ||
            (this.game.cloud.cloudBusy && !this.game.cloud.cloudCancellable)
        )
            return;
        const gap = Math.max(105, this.game.lifecycle.touchSize + 4);
        const n = this.game.overlays.openModal(
            '世界排行榜',
            '通关越多越靠前 · 同关卡先到者在前',
            1100 + 3 * (gap - 105),
        );
        this.game.ui.button(
            n,
            '返回',
            0,
            -270 - gap * 2,
            480,
            64,
            GREEN,
            () => this.game.overlays.closeModal(),
            '#FFFFFF',
        );
        this.game.overlays.modalStatusY = 80;
        this.game.cloud.cloudTask(
            () => this.game.cloud.cloud!.leaderboard(page),
            (result) => {
                if (!result.rows.length) this.game.ui.text(n, '还没有通关成绩', 0, 80, 30);
                result.rows.forEach((row, i) =>
                    this.game.ui.text(
                        n,
                        `${row.rank}. ${row.self ? '我' : row.player}   第 ${row.highest} 关`,
                        0,
                        300 - i * 51,
                        24,
                        row.self ? '#366650' : INK,
                        560,
                    ),
                );
                if (page > 0)
                    this.game.ui.button(n, '上一页', -175, -270, 150, 48, PAPER, () =>
                        this.worldLeaderboard(page - 1),
                    );
                if (result.hasNext)
                    this.game.ui.button(n, '下一页', 175, -270, 150, 48, PAPER, () =>
                        this.worldLeaderboard(page + 1),
                    );
                this.game.ui.text(n, '展示前一百名玩家', 0, -195, 22, MUTED);
                this.game.ui.button(n, '微信好友榜', 0, -270 - gap, 300, 48, PAPER, () =>
                    this.friendLeaderboard(0),
                );
            },
            '正在加载排行…',
            true,
        );
    }

    friendLeaderboard(page: number) {
        if (
            !this.game.cloud.cloudReady ||
            (this.game.cloud.cloudBusy && !this.game.cloud.cloudCancellable)
        )
            return;
        const n = this.game.overlays.openModal(
            '微信好友排行榜',
            '通关越多越靠前 · 同关卡先到者在前',
            1100,
        );
        this.game.ui.button(
            n,
            '返回',
            0,
            -465,
            480,
            64,
            GREEN,
            () => this.game.overlays.closeModal(),
            '#FFFFFF',
        );
        this.game.overlays.modalStatusY = 80;
        this.game.cloud.cloudTask(
            async () => {
                await authorizeFriends();
                await syncFriendScore(this.game.cloud.cloudHighest, this.game.cloud.cloudReachedAt);
            },
            () => {
                this.game.overlays.closeModal();
                const content = this.game.overlays.openModal(
                    '微信好友排行榜',
                    '通关越多越靠前 · 同关卡先到者在前',
                    1100,
                );
                const board = this.game.ui.node2d('Friend board', content, 0, 10, 440, 660);
                const subContext = board.addComponent(SubContextView);
                subContext.fps = 10;
                showFriendPage(page);
                this.game.ui.button(content, '刷新', 0, -365, 150, 48, PAPER, () =>
                    showFriendPage(0),
                );
                this.game.ui.button(content, '上一页', -175, -365, 150, 48, PAPER, () =>
                    changeFriendPage(-1),
                );
                this.game.ui.button(content, '下一页', 175, -365, 150, 48, PAPER, () =>
                    changeFriendPage(1),
                );
                this.game.ui.button(
                    content,
                    '世界榜',
                    0,
                    -365 - Math.max(100, this.game.lifecycle.touchSize + 4),
                    480,
                    64,
                    GREEN,
                    () => this.worldLeaderboard(0),
                    '#FFFFFF',
                );
            },
            '正在加载好友…',
            true,
        );
    }
}
