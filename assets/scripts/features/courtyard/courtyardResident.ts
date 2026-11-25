import { Color, Graphics, Node, UIOpacity, UITransform } from 'cc';
import type { CourtyardLife } from '../../domain/courtyard/courtyardLife';
import { DOORSTEP_Y } from '../../domain/courtyard/courtyardLife';
import type { sp } from 'cc';
import { ResidentSpineRig } from './residentSpineRig';
import type { ResidentArtwork } from './residentArtwork';
import type { PetFood, ResidentPose } from './residentMotion';
import { ResidentRig } from './residentRig';

const moving = ['emerge', 'walk', 'run', 'return', 'enter'];

function leisurePose(life: CourtyardLife): ResidentPose {
    if (moving.includes(life.action)) return life.action === 'run' ? 'run' : 'walk';
    if (!['sit', 'rest', 'rise'].includes(life.action)) return 'idle';
    if (life.activity === 'chair') {
        if (life.action === 'sit') return 'chairDown';
        return life.action === 'rise' ? 'chairUp' : 'chairRest';
    }
    if (life.activity === 'sleep') {
        if (life.action === 'sit') return 'lieDown';
        return life.action === 'rise' ? 'lieUp' : 'sleep';
    }
    if (life.activity === 'hungry' || life.activity === 'happy') {
        if (life.action !== 'rest') return 'idle';
        return life.activity === 'hungry' ? 'hungry' : 'cheer';
    }
    if (life.action !== 'rest') return 'idle';
    switch (life.activity) {
        case 'look':
        case 'groom':
        case 'mirror':
        case 'pantry':
        case 'lantern':
        case 'exercise':
        case 'read':
        case 'news':
        case 'game':
        case 'talk':
            return life.activity;
        case 'drink':
            return 'sip';
        default:
            return 'rest';
    }
}

/** Owns the ground anchor and maps courtyard actions to the resident's joint hierarchy. */
export class CourtyardResident {
    readonly root: Node;
    readonly artScale: number;
    private readonly rig: ResidentRig | ResidentSpineRig;
    private readonly reflection: ResidentRig | ResidentSpineRig;
    private readonly opacity: UIOpacity;
    private readonly shadow: Node;
    readonly footHeight: number;
    private clock = 0;
    private gait = 0;
    private seat = 0;

    constructor(
        private readonly layers: { doorway: Node; outside: Node },
        private readonly scale: number,
        artwork: ResidentArtwork | null = null,
        skeleton: sp.SkeletonData | undefined = undefined,
    ) {
        this.artScale = (artwork ? 1.45 : 1.2) * scale;
        this.footHeight = 51 * this.artScale;
        this.root = new Node('Courtyard resident');
        this.root.layer = layers.outside.layer;
        this.root.parent = layers.outside;
        this.root
            .addComponent(UITransform)
            .setContentSize(124 * this.artScale, 126 * this.artScale);
        this.opacity = this.root.addComponent(UIOpacity);
        this.shadow = new Node('Resident ground shadow');
        this.shadow.layer = this.root.layer;
        this.shadow.parent = this.root;
        const shadowArt = this.shadow.addComponent(Graphics);
        shadowArt.ellipse(0, 0, 29 * this.artScale, 6 * this.artScale);
        shadowArt.fillColor = new Color(65, 49, 24, 45);
        shadowArt.fill();
        const createRig = (reflection: boolean) =>
            skeleton
                ? new ResidentSpineRig(this.root, skeleton, artwork, reflection)
                : new ResidentRig(this.root, artwork, reflection);
        this.rig = createRig(false);
        this.reflection = createRig(true);
        this.reflection.root.name = 'Resident water reflection';
        this.reflection.root.setSiblingIndex(0);
        this.reflection.root.addComponent(UIOpacity).opacity = 53;
        this.reflection.root.active = false;
    }

    get canInteract() {
        return this.root.active && this.root.parent === this.layers.outside;
    }

    advanceRig(dt: number) {
        if (!this.root.active) return;
        if (this.rig instanceof ResidentSpineRig) this.rig.advance(dt);
        if (this.reflection instanceof ResidentSpineRig && this.reflection.root.active)
            this.reflection.advance(dt);
    }

    render(life: CourtyardLife, hidden: boolean, dt = 1 / 60, held = false) {
        this.root.active = !hidden && life.opacity > 0;
        if (!this.root.active) return;
        const inDoorway = life.y < DOORSTEP_Y;
        const layer = inDoorway ? this.layers.doorway : this.layers.outside;
        if (this.root.parent !== layer) this.root.parent = layer;
        const depth = Math.max(0, Math.min(1, (life.y - DOORSTEP_Y) / 65));
        const perspective = 0.64 + 0.36 * depth * depth * (3 - 2 * depth);
        const footHeight = this.footHeight * perspective;
        this.seat = life.seatProgress;
        const lift = this.seat * 43 * this.scale;
        const groundY = (768 - life.y) * this.scale;
        this.root.setPosition(
            (life.x - 512) * this.scale + lift * 0.8,
            groundY + footHeight + lift,
        );
        this.opacity.opacity = Math.round(255 * life.opacity);
        this.shadow.setPosition(0, -footHeight - lift);
        this.shadow.active = !inDoorway && life.seatProgress === 0;
        const size = this.artScale * perspective;
        this.rig.root.setScale(size * life.facing, size, 1);
        const pose = held && moving.includes(life.action) ? 'idle' : leisurePose(life);
        this.clock += Math.min(0.05, dt);
        const movingNow = pose === 'walk' || pose === 'run';
        this.gait += (Number(movingNow) - this.gait) * (1 - Math.exp(-Math.min(0.05, dt) * 9));
        const activityProgress =
            life.action === 'sit'
                ? life.progress
                : life.action === 'rise'
                  ? 1 - life.progress
                  : life.action === 'rest'
                    ? 1
                    : 0;
        this.rig.animate(
            pose,
            this.clock,
            life.stride,
            life.seatProgress,
            activityProgress || (life.action === 'rise' || life.action === 'sit' ? 0 : 1),
            this.gait,
            undefined,
            life.elapsed,
        );
        this.reflection.root.active = life.action === 'rest' && life.activity === 'mirror';
        if (this.reflection.root.active) {
            this.reflection.root.setPosition(
                -17 * this.scale,
                -this.footHeight - 40 * this.artScale,
            );
            this.reflection.root.setScale(
                this.artScale * life.facing * 0.72,
                -this.artScale * 0.55,
                1,
            );
            this.reflection.animate(
                pose,
                this.clock,
                life.stride,
                0,
                1,
                this.gait,
                undefined,
                life.elapsed,
            );
        }
    }

    react(pose: ResidentPose, remaining: number, duration: number, food?: PetFood) {
        const strength = Math.min(1, remaining * 5, (duration - remaining) * 7);
        const elapsed = duration - remaining;
        this.rig.animate(pose, this.clock, 0, this.seat, strength, 0, food, elapsed, true);
        if (this.reflection.root.active)
            this.reflection.animate(pose, this.clock, 0, 0, strength, 0, undefined, elapsed, true);
    }
}
