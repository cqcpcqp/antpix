import { CourtyardLife } from './courtyardLife';
import type { ResidentPlan } from './courtyardLife';

/** Local ambience only: no currency, save changes or server calls. */
export class CourtyardColony {
    readonly residents: CourtyardLife[];
    living = '';
    garden = '';
    night = false;
    elapsed = 0;
    seedPhase: 'idle' | 'gather' | 'carry' | 'lower' = 'idle';
    seedX = 532;
    seedY = 862;
    private seedTimer = 0;
    private seedCooldown = 0;
    private seedStartX = 0;
    private seedStartY = 0;
    private doorwayOwner = -1;
    private random: () => number;
    constructor(random: () => number = Math.random) {
        this.random = random;
        this.residents = [0, 1, 2].map((id) => {
            const resident = new CourtyardLife(random);
            resident.identity = id;
            resident.stay('inside', 0.6 + id * 4.5);
            resident.choosePlan = () => this.choose(id);
            return resident;
        });
    }
    private choose(id: number): ResidentPlan {
        const others = this.residents.filter((_, i) => i !== id);
        const busy = (activity: string) =>
            others.some(
                (r) =>
                    r.activity === activity && ['walk', 'sit', 'rest', 'rise'].includes(r.action),
            );
        if (this.seedPhase === 'gather' && id < 2)
            return { activity: 'seed', x: 500 + id * 64, y: 862, facing: id === 0 ? 1 : -1 };
        if (this.night && this.garden === 'lantern-garden')
            return {
                activity: 'party',
                x: 225 + id * 64,
                y: 820 + (id === 1 ? 30 : 0),
                facing: id === 2 ? -1 : 1,
            };
        if (this.living === 'leaf-bed' && !busy('chair') && (id === 0 || this.random() < 0.6))
            return { activity: 'chair', x: 714, y: 798, facing: 1 };
        if (this.living === 'dew-pond') {
            const activity = id === 2 ? 'mirror' : 'drink';
            if (!busy(activity))
                return {
                    activity,
                    x: activity === 'drink' ? 660 : 810,
                    y: activity === 'drink' ? 800 : 805,
                    facing: activity === 'drink' ? 1 : -1,
                };
        }
        return {
            activity: 'sun',
            x: 420 + id * 65,
            y: 885 + this.random() * 22,
            facing: id === 2 ? -1 : 1,
        };
    }
    update(dt: number, living: string, garden: string, hour: number) {
        dt = Math.min(0.05, Math.max(0, dt));
        this.elapsed += dt;
        this.living = living;
        this.garden = garden;
        this.night = hour >= 18 || hour < 6;
        this.seedCooldown = Math.max(0, this.seedCooldown - dt);
        if (living !== 'seed-pantry' && this.seedPhase !== 'idle') this.cancelSeed();
        // Reserve the seed team before they leave home, so both can rendezvous.
        if (
            living === 'seed-pantry' &&
            this.seedPhase === 'idle' &&
            this.seedCooldown === 0 &&
            !(this.night && garden === 'lantern-garden')
        ) {
            this.seedPhase = 'gather';
            this.seedTimer = 0;
        }
        if (
            this.doorwayOwner >= 0 &&
            !['emerge', 'return', 'enter'].includes(this.residents[this.doorwayOwner].action)
        )
            this.doorwayOwner = -1;
        for (const [id, r] of this.residents.entries()) {
            if (
                r.activity === 'party' &&
                (!this.night || garden !== 'lantern-garden') &&
                ['walk', 'sit', 'rest', 'rise'].includes(r.action)
            )
                r.goHome();
            if (
                (r.activity === 'drink' || r.activity === 'mirror') &&
                living !== 'dew-pond' &&
                ['walk', 'sit', 'rest', 'rise'].includes(r.action)
            )
                r.goHome();
            const doorway =
                ['inside', 'emerge', 'enter'].includes(r.action) ||
                (r.action === 'return' && Math.hypot(r.x - 510, r.y - 727) < 60);
            if (doorway && this.doorwayOwner < 0) this.doorwayOwner = id;
            // A sleeping resident never holds up the door.
            if (r.action === 'inside' && r.progress < 0.99) {
                if (this.doorwayOwner === id) this.doorwayOwner = -1;
            }
            r.pausedForTraffic = doorway && this.doorwayOwner >= 0 && this.doorwayOwner !== id;
            // Different waypoints keep leisure spots apart; lower IDs have priority when paths meet.
            if (!doorway && r.action === 'walk' && r.activity !== 'seed') {
                r.pausedForTraffic = this.residents.some(
                    (o, i) =>
                        i < id &&
                        o.opacity > 0.8 &&
                        o.action === 'walk' &&
                        Math.hypot(o.x - r.x, o.y - r.y) < 35,
                );
            }
            if (this.seedPhase === 'carry' && id < 2) continue;
            if (r.activity === 'seed' && r.action === 'wait' && this.seedPhase !== 'idle') continue;
            r.update(dt, living === 'leaf-bed');
        }
        this.updateSeed(dt);
        // Ease a small sidestep into crossing routes, without changing interaction anchors.
        for (const r of this.residents) {
            let x = 0,
                y = 0;
            if (['walk', 'return'].includes(r.action) && r.opacity > 0.9) {
                for (const other of this.residents) {
                    if (other === r || other.opacity < 0.9) continue;
                    const dx = r.x - other.x,
                        dy = r.y - other.y;
                    const d = Math.hypot(dx, dy);
                    if (d > 0 && d < 48) {
                        x += (dx / d) * (48 - d) * 0.6;
                        y += (dy / d) * (48 - d) * 0.6;
                    }
                }
            }
            r.avoidX += (x - r.avoidX) * Math.min(1, dt * 5);
            r.avoidY += (y - r.avoidY) * Math.min(1, dt * 5);
        }
    }
    private cancelSeed() {
        for (const r of this.residents.slice(0, 2)) if (r.activity === 'seed') r.goHome();
        this.seedPhase = 'idle';
        this.seedCooldown = 18;
        this.seedTimer = 0;
    }
    private updateSeed(dt: number) {
        if (this.seedPhase === 'idle') return;
        this.seedTimer += dt;
        const [a, b] = this.residents;
        if (this.seedPhase === 'gather') {
            if (this.seedTimer > 100) {
                this.cancelSeed();
                return;
            }
            if (
                a.activity === 'seed' &&
                b.activity === 'seed' &&
                a.action === 'wait' &&
                b.action === 'wait'
            ) {
                this.seedPhase = 'carry';
                this.seedTimer = 0;
                this.seedStartX = (a.x + b.x) / 2;
                this.seedStartY = (a.y + b.y) / 2;
                this.seedX = this.seedStartX;
                this.seedY = this.seedStartY;
                a.action = 'carry';
                b.action = 'carry';
                a.back = false;
                b.back = false;
                a.facing = 1;
                b.facing = -1;
            }
        } else if (this.seedPhase === 'carry') {
            const t = Math.min(1, this.seedTimer / 8);
            const ease = t * t * (3 - 2 * t);
            this.seedX = this.seedStartX + (735 - this.seedStartX) * ease;
            this.seedY = this.seedStartY + (825 - this.seedStartY) * ease;
            for (const [i, r] of [a, b].entries()) {
                const x = this.seedX + (i === 0 ? -32 : 32),
                    y = this.seedY;
                r.stride += Math.hypot(r.x - x, r.y - y) / 11;
                r.x = x;
                r.y = y;
                r.elapsed += dt;
            }
            if (t === 1) {
                this.seedPhase = 'lower';
                this.seedTimer = 0;
                a.action = 'wait';
                b.action = 'wait';
            }
        } else if (this.seedTimer >= 1.2) this.cancelSeed();
    }
}
