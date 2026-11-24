import { Color, Graphics, Layers, Node } from 'cc';
import { CourtyardColony } from '../../domain/courtyard/courtyardColony';

export class CourtyardAtmosphere {
    private veil: Node;
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
        // Cocos 3.8 Graphics submits a model with baked vertex colours: UIOpacity
        // does not fade this mesh. Bake translucency into the fill itself.
        g.fillColor = new Color(16, 31, 76, 105);
        g.rect(-width / 2, -height / 2, width, height);
        g.fill();
        this.veil = night;
        this.veil.active = false;
        this.root = new Node('Courtyard water and lantern light');
        this.root.layer = Layers.Enum.UI_2D;
        this.root.parent = parent;
        this.effects = this.root.addComponent(Graphics);
    }
    render(colony: CourtyardColony, hidden: boolean) {
        const target = colony.night ? 105 : 0;
        if (this.lastNight !== target) {
            this.veil.active = target > 0;
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
        const r = colony.resident;
        if (r.action === 'rest' && ['drink', 'mirror'].includes(r.activity)) {
            const phase = (t * 0.7) % 1;
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
    }
}
