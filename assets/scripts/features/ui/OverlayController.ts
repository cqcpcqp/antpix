import { Color, Graphics, Label, Node, UIOpacity, UITransform } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, INK, MUTED } from '../../presentation/gameVisuals';
import { ISLAND, islandModal } from '../../presentation/islandTheme';

/** Owns modal/drawer lifetime and animated dismissal. */
export class OverlayController {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'boosts'
            | 'session'
            | 'home'
            | 'victory'
            | 'notices'
            | 'courtyard'
            | 'lifecycle'
            | 'preview'
            | 'ui'
            | 'cloudStatus'
            | 'cloud'
            | 'shop'
        >,
    ) {}
    drawerMotion: {
        node: Node;
        from: number;
        to: number;
        elapsed: number;
        closing: boolean;
        previewFrom?: number;
    } | null = null;

    drawerSheet: Node | null = null;

    drawerVeil: UIOpacity | null = null;

    drawerSubtitle: Label | null = null;

    modal: Node | null = null;

    modalStatusY = 0;

    updateOverlays(dt: number) {
        const ad = this.game.boosts.rewardAdDemo;
        if (ad) {
            ad.remaining -= dt;
            if (ad.remaining > 0) ad.label.string = `测试广告 ${Math.ceil(ad.remaining)} 秒`;
            else {
                this.game.boosts.rewardAdDemo = null;
                const complete = ad.complete;
                this.closeModal();
                complete();
            }
        }
        if (this.game.session.pendingVictory && !this.modal && !this.game.home.home) {
            this.game.session.pendingVictory = false;
            this.game.victory.showVictory();
        }
        const note = this.game.notices.notification;
        if (note) {
            note.elapsed += dt;
            const shift =
                note.elapsed < 0.25
                    ? 32 * (1 - note.elapsed / 0.25)
                    : note.elapsed > 3.25
                      ? 32 * Math.min(1, (note.elapsed - 3.25) / 0.25)
                      : 0;
            note.node.setPosition(0, 610 + shift);
            if (note.elapsed >= 3.5) {
                note.node.active = false;
                note.node.destroy();
                this.game.notices.notification = null;
            }
        }
        const motion = this.drawerMotion;
        if (motion) {
            motion.elapsed += dt;
            const t = Math.min(1, motion.elapsed / 0.36),
                ease = 1 - Math.pow(1 - t, 3);
            motion.node.setPosition(0, motion.from + (motion.to - motion.from) * ease);
            if (motion.closing) {
                if (this.drawerVeil) this.drawerVeil.opacity = 255 * (1 - ease);
                if (motion.previewFrom !== undefined) {
                    const offset = motion.previewFrom * (1 - ease);
                    this.game.home.homeScene?.node.setPosition(0, offset);
                    this.game.courtyard.courtyardNode?.setPosition(0, offset);
                }
            }
            if (t === 1) {
                this.drawerMotion = null;
                if (motion.closing) this.closeModal();
            }
        }
    }

    dismissOverlay() {
        if (this.drawerSheet) {
            if (this.drawerMotion?.closing) return;
            // Stop when the visible sheet top reaches the screen bottom, so the
            // landscape reaches its origin before the sheet uncovers it.
            const sheetHeight = this.drawerSheet.getComponent(UITransform)!.height;
            const to = -this.game.lifecycle.screenHeight / 2 - sheetHeight / 2 + 30;
            const coveredHeight = Math.max(0, this.drawerSheet.position.y - to);
            const previewFrom = this.game.courtyard.courtyardPreview
                ? Math.min(this.game.home.homeScene!.node.position.y, coveredHeight)
                : undefined;
            if (previewFrom !== undefined) {
                this.game.home.homeScene!.node.setPosition(0, previewFrom);
                this.game.courtyard.courtyardNode!.setPosition(0, previewFrom);
            }
            this.drawerMotion = {
                node: this.drawerSheet,
                from: this.drawerSheet.position.y,
                to,
                elapsed: 0,
                closing: true,
                previewFrom,
            };
        } else this.closeModal();
    }

    openDrawer(title: string, subtitle: string, height: number) {
        this.game.preview.clearPreview();
        this.closeModal();
        const n = this.game.ui.node2d('Bottom drawer', this.game.lifecycle.root);
        this.modal = n;
        const mask = this.game.ui.node2d(
                'Drawer mask',
                n,
                0,
                0,
                this.game.lifecycle.screenWidth,
                this.game.lifecycle.screenHeight,
            ),
            veil = mask.addComponent(Graphics);
        this.drawerVeil = mask.addComponent(UIOpacity);
        veil.fillColor = new Color(0, 0, 0, 46);
        veil.rect(
            -this.game.lifecycle.screenWidth / 2,
            -this.game.lifecycle.screenHeight / 2,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
        );
        veil.fill();
        mask.on(Node.EventType.TOUCH_END, () => this.dismissOverlay());
        const sheet = this.game.ui.node2d(
            'Drawer sheet',
            n,
            0,
            -this.game.lifecycle.screenHeight,
            this.game.lifecycle.screenWidth,
            height + 120,
        );
        this.drawerSheet = sheet;
        this.modalStatusY = -height / 2 + 20;
        const g = this.game.ui.graphics(sheet);
        this.game.ui.box(g, 0, -15, this.game.lifecycle.screenWidth, height + 90, 40, ISLAND.card);
        // Extend the bottom beyond the viewport; only top corners remain visible.
        g.fillColor = color(ISLAND.card);
        g.rect(
            -this.game.lifecycle.screenWidth / 2,
            -height / 2 - 60,
            this.game.lifecycle.screenWidth,
            70,
        );
        g.fill();
        this.game.ui.box(g, 0, height / 2 + 7, 76, 7, 3.5, '#C4B89E');
        this.game.ui.text(sheet, title, 0, height / 2 - 52, 34, INK, 530).isBold = false;
        this.drawerSubtitle = this.game.ui.text(
            sheet,
            subtitle,
            0,
            height / 2 - 124,
            26,
            MUTED,
            500,
        );
        const close = this.game.ui.node2d(
            'Close drawer',
            sheet,
            310,
            height / 2 - 49,
            this.game.lifecycle.touchSize,
            this.game.lifecycle.touchSize,
        );
        this.game.ui.text(close, '×', 0, 0, 38, MUTED, 64);
        close.on(Node.EventType.TOUCH_END, () => this.dismissOverlay());
        sheet.on(Node.EventType.TOUCH_START, (e?: { propagationStopped: boolean }) => {
            if (e) e.propagationStopped = true;
        });
        sheet.on(Node.EventType.TOUCH_END, (e?: { propagationStopped: boolean }) => {
            if (e) e.propagationStopped = true;
        });
        const handle = this.game.ui.node2d(
            'Drawer handle',
            sheet,
            0,
            height / 2 + 7,
            220,
            this.game.lifecycle.touchSize,
        );
        handle.on(
            Node.EventType.TOUCH_END,
            (e?: {
                getUILocation: () => {
                    y: number;
                };
                getUIStartLocation: () => {
                    y: number;
                };
            }) => {
                if (e && e.getUIStartLocation().y - e.getUILocation().y > 45) this.dismissOverlay();
            },
        );
        this.drawerMotion = {
            node: sheet,
            from: -this.game.lifecycle.screenHeight,
            to: -this.game.lifecycle.screenHeight / 2 + height / 2 + 60,
            elapsed: 0,
            closing: false,
        };
        if (this.game.notices.notification)
            this.game.notices.notification.node.setSiblingIndex(999);
        this.game.cloudStatus.refreshCloudStatus();
        return sheet;
    }

    openModal(title: string, subtitle: string, height = 500) {
        this.game.preview.clearPreview();
        this.closeModal();
        const n = this.game.ui.node2d(
            'Dialog',
            this.game.lifecycle.root,
            0,
            0,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
        );
        this.modal = n;
        this.modalStatusY = -height / 2 + 20;
        const veil = n.addComponent(Graphics);
        veil.fillColor = new Color(61, 52, 40, 145);
        veil.rect(
            -this.game.lifecycle.screenWidth / 2,
            -this.game.lifecycle.screenHeight / 2,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
        );
        veil.fill();
        n.on(Node.EventType.TOUCH_START, (e: { propagationStopped: boolean }) => {
            e.propagationStopped = true;
        });
        n.on(Node.EventType.TOUCH_END, (e: { propagationStopped: boolean }) => {
            e.propagationStopped = true;
        });
        islandModal(veil, 650, height);
        this.game.ui.text(n, title, 0, height / 2 - 64, 34, INK, 560).isBold = false;
        this.game.ui.text(n, subtitle, 0, height / 2 - 119, 25, MUTED, 560);
        this.game.cloudStatus.refreshCloudStatus();
        return n;
    }

    closeModal() {
        if (this.game.cloud.cloudCancellable) {
            this.game.cloud.cloudRequest++;
            this.game.cloud.cloudBusy = false;
            this.game.cloud.cloudCancellable = false;
            this.game.cloud.cloudRetry = null;
            this.game.cloud.cloudMessage = '';
        }
        this.game.boosts.rewardAdDemo = null;
        this.drawerMotion = null;
        this.drawerSheet = null;
        this.drawerVeil = null;
        this.game.shop.courtyardShopContent = null;
        this.game.shop.nestShopContent = null;
        this.drawerSubtitle = null;
        this.game.victory.celebration = null;
        if (this.modal) {
            this.modal.destroy();
            this.modal = null;
        }
        this.game.courtyard.courtyardPreview = undefined;
        this.game.courtyard.refreshCourtyard();
        this.game.cloudStatus.refreshCloudStatus();
    }
}
