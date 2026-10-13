import { Color } from 'cc';

import type { Graphics } from 'cc';

import { CELL_SIZE } from './boardLayout';

// Shared by the board, carried pixels and the offline atlas generator.
const color = (hex: string) => new Color(hex);

// Graphics copies fill colors; immutable swatches can be shared by every cell.
const boardColors = new Map<string, Color[]>();

export function drawBoardPixel(g: Graphics, x: number, top: number, hex: string, bottomExposed = true, rightExposed = true) {
    let paints = boardColors.get(hex);
    if (!paints) {
        const c = color(hex);
        const shade = (factor: number) => new Color(Math.round(c.r * factor), Math.round(c.g * factor), Math.round(c.b * factor), 255);
        const light = (amount: number) => new Color(Math.round(c.r + (255 - c.r) * amount), Math.round(c.g + (245 - c.g) * amount), Math.round(c.b + (218 - c.b) * amount), 255);
        paints = [c, shade(.78), shade(.64), shade(.74), light(.23), light(.14), light(.07), light(.03), light(.33), shade(.90)];
        boardColors.set(hex, paints);
    }
    // D: packed sugar-cube tops with a wide, softly lit bevel. Empty neighbors
    // expose the full vertical wall; occupied neighbors never reveal a gutter.
    const unit = CELL_SIZE / 20;
    const left = x, upper = top, size = CELL_SIZE;
    const bottom = upper - size, height = 5 * unit;
    const capWidth = size - 1.6 * unit, capHeight = size - 2.75 * unit;
    if (bottomExposed) {
        g.fillColor = new Color(82, 62, 36, 38);
        g.roundRect(left + unit, bottom - height - 1.5 * unit, size, 2 * unit, unit);
        g.fill();
        g.fillColor = paints[2];
        g.roundRect(left, bottom - height, size, height + 2 * unit, unit);
        g.fill();
    }
    if (rightExposed) {
        g.fillColor = paints[3];
        g.roundRect(left + size - unit, bottom - (bottomExposed ? height : 0), 2 * unit, size - 2 * unit + (bottomExposed ? height : 0), .5 * unit);
        g.fill();
    }
    g.fillColor = paints[1];
    g.rect(left, bottom, size, size);
    g.fill();
    const capLeft = left + .15 * unit, capTop = upper - .1 * unit;
    g.fillColor = paints[4];
    g.roundRect(capLeft, capTop - capHeight, capWidth, capHeight, 1.1 * unit);
    g.fill();
    // Small nested bands approximate the proposal's gradient using Cocos
    // Graphics, so the board and the baked carried block use identical artwork.
    for (let band = 0; band < 4; band++) {
        const offset = capHeight * [.16, .31, .53, .75][band];
        g.fillColor = paints[[5, 6, 7, 0][band]];
        g.roundRect(capLeft, capTop - capHeight, capWidth, capHeight - offset, Math.min(.65 * unit, (capHeight - offset) / 2));
        g.fill();
    }
    g.fillColor = paints[8];
    g.rect(left + unit, upper - .95 * unit, capWidth - 2 * unit, .65 * unit);
    g.fill();
    g.fillColor = paints[9];
    g.rect(left + unit, capTop - capHeight + .1 * unit, capWidth - 2 * unit, .5 * unit);
    g.fill();
}

export function drawAnt(g: Graphics, x: number, y: number, angle: number, time: number, scale: number, bodyColor = '#493626') {
    const point = (forward: number, side: number): [number, number] => [
        x + (Math.cos(angle) * forward - Math.sin(angle) * side) * scale,
        y + (Math.sin(angle) * forward + Math.cos(angle) * side) * scale
    ];
    const line = (a: [number, number], b: [number, number]) => {
        g.moveTo(...a);
        g.lineTo(...b);
        g.stroke();
    };
    // Ground shadow is offset from the body, so the ant reads above the board.
    for (const [offset, radius] of [[-8, 7], [0, 4.5], [7, 5.5]]) {
        const p = point(offset, 0);
        g.fillColor = new Color(28, 25, 18, 65);
        g.circle(p[0] + 2 * scale, p[1] - 3 * scale, radius * scale);
        g.fill();
    }
    g.strokeColor = color('#392A1F');
    g.lineWidth = 2 * scale;
    for (let leg = 0; leg < 3; leg++) {
        const stride = Math.sin(time * 25 + leg * 2.1) * 3;
        for (const side of [-1, 1]) {
            line(point(3 - leg * 4, side * 2), point(5 - leg * 5 + stride * side, side * 7));
            line(point(5 - leg * 5 + stride * side, side * 7), point(2 - leg * 5 + stride * side, side * 10));
        }
    }
    for (const [offset, radius] of [[-8, 6], [0, 4], [7, 5]]) {
        const p = point(offset, 0);
        g.fillColor = color(bodyColor);
        g.circle(p[0], p[1], radius * scale);
        g.fill();
    }
    for (const side of [-1, 1])
        line(point(8, side * 2), point(13, side * 5));
    const shine = point(-8, -1);
    g.fillColor = new Color(255, 255, 255, 130);
    g.circle(shine[0], shine[1], 1.8 * scale);
    g.fill();
    g.strokeColor = color('#231C16');
    g.lineWidth = 1.6 * scale;
    line(point(9, -3), point(12, -3));
    line(point(9, 3), point(12, 3));
}
