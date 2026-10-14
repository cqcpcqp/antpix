import type { Level } from '../levels/levels';
import type { Jar } from './model';

/** Build the five precedence-preserving stacks before the model permutes columns. */
export function createContainerColumns(
    level: Level,
    pixels: readonly number[],
    random: () => number,
): Jar[][] {
    const columns: Jar[][] = Array.from({ length: 5 }, () => []);
    let serial = 0;
    const jars: Jar[] = [];
    if (level.containerPlans) {
        const plan = level.containerPlans[Math.floor(random() * level.containerPlans.length)];
        for (const [color, capacity, column] of plan)
            columns[column].push({
                id: serial++,
                color,
                capacity,
                remaining: capacity,
            });
    } else {
        // Synthetic test boards retain their explicitly requested fixed capacities.
        const counts = new Map<number, number>();
        pixels.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
        counts.forEach((count, color) => {
            while (count > 0) {
                const capacity = Math.min(count, level.capacity);
                jars.push({
                    id: serial++,
                    color,
                    capacity,
                    remaining: capacity,
                });
                count -= capacity;
            }
        });
        jars.forEach((jar, index) => columns[index % 5].push(jar));
    }
    return columns;
}
