/** Homepage-only life simulation, in the background's 1024 × 1536 coordinates. */
export type ResidentAction =
    'inside' | 'emerge' | 'walk' | 'run' | 'sit' | 'rest' | 'rise' | 'return' | 'enter';
export type ResidentActivity =
    | 'sun'
    | 'chair'
    | 'drink'
    | 'mirror'
    | 'pantry'
    | 'lantern'
    | 'look'
    | 'groom'
    | 'hungry'
    | 'happy'
    | 'exercise'
    | 'read'
    | 'news'
    | 'game'
    | 'sleep'
    | 'talk';
export interface ResidentPlan {
    activity: ResidentActivity;
    x: number;
    y: number;
    facing: number;
    restSeconds?: number;
    run?: boolean;
    speech?: string;
}
export const DOORSTEP_Y = 727;
export const RESIDENT_TRANSITION_SECONDS = 1.1;

export interface ResidentCondition {
    hungry: boolean;
    tired: boolean;
    happy: boolean;
}

export class CourtyardLife {
    activity: ResidentActivity = 'sun';
    plan: ResidentPlan | null = null;
    choosePlan: ((stop: number) => ResidentPlan) | null = null;
    action: ResidentAction = 'inside';
    x = 510;
    y = 672;
    elapsed = 0;
    stride = 0;
    facing = 1;
    chair = false;
    private duration = 1;
    private fromX = 510;
    private fromY = 672;
    private targetX = 510;
    private targetY = 672;
    private cycle = 0;
    private stop = 0;
    private stopsPerOuting = 3;
    private restTime = 8;
    private riseFrom = 1;
    private random: () => number;
    private readonly outdoorStops: number;
    constructor(random: () => number = Math.random, outdoorStops = 3) {
        this.random = random;
        this.outdoorStops = outdoorStops;
    }

    move(action: ResidentAction, x: number, y: number) {
        this.action = action;
        this.elapsed = 0;
        this.fromX = this.x;
        this.fromY = this.y;
        this.targetX = x;
        this.targetY = y;
        const speed = action === 'run' ? 80 : 32;
        this.duration = Math.max(0.8, Math.hypot(x - this.x, y - this.y) / speed);
        this.facing = x < this.x ? -1 : 1;
    }
    stay(action: ResidentAction, seconds: number) {
        this.action = action;
        this.elapsed = 0;
        this.duration = seconds;
    }
    update(dt: number, leafChair: boolean, tired = false) {
        // A removed chair releases the resident through its normal rise animation.
        if (this.chair && !leafChair && ['walk', 'sit', 'rest'].includes(this.action)) {
            if (this.action === 'walk') {
                this.visit(false);
            } else {
                this.riseFrom = this.seatProgress;
                this.stay('rise', RESIDENT_TRANSITION_SECONDS);
            }
        }
        const moving = ['emerge', 'walk', 'run', 'return', 'enter'].includes(this.action);
        this.elapsed += Math.min(Math.max(dt, 0), 0.05) * (moving && tired ? 0.8 : 1);
        if (moving) {
            const t = Math.min(1, this.elapsed / this.duration);
            const ease = t * t * (3 - 2 * t);
            const x = this.fromX + (this.targetX - this.fromX) * ease;
            const detour = this.action === 'run' ? Math.sin(ease * Math.PI) * 23 : 0;
            const y = this.fromY + (this.targetY - this.fromY) * ease + detour;
            this.stride += Math.hypot(x - this.x, y - this.y) / 11;
            this.x = x;
            this.y = y;
        }
        if (this.elapsed < this.duration) return;
        switch (this.action) {
            case 'inside':
                this.chair = false;
                this.stop = 0;
                this.stopsPerOuting =
                    this.outdoorStops + Number(tired) + Math.floor(this.random() * 2);
                this.move('emerge', 510, DOORSTEP_Y);
                break;
            case 'emerge':
                this.visit(leafChair);
                break;
            case 'walk':
            case 'run':
                this.facing = this.plan ? this.plan.facing : 1;
                this.stay('sit', RESIDENT_TRANSITION_SECONDS);
                break;
            case 'sit':
                this.stay('rest', this.restTime * (tired ? 1.2 : 1));
                break;
            case 'rest':
                this.riseFrom = 1;
                this.stay('rise', RESIDENT_TRANSITION_SECONDS);
                break;
            case 'rise':
                if (++this.stop < this.stopsPerOuting) this.visit(leafChair);
                else this.goHome();
                break;
            case 'return':
                this.move('enter', 510, 672);
                break;
            case 'enter':
                this.cycle++;
                this.stay('inside', 1.6 + this.random() * 1.2);
                break;
        }
    }
    private visit(leafChair: boolean) {
        this.plan = this.choosePlan?.(this.stop) ?? {
            activity: leafChair ? 'chair' : 'sun',
            x: leafChair ? 714 : (this.cycle + this.stop) % 2 ? 450 : 540,
            y: leafChair ? 798 : 885 + this.random() * 20,
            facing: 1,
        };
        this.activity = this.plan.activity;
        this.chair = this.activity === 'chair';
        this.restTime =
            this.plan.restSeconds ??
            (this.activity === 'hungry' || this.activity === 'happy' ? 3 : 16 + this.random() * 9);
        this.move(this.plan.run ? 'run' : 'walk', this.plan.x, this.plan.y);
    }
    finishSeekingFood() {
        if (this.plan?.activity !== 'hungry') return;
        this.plan.activity = 'look';
        this.activity = 'look';
    }
    leaveFurnishing(leafChair: boolean) {
        this.visit(leafChair);
    }
    goHome() {
        this.chair = false;
        this.activity = 'sun';
        this.plan = null;
        this.move('return', 510, DOORSTEP_Y);
    }
    get progress() {
        return Math.min(1, this.elapsed / this.duration);
    }
    get seatProgress() {
        if (!this.chair) return 0;
        if (this.action === 'sit') return this.progress;
        if (this.action === 'rise') return this.riseFrom * (1 - this.progress);
        return this.action === 'rest' ? 1 : 0;
    }
    get opacity() {
        if (this.action === 'inside') return 0;
        return Math.max(0, Math.min(1, (this.y - 676) / 38));
    }
}
