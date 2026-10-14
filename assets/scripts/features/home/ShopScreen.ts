import { Node, Sprite } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import type { CourtyardSlot, Furnishing } from '../../domain/profile/profile';
import { buyOrEquip, buyOrEquipFurnishing, FURNISHINGS, SKINS } from '../../domain/profile/profile';
import { courtyardShopLayout, renderCourtyardShop, SLOT_NAMES } from '../courtyard/courtyardView';

/** Handles furnishing and nest purchases with existing profile/cloud rules. */
export class ShopScreen {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'overlays'
            | 'home'
            | 'profile'
            | 'lifecycle'
            | 'ui'
            | 'courtyard'
            | 'assets'
            | 'cloud'
            | 'cloudStatus'
            | 'notices'
            | 'layout'
        >,
    ) {}
    shop(slot: CourtyardSlot = 'entrance', itemId?: string) {
        if (this.courtyardShopContent && this.game.overlays.drawerMotion?.closing) return;
        if (!this.game.home.home) this.game.home.showHome();
        const items = FURNISHINGS.filter((item) => item.slot === slot);
        const selected =
            items.find((item) => item.id === itemId) ||
            items.find((item) => !this.game.profile.save.courtyard.owned.includes(item.id)) ||
            items[0];
        const layout = courtyardShopLayout(this.game.lifecycle.touchSize);
        // Keep the sheet and its motion alive when only the selection changes.
        const sheet = this.courtyardShopContent
            ? this.game.overlays.drawerSheet!
            : this.game.overlays.openDrawer('装修我的小窝', '', layout.height);
        if (this.courtyardShopContent) {
            this.courtyardShopContent.active = false;
            this.courtyardShopContent.destroy();
        }
        const n = this.game.ui.node2d('Courtyard shop content', sheet);
        this.courtyardShopContent = n;
        this.game.overlays.drawerSubtitle!.string = `金币 ${this.game.profile.save.coins} · 点选装饰看效果`;
        this.lastCourtyardSelection = selected;
        this.game.courtyard.courtyardPreview = selected;
        this.game.courtyard.refreshCourtyard();
        renderCourtyardShop(
            n,
            this.game.profile.save,
            slot,
            selected,
            this.game.assets.furnishingFrames,
            {
                text: this.game.ui.text.bind(this.game.ui),
                button: this.game.ui.button.bind(this.game.ui),
            },
            {
                select: (category, item) => {
                    if (!this.game.cloud.cloudBusy) this.shop(category, item);
                },
                purchase: (item) => this.purchaseFurnishing(item),
                clear: (category) => this.clearFurnishing(category),
                nests: () => this.nestShop(),
            },
            this.game.lifecycle.touchSize,
        );
        this.game.cloudStatus.refreshCloudStatus();
    }

    purchaseFurnishing(item: Furnishing) {
        if (this.game.cloud.cloudBusy) return;
        if (
            !this.game.profile.save.courtyard.owned.includes(item.id) &&
            this.game.profile.save.coins < item.price
        ) {
            this.game.notices.notify(
                '再攒一点就能买到',
                `还差 ${item.price - this.game.profile.save.coins} 金币，通关后到主页领取奖励`,
                'warning',
            );
            return;
        }
        const finish = () => {
            if (this.game.home.home) this.game.home.showHome(true);
            this.game.notices.notify('小窝添了新模样', `已布置「${item.name}」`, 'success');
        };
        if (this.game.cloud.cloudMode) {
            if (!this.game.cloud.cloudReady) return;
            this.game.cloud.cloudTask(
                () => this.game.cloud.cloud!.mutate('furnish', { item: item.id }),
                (state) => {
                    this.game.cloud.applyCloudState(state);
                    finish();
                },
                '正在布置庭院…',
            );
        } else {
            buyOrEquipFurnishing(this.game.profile.save, item.id);
            this.game.profile.persist();
            finish();
        }
    }

    clearFurnishing(slot: CourtyardSlot) {
        if (this.game.cloud.cloudBusy) return;
        const view = this.game.overlays.modal;
        const finish = () => {
            if (this.game.overlays.modal === view) this.game.home.showHome();
            else if (this.game.home.home) this.game.home.showHome(true);
            this.game.notices.notify(
                '装饰已收好',
                `${SLOT_NAMES[slot]}的装饰已收好，可免费再次布置`,
                'success',
            );
        };
        if (this.game.cloud.cloudMode) {
            if (!this.game.cloud.cloudReady) return;
            this.game.cloud.cloudTask(
                () => this.game.cloud.cloud!.mutate('unfurnish', { slot }),
                (state) => {
                    this.game.cloud.applyCloudState(state);
                    finish();
                },
                '正在收好装饰…',
            );
        } else {
            this.game.profile.save.courtyard.equipped[slot] = '';
            this.game.profile.persist();
            finish();
        }
    }

    nestShop() {
        if (this.nestShopContent && this.game.overlays.drawerMotion?.closing) return;
        const gap = Math.max(130, this.game.lifecycle.touchSize + 12);
        const height = 832 + 4 * (gap - 130);
        const sheet = this.nestShopContent
            ? this.game.overlays.drawerSheet!
            : this.game.overlays.openDrawer('洞口装扮', '', height);
        if (this.nestShopContent) {
            this.nestShopContent.active = false;
            this.nestShopContent.destroy();
        }
        const n = this.game.ui.node2d('Nest shop content', sheet);
        this.nestShopContent = n;
        this.game.overlays.drawerSubtitle!.string = `金币 ${this.game.profile.save.coins} · 更换局内洞口装饰`;
        SKINS.forEach((skin, i) => {
            const y = height / 2 - 252 - i * gap,
                g = this.game.ui.graphics(n);
            this.game.ui.box(g, 0, y, 620, 112, 20, PAPER);
            this.game.ui.box(g, -203, y, 92, 86, 20, skin.light);
            if (this.game.assets.nestFrames[i]) {
                const thumbnail = this.game.ui
                    .node2d('Wooden nest sample', n, -200, y, 84, 48)
                    .addComponent(Sprite);
                thumbnail.sizeMode = Sprite.SizeMode.CUSTOM;
                thumbnail.spriteFrame = this.game.assets.nestFrames[i];
            } else {
                g.fillColor = color(skin.rim);
                g.ellipse(-203, y, 32, 20);
                g.fill();
                g.fillColor = color('#2E241C');
                g.ellipse(-203, y, 21, 12);
                g.fill();
            }
            this.game.ui.text(n, skin.name, -40, y + 19, 26, INK, 210);
            this.game.ui.text(
                n,
                this.game.profile.save.owned.includes(skin.id) ? '已拥有' : `${skin.price} 金币`,
                -40,
                y - 20,
                24,
                MUTED,
                210,
            );
            const equipped = this.game.profile.save.nest === skin.id;
            this.game.ui.button(
                n,
                equipped
                    ? '使用中'
                    : this.game.profile.save.owned.includes(skin.id)
                      ? '使用'
                      : '兑换',
                191,
                y,
                130,
                67,
                equipped ? '#E8FAF5' : GREEN,
                () => {
                    if (
                        equipped ||
                        this.game.cloud.cloudBusy ||
                        this.game.overlays.drawerMotion?.closing
                    )
                        return;
                    const finish = () => {
                        this.game.layout.drawNest();
                        if (this.game.home.home) this.game.home.showHome(true);
                        else if (this.nestShopContent) this.nestShop();
                        this.game.notices.notify(
                            '小窝焕然一新',
                            `已换上「${skin.name}」`,
                            'success',
                        );
                    };
                    if (this.game.cloud.cloudMode) {
                        if (!this.game.cloud.cloudReady) return;
                        this.game.cloud.cloudTask(
                            () => this.game.cloud.cloud!.mutate('shop', { skin: skin.id }),
                            (state) => {
                                this.game.cloud.applyCloudState(state);
                                finish();
                            },
                            '正在更新装扮…',
                        );
                        return;
                    }
                    const result = buyOrEquip(this.game.profile.save, skin.id);
                    if (result === 'insufficient') {
                        this.game.notices.notify(
                            '金币还差一点',
                            '先领取奖励，或完成一幅新画作',
                            'warning',
                        );
                        return;
                    }
                    this.game.profile.persist();
                    finish();
                },
                equipped ? INK : '#FFFFFF',
            );
        });
        this.game.ui.button(n, '返回装修', 0, height / 2 - 252 - gap * 4, 480, 64, PAPER, () => {
            const selected = this.lastCourtyardSelection;
            this.shop(selected?.slot, selected?.id);
        });
        this.game.cloudStatus.refreshCloudStatus();
    }

    courtyardShopContent: Node | null = null;

    nestShopContent: Node | null = null;

    lastCourtyardSelection: Furnishing | null = null;
}
