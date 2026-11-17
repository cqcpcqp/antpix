import { Node } from 'cc';
import type { GardenRuntime } from '../../app/GardenRuntime';
import { color } from '../../presentation/gameVisuals';

/** Warm neutral geometry reserves card/row space without inventing player data. */
export function leaderboardSkeleton(game: Pick<GardenRuntime, 'ui'>, parent: Node) {
    const g = game.ui.graphics(parent, 'Leaderboard skeleton');
    const fill = '#E9DFC8';
    const line = '#DDD0B6';
    game.ui.box(g, 0, 382, 620, 174, 35, '#F4E6BF');
    for (const x of [-146, 146]) game.ui.box(g, x, 202, 278, 138, 26, '#EEE4D0');
    const portrait = (x: number, y: number, radius: number) => {
        g.fillColor = color(line);
        g.circle(x, y, radius);
        g.fill();
    };
    portrait(-170, 382, 64);
    game.ui.box(g, 78, 400, 170, 22, 11, line);
    game.ui.box(g, 78, 347, 120, 30, 12, line);
    for (const x of [-146, 146]) {
        portrait(x - 83, 202, 43);
        game.ui.box(g, x + 44, 224, 96, 16, 8, line);
        game.ui.box(g, x + 44, 180, 76, 20, 10, line);
    }
    for (let i = 0; i < 7; i++) {
        const y = 80 - i * 72;
        portrait(-202, y, 31);
        game.ui.box(g, -32, y, 204, 20, 10, fill);
        game.ui.box(g, 220, y, 74, 20, 10, fill);
    }
}
