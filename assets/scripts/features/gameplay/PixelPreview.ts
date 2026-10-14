import { Color, Graphics, Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color } from '../../presentation/gameVisuals';
import { GRID_HEIGHT } from '../../domain/levels/levels';
import { BOARD_LEFT, BOARD_TOP, CELL_SIZE } from '../../presentation/boardLayout';
import type { HoldPreview } from '../../presentation/gameVisuals';

/** Owns press-and-hold highlighting independently of board pixels. */
export class PixelPreview {
    constructor(
        private readonly game: Pick<
            GardenRuntime,
            'overlays' | 'home' | 'session' | 'lifecycle' | 'cloud' | 'queue' | 'layout'
        >,
    ) {}
    beginPreview(node: Node, c: number, valid: () => boolean) {
        if (
            this.hold ||
            this.game.overlays.modal ||
            this.game.home.home ||
            this.game.session.won ||
            this.game.lifecycle.paused ||
            this.game.cloud.cloudBusy
        )
            return;
        this.hold = { node, color: c, elapsed: 0, shown: false, valid };
    }

    movePreview(
        node: Node,
        e: {
            getUILocation: () => {
                x: number;
                y: number;
            };
            getUIStartLocation: () => {
                x: number;
                y: number;
            };
        },
    ) {
        if (this.hold?.node !== node) return;
        const p = e.getUILocation(),
            start = e.getUIStartLocation();
        if (Math.hypot(p.x - start.x, p.y - start.y) > 18) {
            node.setScale(1, 1, 1);
            this.clearPreview();
        }
    }

    endPreview(node: Node): boolean {
        if (this.hold?.node !== node) return true;
        const suppress = this.hold.shown || !this.hold.valid();
        this.clearPreview();
        return suppress;
    }

    clearPreview() {
        for (const card of this.game.queue.cardViews) this.game.queue.resetCardMotion(card);
        if (this.hold) this.hold.node.setScale(1, 1, 1);
        this.hold = null;
        this.hintCounts.fill(0);
        this.hintRows.forEach((g) => g.clear());
        if (this.game.layout.queueCount)
            this.game.layout.queueCount.string = this.game.queue.queueCaption();
    }

    updatePreview(dt: number) {
        const hold = this.hold;
        if (!hold) return;
        if (!hold.valid()) {
            this.clearPreview();
            return;
        }
        hold.elapsed += dt;
        if (hold.elapsed < 0.28) return;
        if (!hold.shown) {
            hold.shown = true;
            this.drawPreview();
        }
    }

    drawPreview(rows?: Set<number>) {
        const hold = this.hold;
        if (!hold?.shown) return;
        const { width, height } = this.game.session.model.level;
        // Reuse row geometry: a full-board preview is built once, then only rows
        // changed by actual pickups are redrawn. No full-board scan each frame.
        for (let row = 0; row < height; row++) {
            if (rows && !rows.has(row)) continue;
            const g = this.hintRows[row];
            g.clear();
            let count = 0;
            for (let col = 0; col < width; col++) {
                if (this.game.session.model.pixels[row * width + col] !== hold.color) continue;
                count++;
                const x = BOARD_LEFT + col * CELL_SIZE,
                    y = BOARD_TOP - row * CELL_SIZE;
                g.fillColor = new Color(255, 249, 204, 65);
                g.rect(x, y - CELL_SIZE, CELL_SIZE, CELL_SIZE);
                g.fill();
                g.strokeColor = color('#294C43');
                g.lineWidth = 3;
                g.roundRect(x - 0.3, y - CELL_SIZE + 0.3, CELL_SIZE, CELL_SIZE, 2);
                g.stroke();
                g.strokeColor = color('#FFF3BC');
                g.lineWidth = 1.5;
                g.roundRect(x - 0.3, y - CELL_SIZE + 0.3, CELL_SIZE, CELL_SIZE, 2);
                g.stroke();
            }
            this.hintCounts[row] = count;
        }
        const count = this.hintCounts.reduce((sum, n) => sum + n, 0);
        this.game.queue.fullFeedback = 0;
        this.game.layout.queueCount.string = count ? `同色 ${count} 块` : '同色已收集完';
    }

    hintRows: Graphics[] = [];

    hintCounts: number[] = Array(GRID_HEIGHT).fill(0);

    hold: HoldPreview | null = null;
}
