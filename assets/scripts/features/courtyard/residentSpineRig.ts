import { Node, sp } from 'cc';
import type { ResidentArtwork } from './residentArtwork';
import { ResidentMeal } from './residentMeal';
import { mealMotion } from './residentMotion';
import type { PetFood, ResidentPose } from './residentMotion';
import { ResidentActivityArt } from './residentActivityArt';

const looping: readonly ResidentPose[] = [
    'idle',
    'walk',
    'run',
    'rest',
    'look',
    'groom',
    'sleep',
    'chairRest',
];
const timed: readonly ResidentPose[] = [
    'sip',
    'mirror',
    'pantry',
    'lantern',
    'exercise',
    'read',
    'news',
    'game',
    'talk',
    'lieDown',
    'lieUp',
    'chairDown',
    'chairUp',
    'hungry',
];
const skinScale = 1.1;
const skinGroundY = -51;

/** Advances the painted mesh after pet reactions choose the courtyard frame's pose. */
export class ResidentSpineRig {
    readonly root: Node;
    private readonly skeleton: sp.Skeleton;
    private readonly meal: ResidentMeal;
    private readonly activityArt?: ResidentActivityArt;
    private requested: ResidentPose = 'idle';
    private current: ResidentPose = 'idle';
    private reaction = false;
    private playingReaction = false;
    private food: PetFood | undefined;
    private mealTime = 0;

    constructor(
        parent: Node,
        asset: sp.SkeletonData,
        artwork: ResidentArtwork | null,
        reflection = false,
    ) {
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
        const clips = [...looping, ...timed, 'pet', 'petHappy', 'cheer', 'eat'];
        const posesOnGround = ['lieDown', 'sleep', 'lieUp'];
        for (const from of clips)
            for (const to of clips)
                if (from !== to)
                    this.skeleton.setMix(
                        from,
                        to,
                        posesOnGround.includes(from) && !posesOnGround.includes(to)
                            ? 0.28
                            : to === 'eat'
                              ? 0.04
                              : 0.14,
                    );
        this.skeleton.setAnimation(0, 'idle', true);
        this.meal = new ResidentMeal(this.root, this.root, artwork);
        if (!reflection) this.activityArt = new ResidentActivityArt(this.root, artwork);
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
        reaction = false,
    ) {
        this.requested = pose;
        this.reaction = reaction;
        this.food = food;
        this.mealTime = reactionTime;
    }

    advance(dt: number) {
        if (this.current !== this.requested || this.playingReaction !== this.reaction) {
            this.current = this.requested;
            this.playingReaction = this.reaction;
            const loop = looping.includes(this.current);
            const entry = this.skeleton.setAnimation(0, this.current, loop);
            if (entry && !this.reaction && timed.includes(this.current))
                entry.trackTime = Math.min(this.mealTime, entry.animationEnd);
        }
        this.skeleton.paused = false;
        this.skeleton.updateAnimation(Math.max(0, Math.min(dt, 0.05)));
        this.skeleton.paused = true;
        const grip = this.current === 'pantry' ? this.skeleton.findBone('handRight') : null;
        this.activityArt?.render(
            this.current,
            this.mealTime,
            grip
                ? [grip.worldX * skinScale + 7, grip.worldY * skinScale + skinGroundY - 3]
                : undefined,
        );
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
