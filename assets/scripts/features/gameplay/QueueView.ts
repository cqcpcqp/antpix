import { Graphics, Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { ENTRY_POSES, INK, SELECT_POSES } from '../../presentation/gameVisuals';
import { queueColumnX } from '../../presentation/boardLayout';
import type { CardView } from '../../presentation/gameVisuals';

/** Owns the selectable queue and its local movement feedback. */
export class QueueView {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'session'
            | 'layout'
            | 'ui'
            | 'lifecycle'
            | 'containers'
            | 'preview'
            | 'overlays'
            | 'home'
            | 'cloud'
            | 'notices'
            | 'audio'
            | 'motion'
            | 'assets'
        >,
    ) {}
    drawQueue() {
        const visible = this.game.session.model.visibleQueue;
        this.game.layout.queueCount.string = this.queueCaption();
        const active = new Set(visible.map((v) => v.jar.id));
        for (const v of this.cardViews)
            if (!active.has(v.id)) {
                v.node.active = false;
                v.id = -1;
                this.resetCardMotion(v);
            }
        for (const { jar, column, row } of visible) {
            let v = this.cardViews.find((v) => v.id === jar.id);
            const retained = !!v;
            if (!v) v = this.cardViews.find((v) => v.id === -1);
            if (!v) {
                const node = this.game.ui.node2d(
                    'Queue card',
                    this.game.layout.queue,
                    0,
                    0,
                    112,
                    Math.max(
                        72,
                        this.game.lifecycle.touchSize / this.game.layout.playfield.scale.y,
                    ),
                );
                const motion = this.game.ui.node2d('Selection motion', node, 0, 0, 112, 72);
                const art = motion.addComponent(Graphics);
                const sprite = this.game.containers.containerSprite(motion, 102, 90);
                const label = this.game.ui.text(motion, '', 0, -5, 32, INK, 58);
                this.game.containers.containerNumber(label);
                v = {
                    node,
                    motion,
                    selectElapsed: -1,
                    art,
                    sprite,
                    label,
                    id: -1,
                    row: 0,
                    column: 0,
                    targetY: 0,
                };
                const card = v;
                node.on(Node.EventType.TOUCH_START, () => {
                    const jar = this.game.session.model.columns[card.column][card.row];
                    if (!jar || jar.id !== card.id) return;
                    this.game.preview.beginPreview(
                        node,
                        jar.color,
                        () =>
                            card.id === jar.id &&
                            this.game.session.model.columns[card.column][card.row]?.id === jar.id,
                    );
                    if (this.game.preview.hold?.node === node) card.selectElapsed = 0;
                });
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
                node.on(Node.EventType.TOUCH_CANCEL, () => {
                    this.game.preview.endPreview(node);
                    node.setScale(1, 1, 1);
                });
                node.on(Node.EventType.TOUCH_END, () => {
                    node.setScale(1, 1, 1);
                    if (this.game.preview.endPreview(node)) return;
                    if (
                        card.id < 0 ||
                        this.game.overlays.modal ||
                        this.game.home.home ||
                        this.game.session.won ||
                        this.game.cloud.cloudBusy
                    )
                        return;
                    if (card.row !== 0) {
                        this.game.notices.notify(
                            '下一排预览',
                            '先选走同列上方容器；长按可以找同色',
                            'info',
                        );
                        return;
                    }
                    const slot = this.game.session.model.place(card.id);
                    if (slot < 0) {
                        this.game.notices.notify(
                            '收集槽已满',
                            '等小蚂蚁出发完，再选择新的容器',
                            'warning',
                        );
                        return;
                    }
                    this.game.audio.play('tap');
                    this.game.containers.drawSlots();
                    const placed = this.game.containers.slotViews[slot];
                    placed.entryElapsed = 0;
                    this.game.motion.applyContainerPose(
                        placed.container,
                        placed.opacity,
                        0,
                        ENTRY_POSES,
                    );
                    this.drawQueue();
                });
                this.cardViews.push(v);
            }
            if (v.id !== jar.id) {
                v.art.clear();
                v.sprite.node.active = !!this.game.assets.containerFrames[0];
                if (this.game.assets.containerFrames[0]) {
                    this.game.containers.containerShadow(v.art);
                    this.game.containers.applyContainerMaterial(v.sprite, jar.color);
                } else this.game.containers.jar(v.art, jar, 0, 0, 92, 68);
                v.label.string = String(jar.remaining);
                this.game.containers.containerNumber(v.label);
            }
            const movedColumn = v.column !== column;
            v.id = jar.id;
            v.row = row;
            v.column = column;
            const rowGap = Math.max(
                72,
                this.game.lifecycle.touchSize / this.game.layout.playfield.scale.y + 4,
            );
            v.targetY = -482 + rowGap / 2 - row * rowGap;
            v.node.active = true;
            const previewScale = row === 1 ? 0.9 : 1;
            v.sprite.node.setScale(previewScale, previewScale, 1);
            v.label.fontSize = row === 1 ? 30 : 32;
            this.game.containers.containerNumber(v.label);
            // Existing lower cards slide straight up; other columns stay in place.
            v.node.setPosition(
                queueColumnX(column),
                retained && !movedColumn ? v.node.position.y : v.targetY - (row === 1 ? 6 : 0),
            );
            v.node.setScale(1, 1, 1);
        }
    }

    queueCaption() {
        if (!this.game.session.model) return '';
        const progress = `已收集 ${Math.floor((this.game.session.model.collected / this.game.session.model.level.pixels.length) * 100)}%`;
        return this.game.session.finishing ? `收尾加速 · ${progress}` : progress;
    }

    cardViews: CardView[] = [];

    fullFeedback = 0;

    updateQueueMotion(dt: number) {
        for (const card of this.cardViews) {
            if (!card.node.active) continue;
            if (card.selectElapsed >= 0) {
                card.selectElapsed += dt;
                this.game.motion.applyContainerPose(
                    card.motion,
                    null,
                    card.selectElapsed / 0.2,
                    SELECT_POSES,
                );
                if (card.selectElapsed >= 0.2) this.resetCardMotion(card);
            }
            const y = card.node.position.y,
                delta = card.targetY - y;
            if (Math.abs(delta) > 0.1)
                card.node.setPosition(queueColumnX(card.column), y + delta * Math.min(1, dt * 18));
            else if (delta !== 0) card.node.setPosition(queueColumnX(card.column), card.targetY);
        }
        if (this.fullFeedback > 0) {
            this.fullFeedback -= dt;
            if (this.fullFeedback <= 0 && !this.game.preview.hold?.shown)
                this.game.layout.queueCount.string = this.queueCaption();
        }
    }

    resetCardMotion(card: CardView) {
        if (card.selectElapsed < 0) return;
        card.selectElapsed = -1;
        card.motion.setPosition(0, 0);
        card.motion.setScale(1, 1, 1);
        card.motion.angle = 0;
    }
}
