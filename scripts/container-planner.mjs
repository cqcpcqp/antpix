import { GardenModel } from '../assets/scripts/domain/game/model.ts';
import {
  colorClosure,
  seededRandom,
  settleContainers,
  simulatePlan,
  planMetrics,
} from './container-simulation.mjs';

export { colorClosure } from './container-simulation.mjs';

// Ordered entries retain a replayable solution; the third value explicitly assigns
// each entry to a column. Increasing ids within each column preserve that solution.
export function distributeColumns(jars, seed, concentration = 6, openingCopies = 1) {
  const random = seededRandom(seed),
    columns = Array.from({ length: 5 }, () => []);
  return jars.map(([color, capacity]) => {
    const openingColor = jars[0][0];
    const missingOpeners = openingCopies - columns.filter((c) => c[0]?.[0] === openingColor).length;
    const emptyCount = columns.filter((c) => !c.length).length;
    const candidates = columns
      .map((c, column) => ({
        column,
        score: c.length - (c.at(-1)?.[0] === color ? concentration : 0) + random() * 0.8,
      }))
      .filter((c) => {
        const column = columns[c.column];
        // Reserve enough empty columns for two immediately completable openers
        // when the artwork permits it; avoid five different but mostly locked heads.
        if (missingOpeners > 0 && color === openingColor) return !column.length;
        if (missingOpeners > 0 && emptyCount <= missingOpeners && !column.length) return false;
        return true;
      });
    candidates.sort((a, b) => a.score - b.score);
    const column = candidates[0].column;
    columns[column].push([color, capacity]);
    return [color, capacity, column];
  });
}

export function planContainers(level, seed = 1, difficulty = 0) {
  const random = seededRandom(seed);
  // Use production nearest-contact pickup when constructing the witness. Partial
  // color collection changes which colors open next, so abstract flood order is insufficient.
  const model = new GardenModel({ ...level, containerPlans: undefined }, () => 0);
  model.columns.forEach((c) => (c.length = 0));
  const colors = [...new Set(level.pixels)].filter((c) => c >= 0),
    jars = [];
  let lastColor = -1,
    streak = 0,
    stages = 0,
    dependencies = 0;
  while (model.remaining) {
    const activeColors = new Set(model.slots.filter(Boolean).map((j) => j.color));
    const candidates = colors
      .filter((color) => !activeColors.has(color))
      .map((color) => ({
        color,
        count: colorClosure(model.pixels, level.width, level.height, color).length,
      }))
      .filter((c) => c.count > 0);
    if (!candidates.length) throw new Error('No reachable color');
    for (const c of candidates) {
      c.capacity = Math.ceil(c.count / Math.ceil(c.count / level.capacity));
      // Productive containers first; avoid repeating a color when another useful
      // color is available. Small unavoidable tails are still collected exactly.
      c.score =
        Math.min(c.count / level.capacity, 1) * 2 -
        (c.color === lastColor ? Math.min(streak, 3) * 0.85 : 0) +
        random() * 0.5;
    }
    candidates.sort((a, b) => b.score - a.score || a.color - b.color);
    const chosen = candidates[0],
      id = jars.length;
    // Introduce a bounded number of visible cross-color dependencies after the
    // tutorial. Only one unfinished container is allowed on the witness path.
    // The remaining four slots can always collect an exposed, unallocated color.
    const total = model.pixels.filter((c) => c === chosen.color).length;
    if (
      difficulty > 0.1 &&
      id >= 8 &&
      !activeColors.size &&
      chosen.count >= 8 &&
      chosen.count < level.capacity &&
      total > chosen.count &&
      dependencies < Math.ceil(difficulty * 4) &&
      random() < 0.25
    ) {
      chosen.capacity = Math.min(
        level.capacity,
        total,
        chosen.count + 8 + Math.floor(random() * 9),
      );
      dependencies++;
    }
    jars.push([chosen.color, chosen.capacity]);
    model.columns[0].push({
      id,
      color: chosen.color,
      capacity: chosen.capacity,
      remaining: chosen.capacity,
    });
    if (model.place(id) < 0) throw new Error('Witness must have a free slot');
    settleContainers(model, true);
    if (model.slots.filter(Boolean).length > 1)
      throw new Error('Witness exceeds dependency budget');
    if (chosen.color === lastColor) streak++;
    else {
      lastColor = chosen.color;
      streak = 1;
      stages++;
    }
  }
  return { jars, stages, dependencies };
}

// Candidate layouts are evaluated with fixed training seeds. The independent
// evaluation command uses different seeds and real-path replay for validation.
export function selectLayout(level, jars, seed, difficulty = 0.5) {
  const targetWinRate = 0.9 - difficulty * 0.4;
  const openingColor = jars[0][0];
  const firstTwo = jars.filter((j) => j[0] === openingColor).slice(0, 2);
  const openingCopies =
    firstTwo.length === 2 &&
    firstTwo[0][1] + firstTwo[1][1] <=
      colorClosure(level.pixels, level.width, level.height, openingColor).length
      ? 2
      : 1;
  const candidates = Array.from({ length: 8 }, (_, i) => {
    const plan = distributeColumns(jars, seed + i * 7919, 3 + (i % 4) * 2, openingCopies);
    const metrics = planMetrics(plan);
    const runs = Array.from({ length: 4 }, (_, trial) =>
      simulatePlan(level, plan, { seed: 701 + trial * 1009, policy: 'exposed' }),
    );
    const wins = runs.filter((r) => r.win).length;
    const earlyFailures = runs.filter(
      (r) => !r.win && r.collected < level.pixels.length * 0.15,
    ).length;
    const spread = Math.max(...metrics.columnLengths) - Math.min(...metrics.columnLengths);
    const score =
      Math.abs(wins / runs.length - targetWinRate) * 4 +
      earlyFailures * 0.75 +
      Math.max(0, 3 - metrics.openingColors) * 0.6 +
      spread * 0.015;
    return { plan, metrics, trainingWins: wins, score };
  });
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

// 24 colors × 40 capacities × 5 columns = 4800 values; two base-85
// characters fit all fields without increasing the original two-byte card size.
export const PLAN_DIGITS =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
export function encodeContainerPlan(plan, swatches) {
  return plan
    .map(([color, count, column]) => {
      const local = swatches.indexOf(color);
      if (
        local < 0 ||
        local >= 24 ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > 40 ||
        !Number.isInteger(column) ||
        column < 0 ||
        column > 4
      )
        throw new Error('Invalid container plan entry');
      const value = (local * 40 + count - 1) * 5 + column;
      return PLAN_DIGITS[Math.floor(value / 85)] + PLAN_DIGITS[value % 85];
    })
    .join('');
}
