import { EditBox, Node, UITransform } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import {
    FULL_HOURS,
    MELON_PRICE,
    PET_HOUR,
    canBoostMood,
    petAction,
    petVitals,
} from '../../domain/profile/pets';
import { GREEN, INK, PAPER } from '../../presentation/gameVisuals';
import { islandPanel } from '../../presentation/islandTheme';
import type { CourtyardResident } from './courtyardResident';
import { PetBubbles } from './petBubbles';
import { petCareCard } from './petCareCard';
import { petIcon } from './petIcons';
import type { PetIcon } from './petIcons';
import type { PetFood, ResidentPose } from './residentMotion';

/** Owns resident interaction and routes persisted actions to the active save. */
export class PetController {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'audio' | 'cloud' | 'home' | 'lifecycle' | 'notices' | 'overlays' | 'profile' | 'ui'
        >,
    ) {}

    private layer: Node | null = null;
    private menu: Node | null = null;
    private card: ReturnType<typeof petCareCard> | null = null;
    private menuOpened = 0;
    private orbs: { node: Node; x: number; y: number }[] = [];
    private view: CourtyardResident | null = null;
    private feeding = false;
    private time = 0;
    private readonly bubbles = new PetBubbles();

    private get pet() {
        return this.game.profile.save.pets.residents[0];
    }

    attach(parent: Node, view: CourtyardResident) {
        this.close();
        this.bubbles.reset();
        this.layer = this.game.ui.node2d('Resident interactions', parent, 0, 0, 1, 1);
        this.view = view;
        const hit = view.root.getComponent(UITransform)!;
        const touchSize = this.game.lifecycle.touchSize;
        hit.setContentSize(Math.max(hit.width, touchSize), Math.max(hit.height, touchSize));
        view.root.on(Node.EventType.TOUCH_END, () => this.select());
    }

    close() {
        if (this.menu?.isValid) {
            this.menu.active = false;
            this.menu.destroy();
        }
        this.menu = null;
        this.orbs = [];
        if (this.card?.root.isValid) {
            this.card.root.active = false;
            this.card.root.destroy();
        }
        this.card = null;
        this.feeding = false;
    }

    private select() {
        const view = this.view;
        if (!view?.canInteract || this.game.overlays.modal || this.isEating()) return;
        const wasOpen = this.isInteracting();
        this.close();
        this.game.audio.play('tap');
        if (!wasOpen) this.showMenu();
    }

    private showMenu() {
        if (!this.layer?.isValid || !this.view) return;
        if (this.menu) {
            this.menu.active = false;
            this.menu.destroy();
        }
        const menu = this.game.ui.node2d('Resident arc', this.layer, 0, 0, 1, 1);
        this.menu = menu;
        this.menuOpened = this.time;
        this.orbs = [];
        const { screenWidth, touchSize } = this.game.lifecycle;
        const radius = Math.max(135, touchSize * 1.65, 102.5 * this.view.artScale);
        const fitsOnLeft = this.view.root.position.x + screenWidth / 2 >= radius + touchSize / 2;
        const side = fitsOnLeft ? -1 : 1;
        const rowSpacing = touchSize + 4;
        const addButton = (name: string, icon: PetIcon, row: number, action: () => void) => {
            const y = row * rowSpacing;
            const x = side * Math.sqrt(radius ** 2 - y ** 2);
            this.orbit(menu, name, icon, x, y, action);
        };
        if (this.feeding) {
            addButton('Resident ration', 'bowl', 0, () => this.feed('ration'));
            addButton('Resident melon', 'melon', 1, () => {
                if (this.game.profile.save.pets.melons) this.feed('melon');
                else this.shop();
            });
        } else {
            addButton('Resident feed', 'bowl', 1, () => {
                if (this.pet.fedUntil >= this.game.cloud.now() + (FULL_HOURS - 1 / 60) * PET_HOUR) {
                    this.game.notices.notify('吃饱啦', '等饿一点再喂');
                    return;
                }
                this.feeding = true;
                this.showMenu();
            });
            addButton('Resident pet', 'hand', 0, () => this.pat());
            addButton('Resident info', 'info', -1, () => this.showCare());
        }
        this.positionMenu();
    }

    private orbit(
        parent: Node,
        name: string,
        icon: PetIcon,
        x: number,
        y: number,
        action: () => void,
    ) {
        const unit = this.game.lifecycle.touchSize;
        const button = this.game.ui.node2d(name, parent, x, y, unit, unit);
        const delay = this.orbs.length * 0.035;
        this.orbs.push({ node: button, x, y });
        const art = this.game.ui.graphics(button, 'Button art');
        islandPanel(art, 0, 0, 68, 68, PAPER);
        petIcon(art, icon);
        button.on(Node.EventType.TOUCH_END, () => {
            if (!button.active || this.time - this.menuOpened < delay + 0.1) return;
            this.game.audio.play('tap');
            action();
        });
    }

    private positionMenu() {
        if (!this.menu || !this.view) return;
        if (!this.view.canInteract) {
            this.close();
            return;
        }
        this.menu.setPosition(this.view.root.position.x, this.view.root.position.y);
        this.orbs.forEach(({ node, x, y }, index) => {
            const progress = Math.min(1, (this.time - this.menuOpened - index * 0.035) / 0.17);
            node.active = progress > 0;
            if (!node.active) return;
            const travel = 1 - (1 - progress) ** 3;
            const scale = 0.78 + travel * 0.22 + 0.065 * Math.sin(progress * Math.PI);
            node.setPosition(x * travel, y * travel);
            node.setScale(scale, scale, 1);
        });
    }

    vitals() {
        return petVitals(this.pet, this.game.cloud.now());
    }

    isInteracting() {
        return !!(this.menu || this.card);
    }

    private showCare() {
        this.close();
        if (!this.layer?.isValid || !this.view) return;
        const { screenWidth, screenHeight, touchSize } = this.game.lifecycle;
        const card = petCareCard(
            this.game.ui,
            this.layer,
            this.pet.name,
            Math.min(410, screenWidth - 36),
            touchSize,
            () => this.rename(),
            () => {
                this.close();
                this.showMenu();
            },
        );
        this.card = card;
        const { x, y } = this.view.root.position;
        const margin = screenWidth / 2 - card.width / 2 - 14;
        card.root.setPosition(
            Math.max(-margin, Math.min(margin, x)),
            Math.min(
                screenHeight / 2 - card.height / 2 - 16,
                y + 87 * this.view.artScale + card.height / 2,
            ),
        );
        card.update(this.vitals());
    }

    private pat() {
        const done = () => this.react('pet');
        if (canBoostMood(this.pet, this.game.cloud.rewardDay())) this.apply('pat', '', done);
        else done();
    }

    private apply(operation: 'buy' | 'feed' | 'rename' | 'pat', value = '', complete = () => {}) {
        const id = operation === 'buy' ? -1 : 0;
        const { cloud, profile } = this.game;
        if (cloud.cloudMode) {
            if (!cloud.cloudReady || cloud.cloudBusy) return;
            cloud.cloudTask(
                () => cloud.cloud!.mutate('pet', { operation, petId: id, value }),
                (state) => {
                    cloud.applyCloudState(state);
                    complete();
                    this.game.home.refreshHomeCoins();
                },
                '正在保存蚁窝',
            );
            return;
        }
        const error = petAction(profile.save, operation, id, value, cloud.now(), cloud.rewardDay());
        if (error) {
            this.game.notices.notify(error, '', 'warning');
            return;
        }
        profile.persist();
        complete();
        this.game.home.refreshHomeCoins();
    }

    private feed(food: PetFood) {
        this.apply('feed', food, () =>
            this.react('eat', food === 'melon' ? '西瓜好甜' : '吃饱一点啦', food),
        );
    }

    shop() {
        this.close();
        const panel = this.game.overlays.openModal('食物', '', 430);
        const stock = this.game.ui.text(
            panel,
            `西瓜丁库存 ${this.game.profile.save.pets.melons} 份`,
            0,
            55,
        );
        this.game.ui.button(panel, `购买西瓜丁 · ${MELON_PRICE} 金币`, 0, -16, 460, 70, GREEN, () =>
            this.apply('buy', '', () => {
                if (stock.isValid)
                    stock.string = `西瓜丁库存 ${this.game.profile.save.pets.melons} 份`;
                this.game.notices.notify('买到西瓜丁啦', '回庭院点食盆喂食');
            }),
        );
        this.game.ui.text(panel, '每日口粮 · 每天一份', 0, -91);
        this.game.ui.button(panel, '回庭院', 0, -150, 220, 54, PAPER, () =>
            this.game.overlays.closeModal(),
        );
    }

    private rename() {
        this.close();
        const modal = this.game.overlays.openModal('给蚂蚁起名字', '一到八个字', 390);
        const input = this.game.ui.node2d('Resident name input', modal, 0, 0, 430, 76);
        islandPanel(this.game.ui.graphics(input), 0, 0, 430, 76, PAPER);
        const editor = input.addComponent(EditBox);
        editor.textLabel = this.game.ui.text(input, '', 0, 0, 30, INK, 390, true);
        editor.maxLength = 8;
        editor.inputMode = EditBox.InputMode.SINGLE_LINE;
        editor.string = this.pet.name;
        this.game.ui.button(modal, '保存', 120, -105, 190, 65, GREEN, () =>
            this.apply('rename', editor.string, () => {
                if (modal.isValid) {
                    this.game.overlays.closeModal();
                    this.showCare();
                }
            }),
        );
        this.game.ui.button(modal, '取消', -120, -105, 190, 65, PAPER, () => {
            this.game.overlays.closeModal();
            this.showCare();
        });
    }

    private react(pose: ResidentPose, caption = '♥', food?: PetFood) {
        this.close();
        const duration = this.bubbles.play(pose, this.time, food);
        if (duration && !food && this.layer?.isValid && this.view)
            this.bubbles.show(this.game.ui, this.layer, this.view, caption, this.time + duration);
    }

    isEating() {
        return this.bubbles.eating(this.time);
    }

    cheer() {
        if (this.view?.canInteract) this.react('cheer', '耶');
    }

    update(dt: number) {
        this.time += Math.min(0.05, Math.max(0, dt));
        if (this.view) this.bubbles.render(this.view, this.time);
        this.bubbles.update(this.time);
        this.card?.update(this.vitals());
        this.positionMenu();
    }
}
