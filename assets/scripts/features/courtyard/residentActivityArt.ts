import { Color, Graphics, Node } from 'cc';
import type { ResidentArtwork } from './residentArtwork';
import { easeBetween } from './residentMotion';
import type { ResidentPose } from './residentMotion';

function prop(parent: Node, name: string) {
    const node = new Node(name);
    node.layer = parent.layer;
    node.parent = parent;
    node.active = false;
    return node.addComponent(Graphics);
}

function rect(g: Graphics, color: string, x: number, y: number, w: number, h: number, r: number) {
    g.fillColor = new Color(color);
    g.roundRect(x, y, w, h, r);
    g.fill();
}

function paper(parent: Node, newspaper: boolean) {
    const g = prop(parent, newspaper ? 'Resident newspaper' : 'Resident book');
    const w = newspaper ? 36 : 34;
    rect(g, newspaper ? '#786D59' : '#59694A', -w / 2, -11, w, 22, 3);
    rect(g, '#FFF2CF', -w / 2 + 2, -8, w - 4, 18, 2);
    rect(g, '#C5AD83', -1, -8, 2, 17, 0.6);
    for (const x of [-w / 2 + 5, 4]) {
        rect(g, newspaper ? '#827361' : '#CD976C', x, 5, 9, 2, 0.6);
        for (let row = 0; row < 3; row++)
            rect(g, '#C5AF88', x, 1 - row * 3, 10 - (row % 2) * 3, 1, 0.4);
    }
    const turn = prop(g.node, 'Resident page turn');
    rect(turn, '#FFFAE4', 0, -8, w / 2 - 3, 18, 2);
    rect(turn, '#C9AF88', 3, 4, 8, 1.1, 0.4);
    rect(turn, '#C9AF88', 3, 0, 7, 1.1, 0.4);
    return { g, turn };
}

function phone(parent: Node) {
    const g = prop(parent, 'Resident phone');
    rect(g, '#593B32', -11, -14, 22, 28, 5);
    rect(g, '#568881', -9, -10, 18, 20, 3);
    rect(g, '#9AC49E', -7, -7, 14, 15, 2);
    rect(g, '#EAD89C', -6, -6, 12, 3, 1);
    rect(g, '#E9B874', 1, 2, 4, 4, 1);
    rect(g, '#D0BA9B', -2, -12, 4, 1, 0.4);
    const pixel = prop(g.node, 'Resident phone game pixel');
    rect(pixel, '#B96237', -2, -1, 4, 3, 0.7);
    return { g, pixel };
}

/** Handheld objects and small effects follow the same activity clock as the pose. */
export class ResidentActivityArt {
    private readonly book;
    private readonly news;
    private readonly phone;
    private readonly effects;
    private readonly grain;

    constructor(parent: Node, artwork: ResidentArtwork | null) {
        this.book = paper(parent, false);
        this.news = paper(parent, true);
        this.phone = phone(parent);
        this.effects = prop(parent, 'Resident breathing and effort');
        this.grain = artwork?.prop(parent, 'grain', 15);
        if (this.grain) {
            this.grain.name = 'Resident pantry seed';
            this.grain.active = false;
        }
    }

    render(pose: ResidentPose, time: number, grip?: readonly [number, number]) {
        for (const [name, item] of [
            ['read', this.book],
            ['news', this.news],
            ['game', this.phone],
        ] as const) {
            item.g.node.active = pose === name && time > 0.18 && time < 6.08;
            if (!item.g.node.active) continue;
            const reach = easeBetween(time, 0.18, 0.64) * (1 - easeBetween(time, 5.55, 6.08));
            item.g.node.setPosition(3 + 3 * reach, -28 + 18 * reach);
            item.g.node.setScale(0.55 + 0.45 * reach, 0.58 + 0.42 * reach, 1);
            item.g.node.angle = (name === 'game' ? -12 : 5) + Math.sin(time * 3.5) * 1.4;
        }
        for (const item of [this.book, this.news]) {
            const turn = (time - (item === this.book ? 2.85 : 1.45)) / 0.45;
            item.turn.node.active = item.g.node.active && turn > 0 && turn < 1;
            if (item.turn.node.active) item.turn.node.setScale(Math.cos(Math.PI * turn), 1, 1);
        }
        this.phone.pixel.node.active = this.phone.g.node.active;
        if (this.phone.pixel.node.active)
            this.phone.pixel.node.setPosition(
                -5 + ((time * 6) % 10),
                -2 + Math.abs(Math.sin(time * 7)) * 6,
            );
        if (this.grain) {
            this.grain.active = pose === 'pantry' && time > 0.63 && time < 4.53;
            if (this.grain.active) this.grain.setPosition(...(grip ?? [20, -19]));
        }
        this.effects.node.active =
            pose === 'sleep' || (pose === 'exercise' && time >= 4.2 && time < 5.7);
        if (this.effects.node.active) this.puffs(pose, time);
    }

    private puffs(pose: ResidentPose, time: number) {
        const g = this.effects;
        g.clear();
        const asleep = pose === 'sleep';
        for (let i = 0; i < 3; i++) {
            const phase = (time * (asleep ? 0.68 : 1.3) + i / 3) % 1;
            const x = (asleep ? 28 : 29) + phase * 13;
            const y = (asleep ? -12 : 20) + phase * 16;
            g.fillColor = new Color(255, 249, 220, Math.round((1 - phase) * 210));
            g.ellipse(x, y, 2 + phase * 2.5, 1.5 + phase * 1.5);
            g.fill();
        }
    }
}
