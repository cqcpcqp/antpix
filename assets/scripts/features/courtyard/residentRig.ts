import { Graphics, Node } from 'cc';
import { joint, oval, polygon } from './residentRigNodes';
import type { ResidentArtwork } from './residentArtwork';
import { ResidentMeal } from './residentMeal';
import { ResidentActivityArt } from './residentActivityArt';
import { armMotion, easeBetween, footCycle, mealMotion, pointLimb } from './residentMotion';
import type { PetFood, ResidentPose } from './residentMotion';

const ink = '#47291F';
const palette = { shell: '#A74932', face: '#D9754C', light: '#F99765', gear: '#FFCE69' };

/** Rigid artwork follows parent joints. Each lower limb inherits its upper limb's rotation. */
export class ResidentRig {
    readonly root: Node;
    private torso: Node;
    private abdomen: Node;
    private head: Node;
    private eyes: Node;
    private closedFace: Node | null = null;
    private antennae: { upper: Node; lower: Node }[];
    private legs: { upper: Node; lower: Node }[];
    private arms: { upper: Node; lower: Node }[];
    private meal: ResidentMeal;
    private readonly painted: boolean;
    private readonly activityArt?: ResidentActivityArt;

    constructor(
        parent: Node,
        private readonly artwork: ResidentArtwork | null = null,
        reflection = false,
    ) {
        this.painted = artwork !== null;
        this.root = joint(parent, 'Resident pose');
        this.torso = joint(this.root, 'Thorax joint', 0, -20);
        this.legs = [-1, 1, -1, 1].map((side, index) =>
            this.limb(
                this.torso,
                `Leg ${index + 1}`,
                side * (index < 2 ? 11 : 16) + (this.painted ? -5 : 0),
                index < 2 ? -8 : -5,
                index < 2 ? 12 : 14,
                12,
                3,
                palette.face,
            ),
        );
        this.abdomen = joint(this.torso, 'Abdomen joint', -13, -2);
        if (artwork) {
            artwork.place(this.abdomen, 'abdomen', 39, -4, 44);
            artwork.place(this.torso, 'torso', -4, -1, 67);
            this.arms = [-1, 1].map((side, index) =>
                this.limb(this.torso, `Arm ${index + 1}`, side * 17, 5, 10, 9, 4, palette.light),
            );
            this.head = joint(this.torso, 'Neck joint', 0, 10);
            this.antennae = [0, 1].map((index) => {
                const upper = joint(
                    this.head,
                    `Antenna ${index + 1}`,
                    [-27, 6][index],
                    [45, 58][index],
                );
                const lower = joint(upper, `Antenna ${index + 1} flex`);
                artwork.place(
                    lower,
                    index === 0 ? 'antennaFar' : 'antennaNear',
                    [-12, 9][index],
                    [3, 11][index],
                    [36, 29][index],
                );
                return { upper, lower };
            });
            this.eyes = artwork.place(this.head, 'head', 0, 25, 88);
            this.closedFace = artwork.place(this.head, 'closed', 0, 25, 88);
            this.head.setSiblingIndex(this.arms[0].upper.getSiblingIndex());
            this.closedFace.active = false;
            this.meal = new ResidentMeal(this.root, this.head, artwork);
            if (!reflection) this.activityArt = new ResidentActivityArt(this.root, artwork);
            return;
        }
        const abdomen = this.abdomen.addComponent(Graphics);
        oval(abdomen, -16, -3, 28, 22, palette.shell, true);
        oval(abdomen, -22, 4, 12, 4, palette.face);
        const torso = joint(this.torso, 'Thorax artwork').addComponent(Graphics);
        oval(torso, 1, 0, 17, 19, palette.shell, true);
        this.arms = [-1, 1].map((side, index) =>
            this.limb(this.torso, `Arm ${index + 1}`, side * 15, 4, 12, 10, 4, palette.light),
        );
        this.head = joint(this.torso, 'Neck joint', 6, 13);
        this.antennae = [-1, 1].map((side, index) =>
            this.limb(this.head, `Antenna ${index + 1}`, side * 13, 36, 12, 9, 2, palette.light),
        );
        const face = joint(this.head, 'Head artwork').addComponent(Graphics);
        oval(face, 0, 19, 23, 22, palette.face, true);
        oval(face, -9, 30, 9, 4, palette.light);
        oval(face, 13, 11, 6, 3, palette.light);
        oval(face, 8, 13, 4, 2, ink);
        this.eyes = joint(this.head, 'Eyes', 0, 22);
        const eyes = this.eyes.addComponent(Graphics);
        for (const x of [-6, 12]) {
            oval(eyes, x, 0, 5, 7, '#FFF3CE');
            oval(eyes, x + 1.5, 0, 2.8, 4.5, ink);
            oval(eyes, x + 2, 2, 1, 1.1, '#FFFFFF');
        }
        const gear = joint(this.head, 'Role silhouette').addComponent(Graphics);
        polygon(
            gear,
            [
                [-14, 37],
                [-18, 51],
                [-7, 46],
                [0, 56],
                [7, 46],
                [17, 51],
                [13, 37],
            ],
            palette.gear,
        );
        oval(gear, 0, 44, 3, 4, '#E77546');
        this.meal = new ResidentMeal(this.root, this.head, artwork);
        if (!reflection) this.activityArt = new ResidentActivityArt(this.root, artwork);
    }

    private limb(
        parent: Node,
        name: string,
        x: number,
        y: number,
        length: number,
        tip: number,
        width: number,
        fill: string,
    ) {
        const upper = joint(parent, name, x, y);
        const lower = joint(upper, `${name} hinge`, 0, -length);
        if (this.artwork) {
            const paw = name.startsWith('Arm');
            this.artwork.place(
                lower,
                paw ? 'paw' : 'foot',
                0,
                paw ? 4 : -tip / 2,
                paw ? 21 : 18,
                x > 0,
            );
            return { upper, lower };
        }
        for (const [node, size] of [
            [upper, length],
            [lower, tip],
        ] as const) {
            const art = node.addComponent(Graphics);
            oval(art, 0, -size / 2, width, size / 2 + 1, ink);
            oval(art, 0, -size / 2, width * 0.58, size / 2, fill);
        }
        return { upper, lower };
    }

    animate(
        pose: ResidentPose,
        time: number,
        stride: number,
        sit: number,
        strength = 1,
        gait = 0,
        food?: PetFood,
        reactionTime = time,
    ) {
        const step = stride * Math.PI;
        const breath = Math.sin(time * 2.1);
        const wave = Math.sin(time * 3.1);
        const fast = Math.sin(time * 9);
        const meal = food ? mealMotion(reactionTime) : undefined;
        const pick = meal ? meal.reach * (1 - meal.lift) : 0;
        const lean =
            pose === 'petHappy'
                ? easeBetween(reactionTime, 0.16, 0.57) *
                  (1 - easeBetween(reactionTime, 1.14, 1.65))
                : 0;
        const stretch = pose === 'rest' ? strength * Math.max(0, breath) ** 7 : 0;
        const excited = pose === 'cheer';
        const anticipation =
            easeBetween(reactionTime, 0.03, 0.22) * (1 - easeBetween(reactionTime, 0.23, 0.4));
        const jumpPhase = Math.max(0, Math.min(1, (reactionTime - 0.24) / 0.66));
        const exerciseTime = reactionTime - 0.98;
        const jump =
            pose === 'cheer'
                ? Math.sin(jumpPhase * Math.PI) * 15 * strength
                : pose === 'exercise' && exerciseTime >= 0 && exerciseTime < 3.04
                  ? Math.sin(Math.PI * Math.min(1, (exerciseTime % 1.16) / 0.67)) * 10
                  : 0;
        const recline =
            pose === 'sleep'
                ? 1
                : pose === 'lieDown'
                  ? easeBetween(reactionTime, 0.18, 1.1)
                  : pose === 'lieUp'
                    ? 1 - easeBetween(reactionTime, 0, 0.92)
                    : 0;
        this.activityArt?.render(pose, reactionTime);
        const tuck = sit;
        const weight = Math.sin(step) * gait;
        const trunkX = weight * 2.1 + pick * 4 + lean * 2 + recline * 1.5;
        const trunkY =
            -21 -
            9 * tuck -
            recline * 10 +
            jump +
            breath * 0.65 +
            Math.sin(step * 2) * gait * 0.9 -
            pick * 7 -
            (pose === 'cheer' ? anticipation * 5 : 0);
        this.torso.setPosition(trunkX, trunkY);
        this.torso.angle =
            weight * 2.6 +
            pick * -9 -
            lean * 4 -
            recline * 76 +
            (pose === 'sip' ? -9 * strength : 0) +
            (pose === 'run' ? -8 : 0);
        this.abdomen.angle = breath * 2.5 + Math.sin(step - 0.9) * 5.2 * gait + tuck * 9 + pick * 8;
        this.abdomen.setScale(1 + breath * 0.023, 1 - breath * 0.016, 1);
        this.head.angle =
            -this.torso.angle * 0.45 + breath * 1.9 - Math.sin(step - 0.55) * 3 * gait;
        if (pose === 'look' || pose === 'mirror' || pose === 'lantern')
            this.head.angle += wave * 8 * strength;
        if (pose === 'hungry') this.head.angle += wave * 6 * strength;
        if (pose === 'pet') this.head.angle += (6 + wave * 2) * strength;
        this.head.angle -= lean * (5 + Math.sin(reactionTime * 13) * 2) + recline * 31;
        if (['read', 'news', 'game', 'pantry'].includes(pose)) this.head.angle -= 5 * strength;
        this.head.setPosition(
            (this.painted ? 0 : 6) + lean * 2.5,
            (this.painted ? 10 : 13) - (pose === 'pet' ? strength : 0) + lean * 0.6,
        );
        if (pose === 'groom' || pose === 'sip') this.head.angle += (wave * 5 - 9) * strength;
        if (meal)
            this.head.angle += -pick * 16 + meal.chew * 4 + meal.swallow * 9 + meal.bellyPat * 3;
        this.head.setScale(1 + (meal?.chew ?? 0) * 0.031, 1 - (meal?.chew ?? 0) * 0.026, 1);
        const blink = time % 4.1 > 3.94;
        const closed =
            blink ||
            (pose === 'pet' && strength > 0.35) ||
            lean > 0.74 ||
            recline > 0.65 ||
            (pose === 'rest' && sit > 0.85 && breath > -0.1) ||
            (!!meal &&
                (meal.swallow > 0.18 ||
                    meal.bellyPat > 0.4 ||
                    (meal.bites === 3 && meal.settle < 0.55)));
        if (this.closedFace) {
            this.eyes.active = !closed;
            this.closedFace.active = closed;
        } else this.eyes.setScale(1, closed ? 0.22 : 1, 1);
        this.antennae.forEach(({ upper, lower }, index) => {
            const side = index === 0 ? -1 : 1;
            upper.angle =
                side * (this.artwork ? -10 + stretch * 9 : 155 - stretch * 17) +
                Math.sin(time * 3.8 - index * 0.85) * 7 +
                Math.sin(step - index * 0.6 - 1) * 12 * gait -
                pick * 13 -
                lean * 11;
            lower.angle =
                side * (this.artwork ? 4 : 28) + Math.sin(time * 6.3 - index) * (excited ? 11 : 4);
        });
        this.stepLegs(stride, gait, tuck, trunkX, trunkY, jump);
        const signals = { strength, stretch, fast, jump, step, gait, weight };
        this.arms.forEach(({ upper, lower }, index) => {
            const angles = armMotion(pose, index, signals);
            upper.angle = angles.upper;
            lower.angle = angles.lower;
            if (
                this.painted &&
                (pose === 'idle' || pose === 'pet' || pose === 'petHappy' || pose === 'look')
            ) {
                const side = index === 0 ? -1 : 1;
                upper.angle = -side * 110 + breath * 5;
                lower.angle = -side * 24;
            }
            if (meal) {
                const side = index === 0 ? -1 : 1;
                const grip = meal.reach * (1 - meal.settle);
                const target = pointLimb(
                    this.painted ? 19 - side * 8 - meal.lift * 12 : 21 - side * 4 - meal.lift * 9,
                    (this.painted ? -14 : -11) +
                        meal.lift * (this.painted ? 30 : 22) +
                        meal.chew * 2,
                    10,
                    9,
                    side,
                );
                upper.angle += (target.upper - upper.angle) * grip;
                lower.angle += (target.lower - lower.angle) * grip;
                const belly = pointLimb(-side * 11, -9, 10, 9, side);
                upper.angle += (belly.upper - upper.angle) * meal.bellyPat;
                lower.angle += (belly.lower - lower.angle) * meal.bellyPat;
            }
        });
        if (meal && food)
            this.meal.show(
                food,
                meal,
                trunkX + (this.painted ? 8 : 25),
                trunkY + (this.painted ? 20 : 25) - pick * 8 + meal.chew * 2,
            );
        else this.meal.hide();
    }

    private stepLegs(
        stride: number,
        gait: number,
        tuck: number,
        trunkX: number,
        trunkY: number,
        jump: number,
    ) {
        const tilt = (this.torso.angle * Math.PI) / 180;
        const cosine = Math.cos(tilt);
        const sine = Math.sin(tilt);
        this.legs.forEach(({ upper, lower }, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const cycle = footCycle(stride, index);
            const x = side * ((index < 2 ? 15 : 24) + tuck * 7) + cycle.sweep * 5.8 * gait - trunkX;
            const y = -49 - trunkY + cycle.height * 8.2 * gait + jump * 0.88;
            const target = pointLimb(
                x * cosine + y * sine - upper.position.x,
                y * cosine - x * sine - upper.position.y,
                index < 2 ? 12 : 14,
                12,
                side,
            );
            upper.angle = target.upper;
            lower.angle = target.lower;
        });
    }
}
