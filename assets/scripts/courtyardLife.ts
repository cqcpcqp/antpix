/** Homepage-only life simulation, in the background's 1024 × 1536 coordinates. */
export type ResidentAction =
    'inside' | 'emerge' | 'walk' | 'sit' | 'rest' | 'rise' | 'return' | 'enter' | 'wait' | 'carry';
export type ResidentActivity = 'sun' | 'chair' | 'drink' | 'mirror' | 'party' | 'seed';
export interface ResidentPlan {
    activity: ResidentActivity;
    x: number;
    y: number;
    facing: number;
}
export class CourtyardLife {
    activity: ResidentActivity = 'sun';
    plan: ResidentPlan | null = null;
    choosePlan: (() => ResidentPlan) | null = null;
    pausedForTraffic = false;
    identity = 0;
    avoidX = 0;
    avoidY = 0;
    action: ResidentAction = 'inside';
    x = 510;
    y = 672;
    elapsed = 0;
    stride = 0;
    facing = 1;
    back = false;
    chair = false;
    private duration = 1;
    private fromX = 510;
    private fromY = 672;
    private targetX = 510;
    private targetY = 672;
    private cycle = 0;
    private restTime = 8;
    private riseFrom = 1;
    private random: () => number;
    constructor(random: () => number = Math.random) {
        this.random = random;
    }

    move(action: ResidentAction, x: number, y: number) {
        this.action = action;
        this.elapsed = 0;
        this.fromX = this.x;
        this.fromY = this.y;
        this.targetX = x;
        this.targetY = y;
        this.duration = Math.max(0.8, Math.hypot(x - this.x, y - this.y) / 32);
        this.facing = x < this.x ? -1 : 1;
        this.back = y < this.y;
    }
    stay(action: ResidentAction, seconds: number) {
        this.action = action;
        this.elapsed = 0;
        this.duration = seconds;
    }
    update(dt: number, leafChair: boolean) {
        // A removed chair releases the resident through its normal rise animation.
        if (this.chair && !leafChair && ['walk', 'sit', 'rest'].includes(this.action)) {
            if (this.action === 'walk') {
                this.chair = false;
                this.move('return', 510, 727);
            } else {
                this.riseFrom = this.seatProgress;
                this.stay('rise', 1.1);
            }
        }
        if (this.pausedForTraffic) return;
        this.elapsed += Math.min(Math.max(dt, 0), 0.05);
        const moving = ['emerge', 'walk', 'return', 'enter', 'carry'].includes(this.action);
        if (moving) {
            const t = Math.min(1, this.elapsed / this.duration);
            const ease = t * t * (3 - 2 * t);
            const x = this.fromX + (this.targetX - this.fromX) * ease;
            const y = this.fromY + (this.targetY - this.fromY) * ease;
            this.stride += Math.hypot(x - this.x, y - this.y) / 11;
            this.x = x;
            this.y = y;
        }
        if (this.elapsed < this.duration) return;
        switch (this.action) {
            case 'inside':
                this.chair = false;
                this.move('emerge', 510, 727);
                break;
            case 'emerge':
                if (this.choosePlan) {
                    this.plan = this.choosePlan();
                    this.activity = this.plan.activity;
                    this.chair = this.activity === 'chair';
                    this.restTime = 6 + this.random() * 7;
                    this.move('walk', this.plan.x, this.plan.y);
                    break;
                }
                this.chair = leafChair;
                this.activity = leafChair ? 'chair' : 'sun';
                this.restTime = 7 + this.random() * 6;
                this.move(
                    'walk',
                    leafChair ? 714 : this.cycle % 2 ? 450 : 540,
                    leafChair ? 798 : 885 + this.random() * 20,
                );
                break;
            case 'walk':
                this.facing = this.plan ? this.plan.facing : 1;
                this.back = false;
                this.stay(
                    this.activity === 'seed' ? 'wait' : 'sit',
                    this.activity === 'seed' ? 30 : 1.1,
                );
                break;
            case 'sit':
                this.stay('rest', this.restTime);
                break;
            case 'rest':
                this.riseFrom = 1;
                this.stay('rise', 1.1);
                break;
            case 'rise':
                this.goHome();
                break;
            case 'return':
                this.move('enter', 510, 672);
                break;
            case 'carry':
                this.stay('wait', 30);
                break;
            case 'wait':
                this.goHome();
                break;
            case 'enter':
                this.cycle++;
                this.stay('inside', 3 + this.random() * 5);
                break;
        }
    }
    goHome() {
        this.chair = false;
        this.activity = 'sun';
        this.plan = null;
        this.move('return', 510, 727);
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
    get frame() {
        if (this.action === 'carry' || (this.action === 'wait' && this.activity === 'seed'))
            return 10;
        if (this.action === 'rest') {
            if (this.activity === 'drink') return 8;
            if (this.activity === 'mirror') return 9;
            if (this.activity === 'party') return Math.floor(this.elapsed * 0.8) % 3 === 0 ? 11 : 4;
            return this.chair ? 6 : 5;
        }
        if (this.action === 'sit' || this.action === 'rise') {
            if (this.activity === 'party') return 4;
            if (this.activity === 'drink' || this.activity === 'mirror') {
                const interacting =
                    this.action === 'sit' ? this.progress >= 0.5 : this.progress < 0.5;
                return interacting ? (this.activity === 'drink' ? 8 : 9) : 7;
            }
        }
        if (this.action === 'sit') return this.progress < 0.5 ? 7 : this.chair ? 6 : 5;
        if (this.action === 'rise') return this.progress < 0.5 ? 7 : 4;
        if (['emerge', 'walk', 'return', 'enter', 'carry'].includes(this.action))
            return (this.back ? 2 : 0) + (Math.floor(this.stride) % 2);
        return 4;
    }
}
