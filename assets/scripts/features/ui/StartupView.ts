import {
    BlockInputEvents,
    Graphics,
    Label,
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
} from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color } from '../../presentation/gameVisuals';
import { STARTUP } from '../../presentation/startupLayout';

/** A1 startup surface; borrows home frames and never owns their resource references. */
export class StartupView {
    constructor(private readonly game: Pick<GardenRuntime, 'lifecycle' | 'ui' | 'assets'>) {}
    root: Node | null = null;
    private background!: Sprite;
    private title!: Sprite;
    private bar!: Graphics;
    private status!: Label;
    private percentage!: Label;
    private washTexture: Texture2D | null = null;
    private washFrame: SpriteFrame | null = null;

    show(retry: () => void) {
        const { screenWidth: width, screenHeight: height } = this.game.lifecycle;
        const { ui } = this.game;
        const root = ui.node2d('Unified startup', this.game.lifecycle.root, 0, 0, width, height);
        this.root = root;
        root.addComponent(BlockInputEvents);
        root.on(Node.EventType.TOUCH_END, retry);
        const ground = ui.graphics(root, 'Startup backdrop');
        ui.box(ground, 0, 0, width, height, 0, '#BFE3BF');
        this.background = ui
            .node2d('Startup landscape', root, 0, 0, width, height)
            .addComponent(Sprite);
        this.background.sizeMode = Sprite.SizeMode.CUSTOM;
        const titleWidth = Math.min(STARTUP.titleWidth, width - 104);
        this.title = ui
            .node2d(
                'Startup title',
                root,
                0,
                height * (0.5 - STARTUP.titleTopRatio),
                titleWidth,
                titleWidth / 3,
            )
            .addComponent(Sprite);
        this.title.sizeMode = Sprite.SizeMode.CUSTOM;
        this.createWash(root, width, height);
        const bottom = -height / 2;
        const barWidth = Math.min(STARTUP.barWidth, width - 184);
        this.status = ui.text(
            root,
            STARTUP.loading,
            -barWidth / 2 + 220,
            bottom + STARTUP.statusBottom,
            24,
            '#596C3F',
            440,
        );
        this.status.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.percentage = ui.text(
            root,
            '30%',
            barWidth / 2 - 52,
            bottom + STARTUP.statusBottom,
            27,
            '#506438',
            104,
        );
        this.percentage.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.bar = ui.graphics(root, 'Honey gold progress');
        ui.text(root, STARTUP.healthTitle, 0, bottom + 164, 22, '#65794C');
        ui.text(root, STARTUP.healthLines[0], 0, bottom + 127, 17, '#71805A');
        ui.text(root, STARTUP.healthLines[1], 0, bottom + 98, 17, '#71805A');
        ui.text(root, STARTUP.registration, 0, bottom + 44, 19, '#65794C');
    }

    private createWash(root: Node, width: number, height: number) {
        // A tiny texture avoids visible seams between translucent gradient strips.
        const pixels = new Uint8Array(2 * 128 * 4);
        for (let row = 0; row < 128; row++)
            for (let column = 0; column < 2; column++) {
                const offset = (row * 2 + column) * 4;
                pixels.set([244, 248, 216, Math.round(220 * (row / 127) ** 1.2)], offset);
            }
        const texture = new Texture2D();
        texture.reset({ width: 2, height: 128, format: Texture2D.PixelFormat.RGBA8888 });
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.uploadData(pixels);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = new Rect(0, 0, 2, 128);
        frame.originalSize = new Size(2, 128);
        frame.packable = false;
        this.washTexture = texture;
        this.washFrame = frame;
        const washHeight = height * 0.35;
        const sprite = this.game.ui
            .node2d('Startup footer wash', root, 0, -height / 2 + washHeight / 2, width, washHeight)
            .addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
    }

    refresh(progress: number, message: string) {
        if (!this.root) return;
        this.root.setSiblingIndex(999);
        this.background.spriteFrame = this.game.assets.homeFrame;
        this.title.spriteFrame = this.game.assets.homeTitleFrame;
        this.status.string = message;
        this.percentage.string = `${Math.floor(progress)}%`;
        const { screenWidth, screenHeight } = this.game.lifecycle;
        const width = Math.min(STARTUP.barWidth, screenWidth - 184);
        const y = -screenHeight / 2 + STARTUP.barBottom;
        const g = this.bar;
        g.clear();
        this.game.ui.box(g, 0, y - 3, width, 30, 15, '#B7C58A');
        this.game.ui.box(g, 0, y, width, 30, 15, '#FFFAE0');
        const fill = ((width - 8) * progress) / 100;
        if (fill <= 0) return;
        const x = -width / 2 + 4;
        // Horizontal slices follow a rounded silhouette, keeping both fill ends round.
        const radius = Math.min(11, fill / 2);
        for (let row = 0; row < 22; row++) {
            const dy = Math.max(0, Math.abs(row + 0.5 - 11) - (11 - radius));
            const inset = radius - Math.sqrt(Math.max(0, radius * radius - dy * dy));
            g.fillColor = color(
                `#${[255 - row, 217 - row * 2, 110 - row * 2.5]
                    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
                    .join('')}`,
            );
            g.rect(x + inset, y + 10 - row, Math.max(0, fill - inset * 2), 1.1);
            g.fill();
        }
        if (fill > 32) this.game.ui.box(g, x + fill / 2, y + 6, fill - 20, 3, 1.5, '#FFF2BD');
    }

    close() {
        if (!this.root) return;
        this.root.active = false;
        this.root.destroy();
        this.root = null;
        this.washFrame?.destroy();
        this.washTexture?.destroy();
        this.washFrame = null;
        this.washTexture = null;
    }
}
