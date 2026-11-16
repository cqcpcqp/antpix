import { Graphics, Node } from 'cc';
import { color } from './gameVisuals';
import { ISLAND } from './islandTheme';

export const PODIUM = [
    { fill: '#F9DB8B', light: '#FFF3C6', edge: '#D5A044', shadow: '#C7A05A', ribbon: '#E9B85D' },
    { fill: '#E8ECE4', light: '#FFFFFF', edge: '#ACB7AC', shadow: '#A8B1A3', ribbon: '#AFBCAC' },
    { fill: '#F2D1AF', light: '#FFF0DA', edge: '#C29268', shadow: '#BD916E', ribbon: '#D9A17A' },
] as const;

/** Soft layered surfaces and highlights echo the existing island buttons without extra textures. */
export function rankingPlaque(g: Graphics, w: number, h: number, rank: number, self: boolean) {
    const tone = PODIUM[rank - 1];
    const radius = Math.min(28, h / 3);
    g.fillColor = color(tone.shadow);
    g.roundRect(-w / 2, -h / 2 - 5, w, h, radius);
    g.fill();
    g.fillColor = color(tone.fill);
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    g.strokeColor = color(tone.edge);
    g.lineWidth = 2;
    g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius);
    g.stroke();
    g.strokeColor = color(tone.light);
    g.lineWidth = 2;
    g.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, radius - 4);
    g.stroke();
    g.fillColor = color(tone.light);
    g.roundRect(-w / 2 + 12, h / 2 - 13, w - 24, 4, 2);
    g.fill();
    if (self) {
        g.strokeColor = color(ISLAND.tealBack);
        g.lineWidth = 2;
        g.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, radius);
        g.stroke();
    }
}

export function rankingMedal(g: Graphics, rank: number, radius: number) {
    const tone = PODIUM[rank - 1];
    g.fillColor = color(tone.ribbon);
    for (const side of [-1, 1]) {
        g.moveTo(side * 3, -radius * 0.5);
        g.lineTo(side * radius, -radius * 1.65);
        g.lineTo(side * radius * 0.45, -radius * 1.5);
        g.lineTo(side * radius * 0.2, -radius * 1.8);
        g.lineTo(-side * radius * 0.15, -radius * 0.6);
        g.close();
        g.fill();
    }
    g.fillColor = color(tone.shadow);
    g.circle(0, -2, radius + 2);
    g.fill();
    g.fillColor = color(tone.fill);
    g.circle(0, 0, radius);
    g.fill();
    g.strokeColor = color(tone.edge);
    g.lineWidth = 2;
    g.circle(0, 0, radius - 3);
    g.stroke();
    g.strokeColor = color(tone.light);
    g.lineWidth = 1.5;
    g.circle(0, 1, radius - 6);
    g.stroke();
}

/** Elliptical leaf pairs are individual nodes so their highlights rotate with each leaf. */
export function rankingLaurel(radius: number, leaf: (name: string) => Node) {
    for (const side of [-1, 1])
        for (let i = 0; i < 7; i++) {
            const angle = ((-75 + i * 23) * Math.PI) / 180;
            const n = leaf('Laurel leaf');
            n.setPosition(side * Math.cos(angle) * radius, Math.sin(angle) * radius);
            n.angle = side * (i * 17 - 42);
            const g = n.addComponent(Graphics);
            g.fillColor = color('#71934A');
            g.ellipse(0, -1.5, radius * 0.09, radius * 0.18);
            g.fill();
            g.fillColor = color(i % 2 ? '#B4C86B' : '#9BB85B');
            g.ellipse(0, 0, radius * 0.08, radius * 0.17);
            g.fill();
            g.strokeColor = color('#D4DF99');
            g.lineWidth = 1.2;
            g.moveTo(0, -radius * 0.12);
            g.lineTo(0, radius * 0.12);
            g.stroke();
        }
}
