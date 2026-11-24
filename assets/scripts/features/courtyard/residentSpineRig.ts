import { Node, sp } from 'cc';
import type { ResidentArtwork } from './residentArtwork';
import { ResidentMeal } from './residentMeal';
import { mealMotion } from './residentMotion';
import type { PetFood, ResidentPose } from './residentMotion';

const looping: readonly ResidentPose[] = ['idle', 'walk', 'rest', 'look', 'groom', 'sip'];
const clips: readonly ResidentPose[] = [...looping, 'pet', 'cheer', 'eat', 'hungry'];
const skinScale = 1.1;
const skinGroundY = -51;

/** Advances the painted mesh after pet reactions choose the courtyard frame's pose. */
export class ResidentSpineRig {
    readonly root: Node;
    private readonly skeleton: sp.Skeleton;
    private readonly meal: ResidentMeal;
    private requested: ResidentPose = 'idle';
    private current: ResidentPose = 'idle';
    private food: PetFood | undefined;
    private mealTime = 0;

    constructor(parent: Node, asset: sp.SkeletonData, artwork: ResidentArtwork | null) {
        this.root = new Node('Resident pose');
        this.root.layer = parent.layer;
        this.root.parent = parent;
        const skin = new Node('Resident weighted mesh');
        skin.layer = parent.layer;
        skin.parent = this.root;
        skin.setPosition(0, skinGroundY);
        skin.setScale(skinScale, skinScale, 1);
        this.skeleton = skin.addComponent(sp.Skeleton);
        this.skeleton.premultipliedAlpha = false;
        this.skeleton.skeletonData = asset;
        this.skeleton.paused = true;
        for (const from of clips) {
            for (const to of clips) {
                if (from !== to) this.skeleton.setMix(from, to, to === 'eat' ? 0.04 : 0.14);
            }
        }
        this.skeleton.setAnimation(0, 'idle', true);
        this.meal = new ResidentMeal(this.root, this.root, artwork);
    }

    animate(
        pose: ResidentPose,
        _time: number,
        _stride: number,
        _sit: number,
        _strength?: number,
        _gait?: number,
        food?: PetFood,
        reactionTime = 0,
    ) {
        this.requested = pose;
        this.food = food;
        this.mealTime = reactionTime;
    }

    advance(dt: number) {
        if (this.current !== this.requested) {
            this.current = this.requested;
            const loop = looping.includes(this.current);
            this.skeleton.setAnimation(0, this.current, loop);
        }
        this.skeleton.paused = false;
        this.skeleton.updateAnimation(Math.max(0, Math.min(dt, 0.05)));
        this.skeleton.paused = true;
        if (this.food) {
            const mouth = this.skeleton.findBone('mouth');
            if (mouth) {
                const mouthX = mouth.worldX * skinScale;
                const mouthY = mouth.worldY * skinScale + skinGroundY;
                this.meal.show(this.food, mealMotion(this.mealTime), mouthX, mouthY, false);
            }
        } else this.meal.hide();
    }
}
