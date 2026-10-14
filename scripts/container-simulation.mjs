// Offline analysis: resolve all reachable work between selections. This measures
// decisions, not animation time or human win rates. No extra slots or ads.
import { GRID_WIDTH, GRID_HEIGHT } from '../assets/scripts/levels.ts';
import { GardenModel } from '../assets/scripts/model.ts';
import { AntTargetSearch, nearestAntTarget } from '../assets/scripts/routing.ts';
import headless from './headless-game.cjs';
const { worldToGrid, collectionSlotX, collectionSlotY } = headless.load(
  new URL('../assets/scripts/boardLayout.ts', import.meta.url).pathname,
);

// Four-way collection closure, entering only from the bottom edge.
export function colorClosure(pixels, width, height, color) {
  const seen = new Uint8Array(pixels.length),
    queue = [],
    result = [];
  const visit = (p) => {
    if (!seen[p] && (pixels[p] < 0 || pixels[p] === color)) {
      seen[p] = 1;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) visit((height - 1) * width + x);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      x = p % width,
      y = Math.floor(p / width);
    if (pixels[p] === color) result.push(p);
    if (x > 0) visit(p - 1);
    if (x + 1 < width) visit(p + 1);
    if (y > 0) visit(p - width);
    if (y + 1 < height) visit(p + width);
  }
  return result;
}

export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Preserve production slot positions; scale the same layout for small rule fixtures.
function collectionOrigin(level, slot) {
  const point = worldToGrid({ x: collectionSlotX(slot, 5), y: collectionSlotY(slot) + 42 });
  return {
    x: ((point.x + 0.5) * level.width) / GRID_WIDTH - 0.5,
    y: point.y - GRID_HEIGHT + level.height,
  };
}

export function settleContainers(model, nearest = false) {
  const search = new AntTargetSearch();
  let collected = 0,
    progressed = true;
  while (progressed) {
    progressed = false;
    for (let slot = 0; slot < model.slots.length; slot++) {
      let pickup;
      if (nearest) {
        const target = nearestAntTarget(
          { ...model.level, pixels: model.pixels },
          collectionOrigin(model.level, slot),
          model.availableTargets(slot),
          0.45,
          search,
        );
        if (!target) continue;
        pickup = model.pick(slot, target);
      } else pickup = model.pick(slot);
      if (!pickup) continue;
      if (!model.lift(pickup)) throw new Error('Simulated pickup must be reachable');
      model.arrive(pickup);
      collected++;
      progressed = true;
    }
  }
  return collected;
}

export function simulatePlan(level, plan, { policy = 'exposed', seed = 1, nearest = false } = {}) {
  const random = seededRandom(seed);
  const model = new GardenModel({ ...level, containerPlans: [plan] }, random);
  let maxStalled = 0,
    singleColorChoices = 0,
    decisions = 0,
    nextId = 0;
  while (!model.complete && !model.blocked) {
    if (++decisions > plan.length + 1) throw new Error('Container simulation did not terminate');
    const heads = model.columns.map((c) => c[0]).filter(Boolean);
    if (!heads.length || !model.slots.includes(null)) throw new Error('No legal simulation move');
    if (new Set(heads.map((j) => j.color)).size === 1) singleColorChoices++;
    let choices = heads;
    if (policy === 'witness') {
      choices = heads.filter((j) => j.id === nextId);
      nextId++;
    } else if (policy === 'exposed' || policy === 'capacity') {
      const exposed = new Set(model.exposedPixels.map((p) => model.pixels[p]));
      const matching = heads.filter((j) => exposed.has(j.color));
      if (matching.length) choices = matching;
      if (policy === 'capacity') {
        const finishable = matching.filter((jar) => {
          const waiting = model.slots
            .filter((j) => j?.color === jar.color)
            .reduce((sum, j) => sum + j.remaining, 0);
          return (
            colorClosure(model.pixels, level.width, level.height, jar.color).length >=
            jar.capacity + waiting
          );
        });
        if (finishable.length) choices = finishable;
      }
    } else if (policy !== 'random') throw new Error(`Unknown policy: ${policy}`);
    if (!choices.length) throw new Error('Witness container is hidden');
    const jar = choices[Math.floor(random() * choices.length)];
    if (model.place(jar.id) < 0) throw new Error('Simulation selected an illegal container');
    settleContainers(model, nearest);
    maxStalled = Math.max(maxStalled, model.slots.filter(Boolean).length);
  }
  return {
    win: model.complete,
    moves: model.moves,
    collected: model.collected,
    maxStalled,
    singleColorChoices,
  };
}

export function planMetrics(plan) {
  const columns = Array.from({ length: 5 }, () => []);
  const runs = [];
  for (const [color, capacity, column] of plan) {
    columns[column].push([color, capacity]);
    if (runs.at(-1)?.color === color) runs.at(-1).count++;
    else runs.push({ color, count: 1 });
  }
  return {
    containers: plan.length,
    openingColors: new Set(columns.filter((c) => c.length).map((c) => c[0][0])).size,
    maxRun: Math.max(...runs.map((r) => r.count)),
    longRunContainers: runs.filter((r) => r.count >= 5).reduce((s, r) => s + r.count, 0),
    columnLengths: columns.map((c) => c.length),
    minCapacity: Math.min(...plan.map((j) => j[1])),
    maxCapacity: Math.max(...plan.map((j) => j[1])),
  };
}
