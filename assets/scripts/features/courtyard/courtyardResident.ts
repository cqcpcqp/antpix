import { Color, Graphics, Layers, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
import { CourtyardLife } from '../../domain/courtyard/courtyardLife';

/** View is disposable when decorations refresh; the life simulation is not. */
export class CourtyardResident {
    readonly root: Node;
    private body: Node;
    private footHeight: number;
    private sprite: Sprite;
    private opacity: UIOpacity;
    private shadow: Node;
    private accessory: Node;
    private reflection: Node;
    private reflectionSprite: Sprite;
    private reflectionOpacity: UIOpacity;
    constructor(
        parent: Node,
        private frames: SpriteFrame[],
        private scale: number,
        private identity = 0,
    ) {
        this.root = new Node('Courtyard resident');
        this.root.layer = Layers.Enum.UI_2D;
        this.root.parent = parent;
        this.root.addComponent(UITransform);
        this.opacity = this.root.addComponent(UIOpacity);
        this.shadow = new Node('Resident ground shadow');
        this.shadow.layer = Layers.Enum.UI_2D;
        this.shadow.parent = this.root;
        const shadowArt = this.shadow.addComponent(Graphics);
        shadowArt.fillColor = new Color(65, 49, 24, 38);
        shadowArt.ellipse(0, 0, 20 * scale, 5 * scale);
        shadowArt.fill();
        this.body = new Node('Resident pose');
        this.body.layer = Layers.Enum.UI_2D;
        this.body.parent = this.root;
        const size = [88, 78, 82][identity] * scale;
        // Atlas feet are aligned at row 122 of a 128px cell.
        this.footHeight = ((size / scale) * (122 - 64)) / 128;
        this.body.addComponent(UITransform).setContentSize(size, size);
        this.sprite = this.body.addComponent(Sprite);
        this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.accessory = new Node('Resident personal scarf');
        this.accessory.layer = Layers.Enum.UI_2D;
        this.accessory.parent = this.body;
        const accessory = this.accessory.addComponent(Graphics);
        accessory.fillColor = new Color(255, 235, 178, 255);
        accessory.moveTo(-9 * scale, -2 * scale);
        accessory.lineTo(8 * scale, -4 * scale);
        accessory.lineTo(-8 * scale, -13 * scale);
        accessory.close();
        accessory.fill();
        this.reflection = new Node('Resident water reflection');
        this.reflection.layer = Layers.Enum.UI_2D;
        this.reflection.parent = parent;
        this.reflection.addComponent(UITransform).setContentSize(size * 0.65, size * 0.45);
        this.reflectionOpacity = this.reflection.addComponent(UIOpacity);
        this.reflectionOpacity.opacity = 55;
        this.reflectionSprite = this.reflection.addComponent(Sprite);
        this.reflectionSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.reflectionSprite.color = new Color(90, 155, 165, 255);
    }
    render(life: CourtyardLife, hidden: boolean) {
        this.root.active = !hidden && this.frames.length === 12;
        this.reflection.active = false;
        if (!this.root.active) return;
        this.sprite.spriteFrame = this.frames[life.frame];
        this.opacity.opacity = Math.round(255 * life.opacity);
        const resting = life.action === 'rest';
        const sitting = life.chair && ['sit', 'rest', 'rise'].includes(life.action);
        const lift = life.seatProgress * 43;
        const bob =
            (life.frame < 4 || life.action === 'carry') && !life.pausedForTraffic
                ? Math.sin(life.stride * Math.PI * 2) * 1.3
                : 0;
        this.root.setPosition(
            (life.x + life.avoidX - 512 + lift * 0.8) * this.scale,
            (768 - life.y - life.avoidY + this.footHeight + lift + bob) * this.scale,
        );
        this.shadow.setPosition(0, (-this.footHeight - lift - bob) * this.scale);
        this.shadow.active = !sitting;
        this.body.setScale(life.facing, resting ? 1 + Math.sin(life.elapsed * 2) * 0.012 : 1, 1);
        this.body.angle = resting
            ? Math.sin(life.elapsed * 1.2) * (life.activity === 'drink' ? 3 : 0.6)
            : 0;
        this.accessory.active = this.identity === 1 && [0, 1, 2, 3, 4, 10, 11].includes(life.frame);
        if (life.action === 'rest' && life.activity === 'mirror') {
            this.reflection.active = true;
            this.reflectionSprite.spriteFrame = this.frames[9];
            this.reflection.setPosition(
                (life.x - 529) * this.scale,
                (768 - life.y - 13) * this.scale,
            );
            this.reflection.setScale(-1, -1, 1);
        }
        const light = Math.round(150 + life.opacity * 105);
        const tint = [
            [1, 1, 1],
            [0.75, 0.75, 0.82],
            [1, 0.87, 0.75],
        ][this.identity];
        this.sprite.color = new Color(
            Math.round(light * tint[0]),
            Math.round(light * tint[1]),
            Math.round(light * tint[2]),
            255,
        );
    }
}
