import { Color, Graphics, Label, Node, Sprite, UIOpacity } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, INK } from '../../presentation/gameVisuals';
import type { Jar } from '../../domain/game/model';
import { PALETTE } from '../../domain/levels/levels';
import { collectionSlotX, collectionSlotY } from '../../presentation/boardLayout';
import { containerNumberOffset } from '../../presentation/containerTypography';
import type { SlotView } from '../../presentation/gameVisuals';

/** Owns container materials, labels and collection slot views. */
export class ContainerRenderer {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'ui' | 'assets' | 'session' | 'layout' | 'lifecycle' | 'preview'
        >,
    ) {}
    jar(g: Graphics, j: Jar, x: number, y: number, w = 108, h = 84) {
        const base = color(PALETTE[j.color]);
        const shade = new Color(
            Math.round(base.r * 0.72),
            Math.round(base.g * 0.72),
            Math.round(base.b * 0.72),
            255,
        );
        g.fillColor = new Color(78, 57, 33, 35);
        g.ellipse(x + 3, y - h / 2 - 4, w * 0.49, 7);
        g.fill();
        g.fillColor = shade;
        g.roundRect(x - w / 2, y - h / 2 - 2, w, h, 18);
        g.fill();
        this.game.ui.box(g, x - 1, y + 2, w - 3, h - 3, 18, PALETTE[j.color]);
        g.fillColor = new Color(255, 245, 216, 42);
        g.roundRect(x - w / 2 + 5, y + h / 2 - 20, w - 12, 16, 8);
        g.fill();
        this.game.ui.box(g, x, y - 7, w * 0.68, h * 0.57, 14, '#E2CAA0');
        this.game.ui.box(g, x - 1, y - 5, w * 0.68 - 2, h * 0.57 - 2, 13, '#FFF0CF');
        this.game.ui.box(g, x, y + h / 2 - 9, w * 0.57, 15, 7, '#93713F');
        this.game.ui.box(g, x, y + h / 2 - 11, w * 0.52, 10, 5, '#392A19');
    }

    containerSprite(parent: Node, w: number, h: number) {
        const sprite = this.game.ui
            .node2d('Rounded box texture', parent, 0, 0, w, h)
            .addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.node.active = false;
        const detail = this.game.ui
            .node2d('Container details', sprite.node, 0, 0, w, h)
            .addComponent(Sprite);
        detail.sizeMode = Sprite.SizeMode.CUSTOM;
        this.containerDetails.set(sprite, detail);
        return sprite;
    }

    applyContainerMaterial(sprite: Sprite, index: number) {
        sprite.spriteFrame = this.game.assets.containerFrames[0];
        sprite.color = color(PALETTE[index]);
        sprite.node.active = true;
        this.containerDetails.get(sprite)!.spriteFrame = this.game.assets.containerFrames[1];
    }

    containerNumber(label: Label) {
        this.game.ui.containerLabels.add(label);
        if (this.game.ui.containerFont) label.font = this.game.ui.containerFont;
        label.color = color('#49311E');
        label.enableOutline = false;
        label.isBold = false;
        label.node.setPosition(containerNumberOffset(label.string, label.fontSize), -4);
    }

    containerShadow(g: Graphics) {
        g.fillColor = new Color(80, 62, 36, 18);
        g.ellipse(2, -34, 43, 6);
        g.fill();
        g.fillColor = new Color(80, 62, 36, 20);
        g.ellipse(1, -33, 34, 3);
        g.fill();
    }

    drawSlots() {
        for (let i = this.game.session.model.slots.length; i < this.slotViews.length; i++)
            this.slotViews[i].art.node.active = false;
        for (let i = 0; i < this.game.session.model.slots.length; i++) {
            let view = this.slotViews[i];
            if (!view) {
                const node = this.game.ui.node2d(
                    'Collection slot ' + i,
                    this.game.layout.jars,
                    collectionSlotX(i, this.game.session.model.slots.length),
                    collectionSlotY(i),
                    110,
                    Math.max(
                        96,
                        this.game.lifecycle.touchSize / this.game.layout.playfield.scale.y,
                    ),
                );
                const art = node.addComponent(Graphics);
                const container = this.game.ui.node2d('Dispatch container', node, 0, 0, 110, 96);
                const body = container.addComponent(Graphics);
                const sprite = this.containerSprite(container, 102, 90);
                const label = this.game.ui.text(container, '', 0, -5, 32, INK, 58);
                this.containerNumber(label);
                const opacity = container.addComponent(UIOpacity);
                const exit = this.game.ui.node2d('Departing container', node, 0, 0, 110, 96);
                const exitBody = exit.addComponent(Graphics);
                const exitSprite = this.containerSprite(exit, 102, 90);
                const exitOpacity = exit.addComponent(UIOpacity);
                exit.active = false;
                view = {
                    art,
                    label,
                    id: -2,
                    container,
                    body,
                    sprite,
                    color: -1,
                    launchElapsed: -1,
                    entryElapsed: -1,
                    opacity,
                    exit,
                    exitBody,
                    exitSprite,
                    exitOpacity,
                    exitElapsed: -1,
                };
                this.slotViews.push(view);
                this.slotLabels.push(label);
                node.on(Node.EventType.TOUCH_START, () => {
                    const jar = this.game.session.model.slots[i];
                    if (jar)
                        this.game.preview.beginPreview(
                            node,
                            jar.color,
                            () => this.game.session.model.slots[i]?.id === jar.id,
                        );
                });
                node.on(Node.EventType.TOUCH_END, () => this.game.preview.endPreview(node));
                node.on(Node.EventType.TOUCH_CANCEL, () => this.game.preview.endPreview(node));
                node.on(
                    Node.EventType.TOUCH_MOVE,
                    (e: {
                        getUILocation: () => {
                            x: number;
                            y: number;
                        };
                        getUIStartLocation: () => {
                            x: number;
                            y: number;
                        };
                    }) => this.game.preview.movePreview(node, e),
                );
            }
            view.art.node.active = true;
            view.art.node.setPosition(
                collectionSlotX(i, this.game.session.model.slots.length),
                collectionSlotY(i),
            );
            const jar = this.game.session.model.slots[i],
                id = jar ? jar.id : -1;
            // Slot geometry changes only when a jar enters or leaves, never on count updates.
            if (view.id !== id) {
                view.id = id;
                view.launchElapsed = -1;
                view.entryElapsed = -1;
                view.opacity.opacity = 255;
                view.container.angle = 0;
                view.container.setPosition(0, 0);
                view.container.setScale(1, 1, 1);
                view.container.active = !!jar;
                view.body.clear();
                view.sprite.node.active = false;
                const g = view.art;
                g.clear();
                // Each slot has a recessed, handmade tray with a soft rim and a
                // tiny highlight. This keeps the five positions readable when
                // the contents change without turning them into plain buttons.
                if (i >= 5) {
                    this.game.ui.box(g, 0, -4, 94, 58, 16, '#C9AF83');
                    this.game.ui.box(g, 0, 0, 94, 58, 16, '#F8F4E5');
                }
                if (!jar && i < 5) {
                    this.game.ui.box(g, 0, -4, 84, 48, 15, '#D9D5B6');
                    this.game.ui.box(g, 0, 0, 84, 48, 15, '#F8FBF1');
                    g.fillColor = new Color(255, 255, 255, 150);
                    g.roundRect(-33, 13, 66, 5, 2.5);
                    g.fill();
                }
                if (jar) {
                    this.containerShadow(g);
                    view.color = jar.color;
                    if (this.game.assets.containerFrames[0]) {
                        this.applyContainerMaterial(view.sprite, jar.color);
                    } else this.jar(view.body, jar, 0, 0, 92, 70);
                }
            }
            view.label.string = jar ? String(this.game.session.model.undispatched(i)) : '';
            if (jar) this.containerNumber(view.label);
            else {
                view.label.color = color('#A8B99C');
                view.label.isBold = false;
                view.label.enableOutline = false;
            }
        }
    }

    slotLabels: Label[] = [];

    slotViews: SlotView[] = [];

    containerDetails = new Map<Sprite, Sprite>();
}
