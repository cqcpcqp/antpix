import { Graphics, Node, Sprite } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import { claimRewards, rewardAmount } from '../../domain/profile/profile';
import { islandPanel } from '../../presentation/islandTheme';

/** Owns home screen nodes and artwork interactions. */
export class HomeScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'lifecycle'
            | 'ui'
            | 'assets'
            | 'audio'
            | 'cloud'
            | 'preview'
            | 'overlays'
            | 'session'
            | 'profile'
            | 'courtyard'
            | 'album'
            | 'shop'
            | 'social'
            | 'notices'
            | 'cloudStatus'
        >,
    ) {}
    hideHome() {
        if (this.home) {
            this.home.active = false;
            this.home.destroy();
            this.home = null;
        }
        this.homeScene = null;
        this.homeTitle = null;
        this.homePlayArtwork = null;
        this.homeRewardButton = null;
        this.game.lifecycle.gameRoot.active = true;
    }

    homeAsset(parent: Node, name: string, x: number, y: number, w: number, h: number) {
        const sprite = this.game.ui
            .node2d(`Home asset ${name}`, parent, x, y, w, h)
            .addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this.game.assets.homeActionFrames.get(name) ?? null;
        return sprite.node;
    }

    homePress(node: Node, x: number, y: number, action: () => void) {
        const release = () => {
            node.setPosition(x, y);
            node.setScale(1, 1, 1);
        };
        node.on(Node.EventType.TOUCH_START, () => {
            node.setPosition(x, y - 3);
            node.setScale(0.96, 0.96, 1);
        });
        node.on(Node.EventType.TOUCH_CANCEL, release);
        node.on(Node.EventType.TOUCH_END, () => {
            release();
            this.game.audio.play('tap');
            action();
        });
    }

    homeTile(
        parent: Node,
        title: string,
        x: number,
        kind: 'album' | 'shop' | 'rank',
        action: () => void,
    ) {
        // Anchor to the viewport, leaving room for the bottom gesture safe area.
        const y = -this.game.lifecycle.screenHeight / 2 + 145;
        const node = this.game.ui.node2d(title, parent, x, y, 144, 138);
        this.homeAsset(node, kind, 0, 15, 110, 98);
        const caption = this.game.ui.graphics(node, 'Home caption');
        this.game.ui.box(caption, 0, -47, 110, 36, 18, '#FFF7DF');
        this.game.ui.text(node, title, 0, -47, 24, '#4E6239', 104);
        this.homePress(node, x, y, () => {
            if (this.game.cloud.cloudMode && !this.game.cloud.cloudReady) return;
            action();
        });
    }

    showHome(keepModal = false) {
        this.game.preview.clearPreview();
        if (!keepModal) this.game.overlays.closeModal();
        if (this.home) {
            this.home.active = false;
            this.home.destroy();
        }
        this.game.lifecycle.gameRoot.active = false;
        const resume =
            this.game.session.model &&
            !this.game.session.won &&
            !this.game.session.model.blocked &&
            (!this.game.cloud.cloudMode || this.game.cloud.cloudRunId.length > 0);
        const target =
            !resume && this.game.profile.save.completed.includes(this.game.profile.save.selected)
                ? this.game.profile.save.unlocked
                : this.game.profile.save.selected;
        const n = this.game.ui.node2d('Home', this.game.lifecycle.root);
        this.home = n;
        const background = this.game.ui.graphics(n, 'Home background');
        this.game.ui.box(
            background,
            0,
            0,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
            0,
            '#BFE3BF',
        );
        this.homeScene = this.game.ui
            .node2d(
                'Garden landscape',
                n,
                0,
                0,
                this.game.lifecycle.screenWidth,
                this.game.lifecycle.screenHeight,
            )
            .addComponent(Sprite);
        this.homeScene.sizeMode = Sprite.SizeMode.CUSTOM;
        this.homeScene.spriteFrame = this.game.assets.homeFrame;
        this.game.courtyard.courtyardNode = null;
        this.game.courtyard.refreshCourtyard();
        const g = this.game.ui.graphics(n, 'Home controls');
        this.game.ui.box(g, 216, 633, 214, 60, 30, PAPER);
        this.game.ui.text(
            n,
            this.game.cloud.cloudMode && !this.game.cloud.cloudReady
                ? '金币  …'
                : `金币  ${this.game.profile.save.coins}`,
            216,
            633,
            25,
            INK,
            195,
        ).isBold = false;
        this.game.ui.button(n, '收藏', -163, 633, 104, 60, PAPER, () => this.favoriteGuide());
        this.game.ui.gearButton(n, -286, 633);
        this.homeTitle = this.game.ui
            .node2d('Home title', n, 0, 493, 560, 560 / 3)
            .addComponent(Sprite);
        this.homeTitle.sizeMode = Sprite.SizeMode.CUSTOM;
        this.homeTitle.spriteFrame = this.game.assets.homeTitleFrame;
        // The landscape is the focal point; keep the playable artwork as a small print.
        const painting = this.game.ui.node2d('Home painting', n, 250, 315, 124, 155);
        painting.angle = -3;
        const frame = this.game.ui.graphics(painting, 'Painting border');
        islandPanel(frame, 0, 0, 124, 155, PAPER);
        this.game.ui.artwork(painting, target, 0, 0, 110);
        // Keep the approved proportions; rewards occupy the gap above bottom navigation.
        const playY = this.homePlayY;
        const playNode = this.game.ui.node2d(
            resume ? '继续游戏' : '开始游戏',
            n,
            0,
            playY,
            500,
            160,
        );
        this.homeAsset(playNode, 'play', 0, 0, 500, 160);
        this.homePlayArtwork = this.homeAsset(
            playNode,
            resume ? 'play-resume' : 'play-start',
            12,
            0,
            330,
            88,
        );
        const tag = this.game.ui.node2d('Level paper tag', playNode, 0, 91, 204, 48);
        const tagArt = tag.addComponent(Graphics);
        islandPanel(tagArt, 0, 0, 204, 48, '#FFF6D8');
        const tagText = this.game.ui.text(
            tag,
            this.game.cloud.cloudMode && !this.game.cloud.cloudReady
                ? '加载中'
                : `第 ${target + 1} 关`,
            0,
            0,
            23,
            INK,
            184,
        );
        tagText.color = color('#795D38');
        tagText.enableOutline = false;
        this.homePress(playNode, 0, playY, () => {
            if (
                this.game.cloud.cloudMode &&
                (this.game.cloud.cloudBusy || !this.game.cloud.cloudReady)
            )
                return;
            if (resume) {
                this.game.overlays.closeModal();
                this.hideHome();
            } else this.game.session.startLevel(target);
        });
        this.homeTile(n, '关卡', -220, 'album', () => this.game.album.levelPicker());
        this.homeTile(n, '装饰', 0, 'shop', () => this.game.shop.shop());
        this.homeTile(n, '排行榜', 220, 'rank', () => this.game.social.leaderboard());
        const rewards = rewardAmount(this.game.profile.save, this.game.cloud.rewardDay());
        this.homeRewardButton = null;
        if (rewards > 0 && (!this.game.cloud.cloudMode || this.game.cloud.cloudReady)) {
            this.homeRewardButton = this.game.ui.button(
                n,
                `领取奖励  +${rewards} 金币`,
                0,
                this.homeRewardY,
                460,
                56,
                '#FFF8E0',
                () => {
                    if (this.game.cloud.cloudMode) {
                        this.game.cloud.claimCloudRewards();
                        return;
                    }
                    const day = this.game.cloud.rewardDay(),
                        amount = rewardAmount(this.game.profile.save, day);
                    if (amount > 0) {
                        claimRewards(this.game.profile.save, day);
                        this.game.profile.persist();
                    }
                    this.showHome();
                    if (amount > 0)
                        this.game.notices.notify(
                            '奖励已收下',
                            `${amount} 金币已经放进你的小窝`,
                            'success',
                        );
                },
            ).node.parent!;
        }
        if (this.game.shop.courtyardShopContent && this.game.courtyard.courtyardPreview)
            this.game.shop.shop(
                this.game.courtyard.courtyardPreview.slot,
                this.game.courtyard.courtyardPreview.id,
            );
        else if (this.game.shop.nestShopContent) this.game.shop.nestShop();
        this.game.cloudStatus.refreshCloudStatus();
        if (this.game.overlays.modal) this.game.overlays.modal.setSiblingIndex(998);
        if (this.game.notices.notification)
            this.game.notices.notification.node.setSiblingIndex(999);
    }

    favoriteGuide() {
        const n = this.game.overlays.openModal(
            '收藏生态蚂蚁窝',
            '下次从微信「我的小程序」快速回来',
            460,
        );
        this.game.ui.text(n, '1. 点击微信右上角「···」', 0, 52, 26);
        this.game.ui.text(n, '2. 在菜单里选择「添加到我的小程序」', 0, 2, 24);
        this.game.ui.text(n, '需要在微信中操作，本页不会自动添加', 0, -58, 21, MUTED);
        this.game.ui.button(
            n,
            '知道了',
            0,
            -151,
            470,
            68,
            GREEN,
            () => this.game.overlays.closeModal(),
            '#FFFFFF',
        );
    }

    home: Node | null = null;

    homeScene: Sprite | null = null;

    homeTitle: Sprite | null = null;

    homePlayArtwork: Node | null = null;

    get homePlayY() {
        return -this.game.lifecycle.screenHeight * 0.22;
    }

    get homeRewardY() {
        return this.homePlayY - 145;
    }

    homeRewardButton: Node | null = null;
}
