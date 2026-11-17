import { ScrollView, Vec2 } from 'cc';
import type { WorldBoard } from '../../platform/wechat/cloudGame';
import { leaderboardSkeleton } from './LeaderboardLoading';
import { WORLD_BOARD, worldBoardFooter } from '../../presentation/leaderboardLayout';
import { leaderboardChrome, artworkButton } from './LeaderboardArtwork';
import { leaderboardList } from './LeaderboardList';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import { makeLevel } from '../../domain/levels/levels';
import { claimRewards, rewardAmount } from '../../domain/profile/profile';
/** Displays rewards and leaderboards via existing platform adapters. */
export class SocialScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'assets'
            | 'cloud'
            | 'profile'
            | 'lifecycle'
            | 'overlays'
            | 'ui'
            | 'home'
            | 'notices'
            | 'identity'
            | 'leaderboardData'
        >,
    ) {}
    leaderboard(page = 0) {
        if (this.game.cloud.cloudMode) {
            this.worldLeaderboard();
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

    worldLeaderboard() {
        if (
            !this.game.cloud.cloudReady ||
            (this.game.cloud.cloudBusy && !this.game.cloud.cloudCancellable)
        )
            return;
        const footer = worldBoardFooter(this.game.lifecycle.touchSize);
        const n = this.game.overlays.openModal(
            '世界排行榜',
            '通关越多越靠前 · 同关卡先到者在前',
            footer.height,
            'custom',
        );
        const initial = leaderboardChrome(
            this.game,
            n,
            this.game.lifecycle.touchSize,
            this.game.identity.consentAvailable || this.game.identity.settingsAvailable,
            () => this.game.overlays.closeModal(),
        );
        leaderboardSkeleton(this.game, initial.content);
        this.game.identity.boardOpened(n);
        this.game.overlays.modalStatusY = WORLD_BOARD.summaryY;
        this.game.cloud.cloudTask(
            () => this.game.identity.synchronize(),
            () => {
                if (!n.isValid || this.game.overlays.modal !== n) return;
                const cached = this.game.leaderboardData.cached();
                if (cached) this.renderWorldBoard(n, cached, true);
                this.loadWorldBoard(n);
            },
            '正在加载排行榜…',
        );
    }

    private loadWorldBoard(n: import('cc').Node) {
        this.game.cloud.cloudTask(
            () => this.game.leaderboardData.load(),
            (result) => {
                if (n.isValid && this.game.overlays.modal === n) this.renderWorldBoard(n, result);
            },
            '正在加载排行榜…',
            true,
        );
    }

    private renderWorldBoard(n: import('cc').Node, result: WorldBoard, refreshing = false) {
        const loading = n.children.find((node) => node.name === 'Leaderboard content')!;
        const offset = loading.children
            .find((node) => node.name === 'Leaderboard viewport')
            ?.getComponent(ScrollView)
            ?.getScrollOffset();
        loading.name = 'Retired leaderboard loading';
        loading.active = false;
        loading.destroy();
        const { content, layout } = leaderboardChrome(
            this.game,
            n,
            this.game.lifecycle.touchSize,
            this.game.identity.consentAvailable || this.game.identity.settingsAvailable,
            () => this.game.overlays.closeModal(),
        );
        if (!result.rows.length) this.game.ui.text(content, '还没有通关成绩', 0, 80, 30);
        const scroll = leaderboardList(this.game, content, result.rows);
        if (offset)
            scroll.scrollToOffset(
                new Vec2(0, Math.min(Math.max(0, offset.y), scroll.getMaxScrollOffset().y)),
                0,
            );
        const caption = this.game.ui.text(
            content,
            '前一百名 · 上下滑动查看',
            0,
            WORLD_BOARD.summaryY,
            22,
            MUTED,
        );
        caption.node.active = !refreshing;
        if (this.game.identity.consentAvailable) {
            artworkButton(
                this.game,
                content,
                '微信资料授权',
                layout.consentX,
                layout.consentY,
                330,
                () => {},
            );
            this.game.identity.offerConsent(n, layout.consentY, layout.consentX, 330);
        }
        if (this.game.identity.settingsAvailable)
            artworkButton(
                this.game,
                content,
                '微信授权设置',
                layout.consentX,
                layout.consentY,
                330,
                () => this.game.identity.settings(),
            );
    }
}
