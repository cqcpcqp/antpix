import { Color, Graphics, Layers, Node } from 'cc';
import { CourtyardColony } from '../../domain/courtyard/courtyardColony';

export class CourtyardAtmosphere {
    private readonly effects: Graphics;
    private readonly root: Node;

    constructor(
        parent: Node,
        private readonly scale: number,
    ) {
        this.root = new Node('Courtyard furniture effects');
        this.root.layer = Layers.Enum.UI_2D;
        this.root.parent = parent;
        this.effects = this.root.addComponent(Graphics);
    }

    render(colony: CourtyardColony, hidden: boolean) {
        this.root.active = !hidden;
        const g = this.effects,
            s = this.scale;
        g.clear();
        if (hidden) return;
        const ellipse = (x: number, y: number, w: number, h: number, c: Color) => {
            g.fillColor = c;
            g.ellipse((x - 512) * s, (768 - y) * s, w * s, h * s);
            g.fill();
        };
        const r = colony.resident;
        if (r.action !== 'rest') return;
        if (r.activity === 'lantern' && r.elapsed > 1.2 && r.elapsed < 3.25) {
            const drift = r.elapsed - 1.2;
            for (let i = 0; i < 3; i++)
                ellipse(
                    r.x - 28 - drift * (10 + i * 4),
                    r.y - 60 - drift * 28 + i * 7,
                    1.4 + i * 0.5,
                    1.4 + i * 0.5,
                    new Color(255, 232, 148, Math.round(215 * Math.sin((drift * Math.PI) / 2.05))),
                );
        }
        if (r.activity === 'drink' || r.activity === 'mirror') {
            const beats = r.activity === 'drink' ? [0.76, 1.44] : [2.65];
            for (const beat of beats) {
                const phase = (r.elapsed - beat) / 1.2;
                if (phase < 0 || phase > 1) continue;
                const x = r.x + (r.activity === 'drink' ? 52 : -42);
                const y = r.activity === 'drink' ? 776 : 789;
                g.strokeColor = new Color(225, 255, 255, Math.round((1 - phase) * 156));
                g.lineWidth = s;
                g.ellipse((x - 512) * s, (768 - y) * s, (5 + phase * 20) * s, (2 + phase * 7) * s);
                g.stroke();
                if (phase < 0.42 && r.activity === 'drink')
                    ellipse(
                        x + phase * 16,
                        y - Math.sin((phase / 0.42) * Math.PI) * 13,
                        2.4,
                        2,
                        new Color(202, 249, 241, 170),
                    );
            }
        }
    }
}
