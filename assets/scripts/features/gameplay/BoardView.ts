import { Color, Graphics, Label, Node, Sprite } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color, GREEN, INK, MUTED, PAPER } from '../../presentation/gameVisuals';
import { GRID_HEIGHT, PALETTE } from '../../domain/levels/levels';
import { SKINS } from '../../domain/profile/profile';
import {
    BOARD_LEFT,
    BOARD_TOP,
    CELL_SIZE,
    COLLECTION_SLOT_Y,
    EXTRA_SLOT_X,
    EXTRA_SLOT_Y,
    NEST,
} from '../../presentation/boardLayout';
import { drawAnt, drawBoardPixel } from '../../presentation/gardenDrawing';
import { islandPanel } from '../../presentation/islandTheme';

/** Builds the playfield and redraws only changed pixel rows. */
export class BoardView {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            | 'ui'
            | 'lifecycle'
            | 'boosts'
            | 'preview'
            | 'overlays'
            | 'home'
            | 'assets'
            | 'profile'
            | 'session'
        >,
    ) {}
    layout() {
        const bg = this.game.ui.graphics(this.game.lifecycle.gameRoot, 'Background');
        this.game.ui.box(
            bg,
            0,
            0,
            this.game.lifecycle.screenWidth,
            this.game.lifecycle.screenHeight,
            0,
            '#EEF0DD',
        );
        const wallpaper = this.game.ui
            .node2d(
                'garden-background',
                bg.node,
                0,
                0,
                this.game.lifecycle.screenWidth,
                this.game.lifecycle.screenHeight,
            )
            .addComponent(Sprite);
        wallpaper.sizeMode = Sprite.SizeMode.CUSTOM;
        this.traySprites.push(wallpaper);
        // Keep all interactive header controls below the WeChat capsule row.
        this.game.ui.gearButton(this.game.lifecycle.gameRoot, -300, 670);
        this.levelLabel = this.game.ui.text(
            this.game.lifecycle.gameRoot,
            '',
            -177,
            670,
            30,
            GREEN,
            140,
        );
        this.levelLabel.color = color(INK);
        this.speedLabel = this.game.ui.button(
            this.game.lifecycle.gameRoot,
            '1×',
            -54,
            670,
            100,
            56,
            PAPER,
            () => this.game.boosts.requestSpeed(),
        );
        this.speedLabel.node.setPosition(-13, 1);
        this.speedLabel.fontSize = 24;
        this.speedLabel.enableOutline = false;
        this.speedLabel.color = color('#73573D');
        const speedVideo = this.game.ui.graphics(this.speedLabel.node.parent!, 'Speed video mark');
        this.speedVideo = speedVideo.node;
        speedVideo.fillColor = color('#907653');
        speedVideo.moveTo(25, -7);
        speedVideo.lineTo(36, 0);
        speedVideo.lineTo(25, 7);
        speedVideo.close();
        speedVideo.fill();
        // Enlarge the board and trays together around the board's top edge.
        // Local pixel/flight coordinates stay shared, while the removed action
        // row's space is used by the game rather than left empty at the bottom.
        this.playfield = this.game.ui.node2d('Playfield', this.game.lifecycle.gameRoot);
        const scale = Math.min(
            1.09,
            (this.game.lifecycle.screenHeight / 2 - 32 + 626) / (626 + 606),
        );
        this.playfield.setScale(scale, scale, 1);
        const bottom = 606 * scale + 626 * (scale - 1);
        const down = Math.min(40, Math.max(0, this.game.lifecycle.screenHeight / 2 - bottom - 32));
        this.playfield.setPosition(0, 626 * (1 - scale) - down);
        const frame = this.game.ui.graphics(this.playfield, 'Artwork frame');
        islandPanel(frame, 0, 235, 632, 782, PAPER);
        this.game.ui.box(frame, 0, 243, 604, 750, 16, '#D4C9B4');
        for (let row = 0; row < GRID_HEIGHT; row++)
            this.boardRows.push(this.game.ui.graphics(this.playfield, 'Pixel row ' + row));
        for (let row = 0; row < GRID_HEIGHT; row++)
            this.game.preview.hintRows.push(
                this.game.ui.graphics(this.playfield, 'Whole picture highlight ' + row),
            );
        this.nestArt = this.game.ui.graphics(this.playfield, 'Shared ant nest');
        // Opening centre is (46,22) inside the 104×60 sprite, not its midpoint.
        this.nestSprite = this.game.ui
            .node2d('Wooden delivery entrance', this.nestArt.node, NEST.x + 6, NEST.y - 8, 104, 60)
            .addComponent(Sprite);
        this.nestSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.drawNest();
        this.woodTray('Collection tray', COLLECTION_SLOT_Y, 144);
        this.jars = this.game.ui.node2d('Slots', this.playfield);
        this.woodTray('Container shelf', -482, 224);
        const acorn = this.game.ui
            .node2d('acorn', this.playfield, 292, -554, 104, 85)
            .addComponent(Sprite);
        acorn.sizeMode = Sprite.SizeMode.CUSTOM;
        this.traySprites.push(acorn);
        // Transient feedback shares the header; the shelf has no permanent caption row.
        this.queueCount = this.game.ui.text(
            this.game.lifecycle.gameRoot,
            '',
            170,
            670,
            25,
            MUTED,
            300,
        );
        this.queue = this.game.ui.node2d('Containers', this.playfield);
        this.expansionBoard = this.game.ui.node2d(
            'Unlock extra collection slot',
            this.playfield,
            EXTRA_SLOT_X,
            EXTRA_SLOT_Y,
            110,
            this.game.lifecycle.touchSize / scale,
        );
        const expansion = this.expansionBoard.addComponent(Graphics);
        this.game.ui.box(expansion, 0, -4, 94, 58, 16, '#C9AF83');
        this.game.ui.box(expansion, 0, 0, 94, 58, 16, '#F8F4E5');
        expansion.strokeColor = color('#DEC79F');
        expansion.lineWidth = 2;
        expansion.roundRect(-46, -28, 92, 56, 15);
        expansion.stroke();
        expansion.fillColor = color('#9B805B');
        expansion.roundRect(-11, 6, 22, 4, 2);
        expansion.fill();
        expansion.roundRect(-2, -3, 4, 22, 2);
        expansion.fill();
        // Small video mark explains the unlock.
        expansion.strokeColor = color('#9B805B');
        expansion.lineWidth = 1.5;
        expansion.roundRect(-13, -23, 26, 14, 4);
        expansion.stroke();
        expansion.fillColor = color('#9B805B');
        expansion.moveTo(-3, -20);
        expansion.lineTo(5, -16);
        expansion.lineTo(-3, -12);
        expansion.close();
        expansion.fill();
        this.expansionBoard.on(Node.EventType.TOUCH_START, () =>
            this.expansionBoard.setScale(0.96, 0.96, 1),
        );
        this.expansionBoard.on(Node.EventType.TOUCH_CANCEL, () =>
            this.expansionBoard.setScale(1, 1, 1),
        );
        this.expansionBoard.on(Node.EventType.TOUCH_END, () => {
            this.expansionBoard.setScale(1, 1, 1);
            if (!this.game.overlays.modal && !this.game.home.home && !this.game.lifecycle.paused)
                this.game.boosts.requestSlotExpansion();
        });
        this.effects = this.game.ui.graphics(this.playfield, 'Ant couriers');
    }

    woodTray(name: string, y: number, height: number) {
        const shadow = this.game.ui.graphics(this.playfield, name);
        for (let layer = 5; layer >= 1; layer--) {
            shadow.fillColor = new Color(115, 79, 36, 9);
            shadow.roundRect(
                -337 - layer,
                y - height / 2 - 4 - layer * 2,
                674 + layer * 2,
                height + layer * 2,
                60,
            );
            shadow.fill();
        }
        const sprite = this.game.ui
            .node2d('wood', shadow.node, 0, y, 674, height)
            .addComponent(Sprite);
        sprite.type = Sprite.Type.SLICED;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.traySprites.push(sprite);
    }

    drawNest() {
        const g = this.nestArt;
        g.clear();
        if (this.game.assets.nestFrames.length) {
            this.nestSprite.spriteFrame =
                this.game.assets.nestFrames[
                    SKINS.findIndex((s) => s.id === this.game.profile.save.nest)
                ];
            return;
        }
        const skin = SKINS.find((s) => s.id === this.game.profile.save.nest)!;
        g.fillColor = new Color(48, 38, 25, 45);
        g.ellipse(3, NEST.y - 6, 34, 18);
        g.fill();
        g.fillColor = color(skin.rim);
        g.ellipse(0, NEST.y, 31, 18);
        g.fill();
        g.fillColor = color(skin.light);
        g.ellipse(-1, NEST.y + 3, 28, 15);
        g.fill();
        g.fillColor = color('#73573D');
        g.ellipse(0, NEST.y + 2, 22, 12);
        g.fill();
        g.fillColor = color('#2E241C');
        g.ellipse(0, NEST.y, 18, 9);
        g.fill();
    }

    drawBoard(rows?: Set<number>) {
        const { width, height } = this.game.session.model.level;
        for (let row = 0; row < height; row++) {
            if (rows && !rows.has(row)) continue;
            const g = this.boardRows[row];
            g.clear();
            for (let column = 0; column < width; column++) {
                const c = this.game.session.model.pixels[row * width + column];
                if (c < 0) continue;
                const bottomExposed =
                    row === height - 1 ||
                    this.game.session.model.pixels[(row + 1) * width + column] < 0;
                const rightExposed =
                    column === width - 1 ||
                    this.game.session.model.pixels[row * width + column + 1] < 0;
                this.boardPixel(
                    g,
                    BOARD_LEFT + column * CELL_SIZE,
                    BOARD_TOP - row * CELL_SIZE,
                    PALETTE[c],
                    bottomExposed,
                    rightExposed,
                );
            }
        }
    }

    boardPixel(
        g: Graphics,
        x: number,
        top: number,
        hex: string,
        bottomExposed = true,
        rightExposed = true,
    ) {
        drawBoardPixel(g, x, top, hex, bottomExposed, rightExposed);
    }

    drawAnt(
        g: Graphics,
        x: number,
        y: number,
        angle: number,
        time: number,
        scale: number,
        bodyColor = '#493626',
    ) {
        drawAnt(g, x, y, angle, time, scale, bodyColor);
    }

    nestArt!: Graphics;

    nestSprite!: Sprite;

    boardRows: Graphics[] = [];

    effects!: Graphics;

    playfield!: Node;

    jars!: Node;

    queue!: Node;

    queueCount!: Label;

    speedLabel!: Label;

    speedVideo!: Node;

    expansionBoard!: Node;

    levelLabel!: Label;

    dirtyRows = new Set<number>();

    traySprites: Sprite[] = [];
}
