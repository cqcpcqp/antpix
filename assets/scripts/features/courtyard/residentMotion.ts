export type PetFood = 'ration' | 'melon';
export type ResidentPose =
    | 'idle'
    | 'walk'
    | 'rest'
    | 'look'
    | 'groom'
    | 'sip'
    | 'pet'
    | 'petHappy'
    | 'eat'
    | 'cheer'
    | 'hungry'
    | 'run'
    | 'exercise'
    | 'read'
    | 'news'
    | 'game'
    | 'talk'
    | 'lieDown'
    | 'sleep'
    | 'lieUp'
    | 'chairDown'
    | 'chairRest'
    | 'chairUp'
    | 'mirror'
    | 'pantry'
    | 'lantern';

export const MEAL_DURATION = 4.15;

export function easeBetween(time: number, start: number, end: number) {
    const progress = Math.max(0, Math.min(1, (time - start) / (end - start)));
    return progress * progress * (3 - 2 * progress);
}

/** Samples reach, bites and swallow on the same clock for the hands, face and food. */
export function mealMotion(time: number) {
    const reach = easeBetween(time, 0.12, 0.53);
    const lift = easeBetween(time, 0.54, 0.92);
    const settle = easeBetween(time, 2.48, 3.2);
    const biteTimes = [1.02, 1.45, 1.88];
    let bites = 0;
    let crumbAge = 1;
    let open = 0;
    for (const bite of biteTimes) {
        open = Math.max(
            open,
            easeBetween(time, bite - 0.13, bite) * (1 - easeBetween(time, bite, bite + 0.105)),
        );
        if (time >= bite) {
            bites++;
            crumbAge = time - bite;
        }
    }
    const chewing =
        easeBetween(time, biteTimes[0], biteTimes[0] + 0.1) * (1 - easeBetween(time, 2.09, 2.3));
    const chew = Math.sin((time - biteTimes[0]) * 24) * chewing;
    const swallow = easeBetween(time, 2.17, 2.32) * (1 - easeBetween(time, 2.33, 2.58));
    const firstPat = easeBetween(time, 3.19, 3.37) * (1 - easeBetween(time, 3.38, 3.52));
    const secondPat = easeBetween(time, 3.52, 3.67) * (1 - easeBetween(time, 3.69, 3.95));
    return {
        reach,
        lift,
        settle,
        bites,
        crumbAge,
        open,
        chew,
        swallow,
        bellyPat: firstPat + secondPat,
        time,
    };
}

/** The foot stays low during stance and clears the ground only on the return swing. */
export function footCycle(stride: number, index: number) {
    const offsets = [0, 0.48, 0.66, 0.18];
    const phase = (stride / 2 + offsets[index]) % 1;
    if (phase < 0.64) return { sweep: 1 - (2 * phase) / 0.64, height: 0 };
    const swing = (phase - 0.64) / 0.36;
    return { sweep: -1 + 2 * easeBetween(swing, 0, 1), height: Math.sin(Math.PI * swing) ** 2 };
}

/** Converts a toe target into two joint angles in the downward-facing bone space. */
export function pointLimb(x: number, y: number, upper: number, lower: number, bend: number) {
    const distance = Math.min(
        upper + lower - 0.02,
        Math.max(Math.abs(upper - lower) + 0.02, Math.hypot(x, y)),
    );
    const angle = Math.acos((distance ** 2 - upper ** 2 - lower ** 2) / (2 * upper * lower)) * bend;
    const shoulder =
        Math.atan2(x, -y) - Math.atan2(lower * Math.sin(angle), upper + lower * Math.cos(angle));
    return { upper: (shoulder * 180) / Math.PI, lower: (angle * 180) / Math.PI };
}

export function armMotion(
    pose: ResidentPose,
    index: number,
    signals: {
        strength: number;
        stretch: number;
        fast: number;
        jump: number;
        step: number;
        gait: number;
        weight: number;
    },
) {
    const side = index === 0 ? -1 : 1;
    const { strength, stretch, fast, jump, step, gait, weight } = signals;
    let lift = stretch * 76;
    if (pose === 'cheer') lift = (44 + jump * 5) * strength;
    if (pose === 'sip') lift = 51 * strength;
    if (pose === 'groom' && index === 1) lift = (74 + fast * 7) * strength;
    if (pose === 'hungry' && index === 0) lift = (36 + fast * 6) * strength;
    if (pose === 'exercise') lift = jump * 5;
    if (['read', 'news', 'game'].includes(pose)) lift = 29 * strength + fast * 4;
    if (['pantry', 'lantern', 'mirror', 'talk'].includes(pose) && index === 1)
        lift = (25 + fast * 9) * strength;
    return {
        upper: side * (18 + lift) + Math.sin(step - index * Math.PI - 0.4) * 19 * gait,
        lower: side * (26 + lift * 0.48) - weight * 12,
    };
}
