import { BitmapFont, Font, Graphics, Label, Layers, Node, UITransform } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, GREEN, INK, PAPER } from '../../presentation/gameVisuals';
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
        useSystemFont = false,
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
        if (useSystemFont) {
            l.useSystemFont = true;
            this.systemFontLabels.add(l);
        } else if (this.gameFont) l.font = this.gameFont;
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
        this.homeIconPress(button, () => this.game.settings.settings());
    }

    /** Draw a thumb rather than a font glyph so its appearance is stable on WeChat. */
    recommendationButton(parent: Node, x: number, y: number, callback: () => void) {
        const button = this.node2d(
            'Recommend game',
            parent,
            x,
            y,
            this.game.lifecycle.touchSize,
            this.game.lifecycle.touchSize,
        );
        const face = button.addComponent(Graphics);
        islandPanel(face, 0, 0, 76, 68, PAPER);
        // Centre the asymmetric thumb and leave padding inside the unchanged button face.
        const icon = this.node2d('Recommendation icon', button, 0, -4.5, 60, 60);
        icon.setScale(0.75, 0.75, 1);
        // Keep the badge on the button so it disappears with the one-time entry.
        face.fillColor = color(PAPER);
        face.circle(29, 26, 10);
        face.fill();
        face.fillColor = color('#F05252');
        face.circle(29, 26, 8);
        face.fill();
        const g = icon.addComponent(Graphics);
        g.fillColor = color(GREEN);
        g.roundRect(-23, -19, 10, 29, 3);
        g.fill();
        g.moveTo(-9, -18);
        for (const [px, py] of [
            [17, -18],
            [23, 6],
            [21, 12],
            [5, 12],
            [8, 26],
            [5, 31],
            [0, 31],
            [-5, 16],
            [-9, 10],
        ])
            g.lineTo(px, py);
        g.close();
        g.fill();
        this.homeIconPress(button, callback);
        return button;
    }

    /** Match the other home controls with a padded, font-independent collection star. */
    favoriteButton(parent: Node, x: number, y: number, callback: () => void) {
        const button = this.node2d(
            'Favorite game',
            parent,
            x,
            y,
            this.game.lifecycle.touchSize,
            this.game.lifecycle.touchSize,
        );
        const g = button.addComponent(Graphics);
        islandPanel(g, 0, 0, 76, 68, PAPER);
        g.fillColor = color(GREEN);
        for (let i = 0; i < 10; i++) {
            const angle = Math.PI / 2 + (i * Math.PI) / 5;
            const radius = i % 2 === 0 ? 22 : 10;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius - 2;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }
        g.close();
        g.fill();
        this.homeIconPress(button, callback);
        return button;
    }

    /** A conversation bubble identifies the game community without adding a text label. */
    gameClubButton(parent: Node, x: number, y: number, callback: () => void) {
        const button = this.node2d(
            'Game club',
            parent,
            x,
            y,
            this.game.lifecycle.touchSize,
            this.game.lifecycle.touchSize,
        );
        const g = button.addComponent(Graphics);
        islandPanel(g, 0, 0, 76, 68, PAPER);
        g.fillColor = color(GREEN);
        g.roundRect(-23, -13, 46, 32, 10);
        g.fill();
        g.moveTo(-12, -10);
        g.lineTo(-15, -22);
        g.lineTo(1, -12);
        g.close();
        g.fill();
        g.fillColor = color(PAPER);
        for (const dotX of [-12, 0, 12]) {
            g.circle(dotX, 3, 3);
            g.fill();
        }
        this.homeIconPress(button, callback);
        return button;
    }

    shareButton(parent: Node, x: number, y: number, callback: () => void) {
        const size = this.game.lifecycle.touchSize;
        const button = this.node2d('Share courtyard', parent, x, y, size, size);
        const art = button.addComponent(Graphics);
        islandPanel(art, 0, 0, 76, 68, PAPER);
        art.strokeColor = color(GREEN);
        art.lineWidth = 6;
        art.moveTo(17, 15);
        art.lineTo(-16, 0);
        art.lineTo(17, -15);
        art.stroke();
        art.fillColor = color(GREEN);
        for (const [px, py] of [
            [17, 15],
            [-16, 0],
            [17, -15],
        ])
            art.circle(px, py, 7);
        art.fill();
        this.homeIconPress(button, callback);
        return button;
    }

    private homeIconPress(button: Node, callback: () => void) {
        button.on(Node.EventType.TOUCH_START, () => button.setScale(0.94, 0.94, 1));
        button.on(Node.EventType.TOUCH_CANCEL, () => button.setScale(1, 1, 1));
        button.on(Node.EventType.TOUCH_END, () => {
            button.setScale(1, 1, 1);
            this.game.audio.play('tap');
            callback();
        });
    }

    gameFont: Font | null = null;

    // System typography must survive the asynchronous application of the game font.
    readonly systemFontLabels = new WeakSet<Label>();

    containerFont: BitmapFont | null = null;

    containerLabels = new Set<Label>();
}
