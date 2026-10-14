const assert = require('node:assert/strict');
const { load } = require('./headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { GardenModel } = load(process.cwd() + '/assets/scripts/domain/game/model.ts');
const { GRID_WIDTH, GRID_HEIGHT } = load(process.cwd() + '/assets/scripts/domain/levels/levels.ts');
const PIXEL_COUNT = GRID_WIDTH * GRID_HEIGHT;
const { clearSegment } = load(process.cwd() + '/assets/scripts/domain/routing/routing.ts');
const { worldToGrid } = load(process.cwd() + '/assets/scripts/presentation/boardLayout.ts');
const g = new PixelGarden();
g.onLoad();
g.runtime.session.startLevel(0);
// A waiting route must not rescan its entire corridor while real obstacles are unchanged.
const checkedRoutes = new WeakMap(),
  scanRoute = g.runtime.flights.routeHasBlockedSegment.bind(g.runtime.flights);
let rescansAfterRemoval = 0;
g.runtime.flights.routeHasBlockedSegment = (route) => {
  const lastRemaining = checkedRoutes.get(route);
  assert.notEqual(
    lastRemaining,
    g.runtime.session.model.remaining,
    'unchanged obstacles must reuse the whole-route result',
  );
  if (lastRemaining !== undefined) rescansAfterRemoval++;
  checkedRoutes.set(route, g.runtime.session.model.remaining);
  return scanRoute(route);
};
const pixels = Array(PIXEL_COUNT).fill(1);
for (let row = 0; row < GRID_HEIGHT; row++)
  pixels[row * GRID_WIDTH + Math.floor(GRID_WIDTH / 2)] = 0;
g.runtime.session.model = new GardenModel(
  {
    name: 'narrow chain',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels,
    capacity: PIXEL_COUNT,
  },
  () => 0.5,
);
g.runtime.session.model.place(g.runtime.session.model.queue.find((j) => j.color === 0).id);
g.runtime.containers.drawSlots();
g.runtime.queue.drawQueue();
g.update(0.016);
const first = g.runtime.flights.flights[0];
assert.equal(first.pickup.pixel, (GRID_HEIGHT - 1) * GRID_WIDTH + Math.floor(GRID_WIDTH / 2));
// Hold the prerequisite worker back to force followers to reach blocked paths.
for (let i = 0; i < 11; i++) {
  first.elapsed = 0;
  g.update(0.05);
}
assert.equal(
  g.runtime.flights.flights.length,
  2,
  'second worker launches before the first removes its block',
);
assert.equal(
  g.runtime.flights.flights[1].pickup.pixel,
  (GRID_HEIGHT - 2) * GRID_WIDTH + Math.floor(GRID_WIDTH / 2),
);
assert.equal(g.runtime.session.model.remaining, PIXEL_COUNT);
for (let i = 0; i < 40; i++) {
  const poses = new Map(
    g.runtime.flights.flights
      .filter((t) => t.phase === 'outbound')
      .map((t) => [t, { x: t.visual.node.position.x, y: t.visual.node.position.y }]),
  );
  first.elapsed = 0;
  g.update(0.05);
  for (const [t, p] of poses)
    if (t.phase === 'outbound')
      assert.ok(
        clearSegment(
          { width: GRID_WIDTH, height: GRID_HEIGHT, pixels: g.runtime.session.model.pixels },
          worldToGrid(p),
          worldToGrid(t.visual.node.position),
          0.45,
        ),
        'follower must not pass through a real pixel',
      );
}
assert.equal(
  g.runtime.session.model.remaining,
  PIXEL_COUNT,
  'queued followers must not remove covered blocks',
);
assert.ok(g.runtime.flights.flights.length >= 5);
assert.ok(g.runtime.flights.flights.slice(1).every((t) => !t.lifted));
first.elapsed = 0;
for (let i = 0; i < 3000 && g.runtime.session.model.collected < GRID_HEIGHT; i++) g.update(0.05);
assert.ok(rescansAfterRemoval > 0, 'removing real obstacles must refresh waiting routes');
assert.equal(g.runtime.session.model.collected, GRID_HEIGHT);
assert.equal(g.runtime.flights.flights.length, 0);
assert.equal(g.runtime.session.model.slots[0], null);
assert.equal(g.runtime.session.model.remaining, PIXEL_COUNT - GRID_HEIGHT);
assert.ok(g.runtime.session.model.pixels.filter((c) => c === 0).length === 0);
g.onDestroy();
console.log(
  'Predictive chain dispatch, delayed prerequisite, collision clearance and all column deliveries passed.',
);
