import type { ResidentCondition, ResidentPlan } from './courtyardLife';
import { CourtyardLife } from './courtyardLife';

export const FEEDING_SPOT = { x: 503, y: 824 };

const paths = [
    { activity: 'sun', x: 422, y: 876, facing: 1 },
    { activity: 'look', x: 534, y: 921, facing: -1 },
    { activity: 'groom', x: 614, y: 864, facing: -1 },
    { activity: 'look', x: 349, y: 830, facing: 1 },
] satisfies ResidentPlan[];
const chair = { activity: 'chair', x: 714, y: 798, facing: 1 } satisfies ResidentPlan;
const drink = { activity: 'drink', x: 660, y: 800, facing: 1 } satisfies ResidentPlan;
const mirror = { activity: 'mirror', x: 776, y: 819, facing: -1 } satisfies ResidentPlan;
const pantry = { activity: 'pantry', x: 678, y: 825, facing: 1 } satisfies ResidentPlan;
const lantern = { activity: 'lantern', x: 326, y: 800, facing: -1 } satisfies ResidentPlan;
const food = {
    activity: 'hungry',
    x: FEEDING_SPOT.x - 52,
    y: FEEDING_SPOT.y + 14,
    facing: 1,
} satisfies ResidentPlan;

const pastimes = ['exercise', 'run', 'talk', 'read', 'news', 'game', 'sleep'] as const;
type Pastime = (typeof pastimes)[number];
const speech = ['今天的风真好', '主人，帮我分享下吧', '这里是我的小天地', '你来啦'];

/** Schedules the resident's visits around equipped furnishings and time of day. */
export class CourtyardColony {
    readonly resident: CourtyardLife;
    private living = '';
    garden = '';
    elapsed = 0;
    private condition: ResidentCondition = { hungry: false, tired: false, happy: false };
    private recent: ResidentPlan[] = [];
    private furnishingVisits = new Map<ResidentPlan, number>();
    private nextFoodVisit = 0;
    private remainingPastimes: Pastime[] = [];
    private lastPastime: Pastime | undefined;
    private freeStops = 0;
    private spoken = 0;

    private readonly random: () => number;

    constructor(random: () => number = Math.random) {
        this.random = random;
        this.resident = new CourtyardLife(random, 13);
        this.resident.stay('inside', 0.6);
        this.resident.choosePlan = (stop) => this.choose(stop);
    }

    private choose(stop: number): ResidentPlan {
        const fresh = (site: ResidentPlan) => !this.recent.includes(site);
        if (this.condition.hungry && this.elapsed >= this.nextFoodVisit && fresh(food)) {
            this.nextFoodVisit = this.elapsed + 55;
            this.remember(food);
            return { ...food, restSeconds: 4 };
        }
        const furnishings: ResidentPlan[] = [];
        if (this.living === 'leaf-bed') furnishings.push(chair);
        if (this.living === 'dew-pond') furnishings.push(drink, mirror);
        if (this.living === 'seed-pantry') furnishings.push(pantry);
        if (this.garden === 'lantern-garden') furnishings.push(lantern);

        const available = furnishings.filter(fresh);
        const last = this.recent[this.recent.length - 1];
        const visitFurniture =
            available.length > 0 &&
            (!last || (!furnishings.includes(last) && (stop === 0 || this.random() < 0.75)));
        const candidates = visitFurniture ? available : paths.filter(fresh);
        const { x, y } = this.resident;
        const nearby = candidates
            .map((site) => ({ site, distance: Math.hypot(site.x - x, site.y - y) }))
            .sort((a, b) => {
                const visitOrder =
                    (this.furnishingVisits.get(a.site) ?? -1) -
                    (this.furnishingVisits.get(b.site) ?? -1);
                return visitOrder || a.distance - b.distance;
            })
            .slice(0, 2);
        const [{ site: closest }] = nearby;
        const site =
            !visitFurniture && nearby.length > 1 && this.random() >= 0.65
                ? nearby[1].site
                : closest;
        if (visitFurniture) this.furnishingVisits.set(site, this.elapsed);
        this.remember(site);
        if (!visitFurniture && ++this.freeStops % 3 !== 1) return this.pastime(site);
        const happy = !visitFurniture && stop > 0 && this.condition.happy && this.random() < 0.18;
        return {
            ...site,
            activity: happy ? 'happy' : site.activity,
            restSeconds: happy ? 3 : (visitFurniture ? 5 : 3) + this.random() * 4,
        };
    }

    private pastime(site: ResidentPlan): ResidentPlan {
        if (!this.remainingPastimes.length)
            this.remainingPastimes = pastimes.filter((activity) => activity !== this.lastPastime);
        const start = Math.floor(this.random() * this.remainingPastimes.length);
        const ordered = [
            ...this.remainingPastimes.slice(start),
            ...this.remainingPastimes.slice(0, start),
        ];
        const activity = ordered.find((item) =>
            item === 'run'
                ? this.resident.y >= 798 &&
                  !this.condition.tired &&
                  Math.hypot(site.x - this.resident.x, site.y - this.resident.y) >= 65
                : item !== 'exercise' || !this.condition.tired,
        );
        if (!activity) {
            this.remainingPastimes = [];
            return { ...site, restSeconds: 5 };
        }
        this.remainingPastimes.splice(this.remainingPastimes.indexOf(activity), 1);
        this.lastPastime = activity;
        if (activity === 'run') return { ...site, run: true, restSeconds: 3.4 };
        if (activity === 'talk')
            return {
                ...site,
                activity,
                restSeconds: 5,
                speech: speech[this.spoken++ % speech.length],
            };
        return { ...site, activity, restSeconds: activity === 'sleep' ? 9 : 6.2 };
    }

    private remember(site: ResidentPlan) {
        this.recent = [...this.recent.slice(-1), site];
    }

    update(dt: number, living: string, garden: string, held = false, condition = this.condition) {
        dt = Math.min(0.05, Math.max(0, dt));
        this.elapsed += dt;
        this.living = living;
        this.garden = garden;
        this.condition = condition;
        if (!condition.hungry) this.resident.finishSeekingFood();
        if (held) return;
        const { activity, action } = this.resident;
        const visitEnded =
            (activity === 'lantern' && garden !== 'lantern-garden') ||
            ((activity === 'drink' || activity === 'mirror') && living !== 'dew-pond') ||
            (activity === 'pantry' && living !== 'seed-pantry');
        if (visitEnded && ['walk', 'sit', 'rest', 'rise'].includes(action))
            this.resident.leaveFurnishing(living === 'leaf-bed');
        this.resident.update(dt, living === 'leaf-bed', condition.tired);
    }
}
