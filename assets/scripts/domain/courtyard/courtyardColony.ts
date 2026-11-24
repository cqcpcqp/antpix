import type { ResidentCondition, ResidentPlan } from './courtyardLife';
import { CourtyardLife } from './courtyardLife';

/** Schedules the resident's visits around equipped furnishings and time of day. */
export class CourtyardColony {
    readonly resident: CourtyardLife;
    private living = '';
    garden = '';
    night = false;
    elapsed = 0;
    private condition: ResidentCondition = { hungry: false, tired: false, happy: false };

    private readonly random: () => number;

    constructor(random: () => number = Math.random) {
        this.random = random;
        this.resident = new CourtyardLife(random);
        this.resident.stay('inside', 0.6);
        this.resident.choosePlan = (stop) => this.choose(stop);
    }

    private choose(stop: number): ResidentPlan {
        if (stop % 2 === 0 && this.night && this.garden === 'lantern-garden')
            return { activity: 'lantern', x: 280, y: 820, facing: 1 };
        if (stop % 2 === 0 && this.living === 'leaf-bed')
            return { activity: 'chair', x: 714, y: 798, facing: 1 };
        if (this.living === 'dew-pond' && stop % 2 === 0) {
            return stop % 4 === 0
                ? { activity: 'drink', x: 660, y: 800, facing: 1 }
                : { activity: 'mirror', x: 810, y: 805, facing: -1 };
        }
        const activities = ['sun', 'look', 'groom'] as const;
        const special =
            stop === 1 && this.condition.hungry
                ? 'hungry'
                : stop === 3 && this.condition.happy && this.random() < 0.6
                  ? 'happy'
                  : null;
        return {
            activity: special ?? activities[stop % activities.length],
            x: stop % 2 === 0 ? 438 : 580,
            y: (stop % 2 === 0 ? 866 : 928) + this.random() * 20,
            facing: 1,
        };
    }

    update(
        dt: number,
        living: string,
        garden: string,
        hour: number,
        held = false,
        condition = this.condition,
    ) {
        dt = Math.min(0.05, Math.max(0, dt));
        this.elapsed += dt;
        this.living = living;
        this.garden = garden;
        this.night = hour >= 18 || hour < 6;
        this.condition = condition;
        if (held) return;
        const { activity, action } = this.resident;
        const visitEnded =
            (activity === 'lantern' && (!this.night || garden !== 'lantern-garden')) ||
            ((activity === 'drink' || activity === 'mirror') && living !== 'dew-pond');
        if (visitEnded && ['walk', 'sit', 'rest', 'rise'].includes(action))
            this.resident.leaveFurnishing(living === 'leaf-bed');
        this.resident.update(dt, living === 'leaf-bed', condition.tired);
    }
}
