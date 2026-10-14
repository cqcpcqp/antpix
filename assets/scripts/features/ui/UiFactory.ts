import { BitmapFont, Font, Graphics, Label, Layers, Node, UITransform } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, GREEN, INK, PAPER } from '../../presentation/gameVisuals';
import { makeLevel, PALETTE } from '../../domain/levels/levels';
import { ISLAND, islandPanel } from '../../presentation/islandTheme';

/** Creates shared UI primitives; owns font application. */
export class UiFactory {
    constructor(private readonly game: Pick<GardenRuntime, 'lifecycle' | 'audio' | 'settings'>) {}
    node2d(name: string, parent: Node, x = 0, y = 0, w = 750, h = 1500) {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        n.parent = parent;
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    graphics(parent: Node, name = 'Art') {
        return this.node2d(name, parent).addComponent(Graphics);
    }

    box(g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: string) {
        g.fillColor = color(fill);
        g.roundRect(x - w / 2, y - h / 2, w, h, r);
        g.fill();
    }

    text(
        parent: Node,
        value: string,
        x: number,
        y: number,
        size = 24,
        fill: string = INK,
        w = 640,
    ) {
        size = Math.max(size, this.game.lifecycle.minimumTextSize);
        const n = this.node2d('Text', parent, x, y, w, size * 1.6);
        const l = n.addComponent(Label);
        l.string = value;
        l.fontSize = size;
        l.lineHeight = size * 1.35;
        l.color = color(fill);
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.overflow = Label.Overflow.SHRINK;
        l.enableWrapText = false;
        if (this.gameFont) l.font = this.gameFont;
        l.isBold = false;
        l.enableOutline = false;
        return l;
    }

    button(
        parent: Node,
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        fill: string,
        callback: () => void,
        fg: string = INK,
    ) {
        // Enlarge the hit area without enlarging the visual face.
        const n = this.node2d(
                text,
                parent,
                x,
                y,
                Math.max(this.game.lifecycle.touchSize, w),
                Math.max(this.game.lifecycle.touchSize, h),
            ),
            g = n.addComponent(Graphics);
        const primary = fill === GREEN,
            radius = Math.min(44, h / 2);
        const face = primary ? ISLAND.teal : fill;
        this.box(g, 0, -7, w, h, radius, primary ? ISLAND.tealBack : ISLAND.shadow);
        this.box(g, 0, 0, w, h, radius, face);
        g.strokeColor = color(primary ? ISLAND.tealBack : ISLAND.border);
        g.lineWidth = 2;
        g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius - 1);
        g.stroke();
        const label = this.text(n, text, 0, 1, 28, primary ? '#245844' : fg, w - 24);
        label.isBold = false;
        // A small downward press mirrors the library's active button movement.
        n.on(Node.EventType.TOUCH_START, () => {
            n.setPosition(x, y - 3);
            n.setScale(0.98, 0.98, 1);
        });
        const release = () => {
            n.setPosition(x, y);
            n.setScale(1, 1, 1);
        };
        n.on(Node.EventType.TOUCH_CANCEL, release);
        n.on(Node.EventType.TOUCH_END, () => {
            release();
            this.game.audio.play('tap');
            callback();
        });
        return label;
    }

    gearButton(parent: Node, x: number, y: number) {
        const button = this.node2d(
            'Settings menu',
            parent,
            x,
            y,
            this.game.lifecycle.touchSize,
            this.game.lifecycle.touchSize,
        );
        const g = button.addComponent(Graphics);
        islandPanel(g, 0, 0, 76, 68, PAPER);
        g.fillColor = color(GREEN);
        for (let i = 0; i < 32; i++) {
            const angle = (i * Math.PI) / 16,
                radius = i % 4 === 0 || i % 4 === 3 ? 22 : 17;
            const px = Math.cos(angle) * radius,
                py = Math.sin(angle) * radius;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }
        g.close();
        g.fill();
        g.fillColor = color(PAPER);
        g.circle(0, 0, 8);
        g.fill();
        button.on(Node.EventType.TOUCH_START, () => button.setScale(0.94, 0.94, 1));
        button.on(Node.EventType.TOUCH_CANCEL, () => button.setScale(1, 1, 1));
        button.on(Node.EventType.TOUCH_END, () => {
            button.setScale(1, 1, 1);
            this.game.audio.play('tap');
            this.game.settings.settings();
        });
    }

    artwork(parent: Node, index: number, x: number, y: number, width: number, muted = false) {
        const level = makeLevel(index),
            step = width / level.width,
            g = this.graphics(parent, 'Artwork preview');
        for (let i = 0; i < level.pixels.length; i++) {
            const c = color(PALETTE[level.pixels[i]]);
            if (muted) {
                const gray = (c.r + c.g + c.b) / 3;
                c.r = c.g = c.b = Math.round(gray * 0.55 + 90);
            }
            g.fillColor = c;
            g.rect(
                x - width / 2 + (i % level.width) * step,
                y + (width * 1.25) / 2 - Math.floor(i / level.width) * step - step,
                step + 0.1,
                step + 0.1,
            );
            g.fill();
        }
    }

    gameFont: Font | null = null;

    containerFont: BitmapFont | null = null;

    containerLabels = new Set<Label>();
}
