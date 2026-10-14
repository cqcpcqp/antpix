import { Color, Graphics, Layers, Node, UIOpacity } from 'cc';
import { CourtyardColony } from '../../domain/courtyard/courtyardColony';

export class CourtyardAtmosphere {
    private veil: UIOpacity;
    private effects: Graphics;
    private root: Node;
    private lastNight = -1;
    constructor(
        parent: Node,
        private scale: number,
        width: number,
        height: number,
    ) {
        const night = new Node('Courtyard evening light');
        night.layer = Layers.Enum.UI_2D;
        night.parent = parent;

        const g = night.addComponent(Graphics);
        g.fillColor = new Color(16, 31, 76, 255);
        g.rect(-width / 2, -height / 2, width, height);
        g.fill();
        this.veil = night.addComponent(UIOpacity);
        this.veil.opacity = 0;
        this.root = new Node('Courtyard water seed and lantern light');
        this.root.layer = Layers.Enum.UI_2D;
        this.root.parent = parent;
        this.effects = this.root.addComponent(Graphics);
    }
    render(colony: CourtyardColony, hidden: boolean) {
        const target = colony.night ? 105 : 0;
        if (this.lastNight !== target) {
            this.veil.opacity = target;
            this.lastNight = target;
        }
        this.root.active = !hidden;
        const g = this.effects,
            s = this.scale,
            t = colony.elapsed;
        g.clear();
        if (hidden) return;
        const ellipse = (x: number, y: number, w: number, h: number, c: Color) => {
            g.fillColor = c;
            g.ellipse((x - 512) * s, (768 - y) * s, w * s, h * s);
            g.fill();
        };
        if (colony.night) {
            // Small stars and warm light pools support the evening palette.
            for (const [x, y] of [
                [200, 150],
                [740, 180],
                [430, 250],
                [820, 340],
            ])
                ellipse(x, y, 1.8, 1.8, new Color(240, 244, 210, 155));
            if (colony.garden === 'lantern-garden') {
                for (const [x, y] of [
                    [258, 706],
                    [325, 735],
                ])
                    for (let i = 4; i > 0; i--)
                        ellipse(
                            x,
                            y,
                            i * 13,
                            i * 14,
                            new Color(255, 204, 88, 8 + Math.round(3 * Math.sin(t * 1.6))),
                        );
                for (let i = 0; i < 4; i++)
                    ellipse(
                        240 + i * 25 + Math.sin(t + i) * 10,
                        765 + Math.cos(t * 0.8 + i) * 18,
                        2,
                        2,
                        new Color(255, 231, 139, 170),
                    );
            }
        }
        if (colony.living === 'dew-pond')
            for (const r of colony.residents) {
                if (r.action !== 'rest' || !['drink', 'mirror'].includes(r.activity)) continue;
                const phase = (t * 0.7 + r.identity * 0.3) % 1;
                g.strokeColor = new Color(225, 255, 255, Math.round((1 - phase) * 140));
                g.lineWidth = s;
                g.ellipse(
                    (r.x - 512 + (r.activity === 'drink' ? 23 : -20)) * s,
                    (768 - r.y - 4) * s,
                    (5 + phase * 15) * s,
                    (2 + phase * 5) * s,
                );
                g.stroke();
            }
        if (colony.seedPhase === 'carry' || colony.seedPhase === 'lower') {
            const lift = colony.seedPhase === 'carry' ? 23 : 12;
            const x = colony.seedX,
                y = colony.seedY - lift + Math.sin(t * 5) * 0.8;
            ellipse(x, colony.seedY, 27, 5, new Color(55, 42, 22, 35));
            ellipse(x, y, 29, 14, new Color(184, 119, 38, 255));
            ellipse(x, y - 2, 26, 12, new Color(240, 188, 78, 255));
            g.strokeColor = new Color(255, 222, 134, 255);
            g.lineWidth = 2 * s;
            g.moveTo((x - 535) * s, (768 - y) * s);
            g.lineTo((x - 489) * s, (770 - y) * s);
            g.stroke();
        }
    }
}
