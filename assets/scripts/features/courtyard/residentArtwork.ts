import { Node, Rect, Size, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';

const regions = {
    head: [2, 2, 109, 122],
    closed: [115, 2, 109, 122],
    torso: [2, 132, 58, 60],
    abdomen: [64, 132, 92, 81],
    antennaFar: [161, 132, 55, 56],
    antennaNear: [161, 192, 55, 60],
    foot: [222, 48, 31, 45],
    paw: [2, 198, 43, 51],
} as const;

type ResidentPart = keyof typeof regions;
const props = {
    bowl: [260, 260, 66, 50],
    melon: [331, 260, 60, 60],
    grain: [396, 260, 40, 34],
} as const;
type Prop = keyof typeof props;
type Region = readonly [number, number, number, number];

/** One atlas owns the frames for the resident, reflection and handheld props. */
export class ResidentArtwork {
    private readonly frames: Record<ResidentPart, SpriteFrame>;
    private readonly propFrames: Record<Prop, SpriteFrame>;

    constructor(private readonly texture: Texture2D) {
        texture.addRef();
        this.frames = this.makeFrames(regions, 0, 0);
        this.propFrames = this.makeFrames(props, 0, 0);
    }

    private makeFrames<Key extends string>(layout: Record<Key, Region>, x: number, y: number) {
        const frames = {} as Record<Key, SpriteFrame>;
        for (const part of Object.keys(layout) as Key[]) {
            const [left, top, width, height] = layout[part];
            const frame = new SpriteFrame();
            frame.texture = this.texture;
            frame.rect = new Rect(left + x, top + y, width, height);
            frame.originalSize = new Size(width, height);
            frame.packable = false;
            frames[part] = frame;
        }
        return frames;
    }

    place(parent: Node, part: ResidentPart, x: number, y: number, width: number, mirror = false) {
        return this.sprite(parent, `Resident ${part}`, this.frames[part], x, y, width, mirror);
    }

    prop(parent: Node, part: Prop, width: number) {
        return this.sprite(
            parent,
            `Resident food ${part}`,
            this.propFrames[part],
            0,
            0,
            width,
            false,
        );
    }

    private sprite(
        parent: Node,
        name: string,
        frame: SpriteFrame,
        x: number,
        y: number,
        width: number,
        mirror: boolean,
    ) {
        const node = new Node(name);
        node.layer = parent.layer;
        node.parent = parent;
        node.addComponent(UITransform).setContentSize(
            width,
            (width * frame.rect.height) / frame.rect.width,
        );
        node.setPosition(x, y);
        if (mirror) node.setScale(-1, 1, 1);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        return node;
    }

    destroy() {
        for (const frames of [this.frames, this.propFrames])
            for (const frame of Object.values(frames)) frame.destroy();
        this.texture.decRef();
    }
}
