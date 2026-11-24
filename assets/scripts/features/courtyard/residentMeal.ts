import { Color, Graphics, Node, Sprite } from 'cc';
import type { ResidentArtwork } from './residentArtwork';
import type { PetFood, mealMotion } from './residentMotion';

function detail(parent: Node, name: string) {
    const node = new Node(name);
    node.layer = parent.layer;
    node.parent = parent;
    node.active = false;
    return node;
}

/** Draws props in ground space so they can pass from the bowl to either hand. */
export class ResidentMeal {
    private readonly bowl: Node;
    private readonly melon: Node;
    private readonly grain: Node;
    private readonly mouth: Node;
    private readonly crumbs: Node[];

    constructor(root: Node, head: Node, artwork: ResidentArtwork | null) {
        this.bowl = artwork?.prop(root, 'bowl', 44) ?? detail(root, 'Resident food bowl');
        this.melon = artwork?.prop(root, 'melon', 34) ?? detail(root, 'Resident food melon');
        this.grain = artwork?.prop(root, 'grain', 18) ?? detail(root, 'Resident food grain');
        this.mouth = detail(head, 'Resident bite');
        this.mouth.setPosition(artwork ? 8 : 15, 13);
        const mouth = this.mouth.addComponent(Graphics);
        mouth.fillColor = new Color('#673523');
        mouth.ellipse(0, 0, 5.9, 3.5);
        mouth.fill();
        mouth.fillColor = new Color('#D87555');
        mouth.ellipse(0.2, -1.4, 2.9, 1.3);
        mouth.fill();
        this.crumbs = Array.from({ length: 4 }, (_, index) => {
            const node =
                artwork?.prop(root, 'grain', 5 + (index % 2) * 1.5) ??
                detail(root, 'Resident crumb');
            node.name = 'Resident crumb';
            return node;
        });
        this.hide();
    }

    hide() {
        this.bowl.active = this.melon.active = this.grain.active = this.mouth.active = false;
        for (const crumb of this.crumbs) crumb.active = false;
    }

    show(
        food: PetFood,
        motion: ReturnType<typeof mealMotion>,
        mouthX: number,
        mouthY: number,
        localMouth = true,
    ) {
        const { reach, lift, bites, crumbAge, open, time, chew, settle } = motion;
        this.bowl.active = !!this.bowl.getComponent(Sprite) && reach > 0.03 && settle < 0.99;
        this.bowl.setPosition(32, -41);
        const bowlScale = Math.max(0.1, Math.min(1, reach * 1.4, (1 - settle) * 2));
        this.bowl.setScale(bowlScale, bowlScale, 1);
        this.mouth.active = open > 0.06;
        if (!localMouth) this.mouth.setPosition(mouthX, mouthY);
        this.mouth.setScale(0.72 + 0.28 * open, 0.2 + open * 0.8, 1);
        const pickup = food === 'melon' ? this.melon : this.grain;
        this.melon.active = this.grain.active = false;
        pickup.active = !!pickup.getComponent(Sprite) && reach > 0.08 && bites < 3;
        const portion = [1, 0.76, 0.49][Math.min(bites, 2)] * Math.min(1, reach * 1.9);
        pickup.setScale(portion, portion, 1);
        pickup.setPosition(32 + (mouthX - 26) * lift, -28 + (mouthY + 23) * lift + chew);
        pickup.angle = -20 * lift + chew * 7;
        this.crumbs.forEach((crumb, index) => {
            crumb.active = !!crumb.getComponent(Sprite) && bites > 0 && crumbAge < 0.29;
            if (!crumb.active) return;
            const dx = (index - 1.45) * crumbAge * 48;
            crumb.setPosition(
                mouthX + 2 + dx,
                mouthY + crumbAge * (38 + index * 13) - 240 * crumbAge ** 2,
            );
            crumb.angle = time * 350 + index * 30;
            const scale = 1 - crumbAge / 0.31;
            crumb.setScale(scale, scale, 1);
        });
    }
}
