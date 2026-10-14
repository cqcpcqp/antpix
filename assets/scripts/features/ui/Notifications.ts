import { Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, INK, MUTED } from '../../presentation/gameVisuals';
import { ISLAND } from '../../presentation/islandTheme';

/** Owns transient notifications. */
export class Notifications {
    constructor(private readonly game: Pick<GardenRuntime, 'ui' | 'lifecycle'>) {}
    notification: {
        node: Node;
        elapsed: number;
    } | null = null;

    notify(title: string, description: string, type: 'info' | 'success' | 'warning' = 'info') {
        if (this.notification) {
            this.notification.node.active = false;
            this.notification.node.destroy();
        }
        const n = this.game.ui.node2d('Notification', this.game.lifecycle.root, 0, 610, 650, 112),
            g = this.game.ui.graphics(n);
        const styles = {
            info: ['#ECF9F6', '#19C8B9', '#C2ECE6', 'i'],
            success: ['#F5FAE9', '#6FBA2C', '#D8EFC1', '✓'],
            warning: ['#FDF6D9', '#F5C31C', '#FBEAA1', '!'],
        };
        const [bg, border, icon, symbol] = styles[type];
        this.game.ui.box(g, 0, -5, 650, 112, 28, ISLAND.shadow);
        this.game.ui.box(g, 0, 0, 650, 112, 28, bg);
        g.strokeColor = color(border);
        g.lineWidth = 3;
        g.roundRect(-324, -55, 648, 110, 27);
        g.stroke();
        g.fillColor = color(icon);
        g.circle(-270, 0, 27);
        g.fill();
        g.strokeColor = color(
            type === 'success' ? '#5A9E1E' : type === 'warning' ? '#B88A06' : '#11A89B',
        );
        g.lineWidth = 4;
        if (type === 'success') {
            g.moveTo(-282, 0);
            g.lineTo(-273, -9);
            g.lineTo(-257, 11);
            g.stroke();
        } else this.game.ui.text(n, symbol, -270, 0, 30, INK, 48).isBold = false;
        this.game.ui.text(n, title, -2, 23, 26, INK, 460).isBold = false;
        this.game.ui.text(n, description, -2, -19, 21, MUTED, 460);
        const close = this.game.ui.node2d('Dismiss notification', n, 281, 0, 62, 80);
        this.game.ui.text(close, '×', 0, 0, 32, MUTED, 60);
        close.on(Node.EventType.TOUCH_END, () => {
            if (this.notification?.node === n) {
                n.active = false;
                n.destroy();
                this.notification = null;
            }
        });
        n.on(Node.EventType.TOUCH_START, (e?: { propagationStopped: boolean }) => {
            if (e) e.propagationStopped = true;
        });
        n.on(Node.EventType.TOUCH_END, (e?: { propagationStopped: boolean }) => {
            if (e) e.propagationStopped = true;
        });
        this.notification = { node: n, elapsed: 0 };
    }
}
