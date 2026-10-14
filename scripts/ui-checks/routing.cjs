module.exports = function checkRouting({
  load,
  game,
  assert,
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  LEVEL_COUNT,
  PIXEL_COUNT,
  GardenModel,
}) {
  // A target with an occupied bottom/left/right must be approached from its open top.
  game.runtime.session.startLevel(0);
  const topPixels = Array(PIXEL_COUNT).fill(0),
    topTarget = (GRID_HEIGHT - 3) * GRID_WIDTH + 20;
  topPixels[topTarget] = 1;
  game.runtime.session.model = new GardenModel({
    name: 'top approach',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: topPixels,
    capacity: PIXEL_COUNT,
  });
  for (const p of [
    (GRID_HEIGHT - 1) * GRID_WIDTH + 18,
    (GRID_HEIGHT - 2) * GRID_WIDTH + 18,
    (GRID_HEIGHT - 3) * GRID_WIDTH + 18,
    (GRID_HEIGHT - 4) * GRID_WIDTH + 18,
    (GRID_HEIGHT - 4) * GRID_WIDTH + 19,
    (GRID_HEIGHT - 4) * GRID_WIDTH + 20,
  ])
    game.runtime.session.model.pixels[p] = -1;
  const topJar = game.runtime.session.model.queue.find((j) => j.color === 1);
  game.runtime.session.model.place(topJar.id);
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  game.update(0.016);
  assert.equal(game.runtime.flights.flights.length, 1);
  const topTrip = game.runtime.flights.flights[0];
  assert.equal(topTrip.pickup.pixel, topTarget);
  assert.equal(topTrip.pickup.approach.x, 20);
  assert.equal(topTrip.pickup.approach.y, GRID_HEIGHT - 4);
  const topEnd = topTrip.path.at(-1);
  assert.ok(Math.abs(topEnd.y - (608 - (GRID_HEIGHT - 3.5) * CELL_SIZE)) < 1e-8);
  for (let i = 0; i < 500 && (topTrip.phase === 'launch' || topTrip.phase === 'outbound'); i++)
    game.update(0.05);
  assert.equal(topTrip.phase, 'grasp');
  assert.equal(topTrip.lifted, true);
  assert.ok(
    Math.abs(topTrip.visual.node.angle + 90) < 1e-8,
    'ant must face down to grip a block below it',
  );
  assert.ok(
    Math.abs(topTrip.path[0].x - topEnd.x) < 1e-8 && Math.abs(topTrip.path[0].y - topEnd.y) < 1e-8,
    'return must start at the actual contact point',
  );
  for (let i = 0; i < 500 && game.runtime.flights.flights.length; i++) game.update(0.05);
  assert.equal(game.runtime.flights.flights.length, 0);
  assert.equal(game.runtime.session.model.collected, 1);
  console.log('Top-side pickup, gripping orientation and continuous return route passed.');

  // Exercise the production RETURN route, including reversal and world/grid conversion.
  game.runtime.session.startLevel(0);
  const maze = Array(PIXEL_COUNT).fill(0);
  for (let y = GRID_HEIGHT - 7; y < GRID_HEIGHT; y++) maze[y * GRID_WIDTH + 18] = -1;
  for (let x = 18; x <= 23; x++) maze[(GRID_HEIGHT - 7) * GRID_WIDTH + x] = -1;
  maze[(GRID_HEIGHT - 6) * GRID_WIDTH + 23] = -1; // picked block; contact is above, lower wall still blocks direct return
  const routeModel = new GardenModel({
    name: 'return wall',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: 40,
  });
  routeModel.pixels = maze;
  game.runtime.session.model = routeModel;
  const returning = game.runtime.flights.antRoute((GRID_HEIGHT - 6) * GRID_WIDTH + 23, true, 0, {
    x: 23,
    y: GRID_HEIGHT - 7,
  });
  assert.ok(returning.length > 2, 'return must bend around the occupied wall');
  const routing = load(process.cwd() + '/assets/scripts/domain/routing/routing.ts');
  const toGrid = (p) => ({ x: (p.x + 292) / CELL_SIZE - 0.5, y: (608 - p.y) / CELL_SIZE - 0.5 });
  for (let i = 1; i < returning.length; i++)
    assert.ok(
      routing.clearSegment(
        { width: GRID_WIDTH, height: GRID_HEIGHT, pixels: maze },
        toGrid(returning[i - 1]),
        toGrid(returning[i]),
        0.45 - 1e-8,
      ),
      'every return segment needs clearance',
    );
  assert.equal(returning.at(-1).x, 0);
  assert.ok(Math.abs(returning.at(-1).y + 203) < 1e-8);
  console.log('Actual return route bends around remaining pixels with clearance.');

  // Level selection exposes unlocked levels and keeps locked levels unavailable.
  game.runtime.home.showHome();
  game.runtime.album.levelPicker();
  assert.equal(
    game.runtime.overlays.modal.children.filter((n) => n.name.includes('第 ')).length,
    10,
  );
  game.runtime.profile.save.unlocked = 0;
  game.runtime.album.levelPicker();
  assert.equal(
    game.runtime.overlays.modal.children.filter((n) => n.name.includes('第 1 关')).length,
    1,
  );
  assert.doesNotThrow(() =>
    game.runtime.overlays.modal.children.find((n) => n.name.includes('第 2 关')).emit('end'),
  );
  game.runtime.profile.save.unlocked = LEVEL_COUNT - 1;
  game.runtime.session.startLevel(LEVEL_COUNT - 1);
  game.runtime.victory.victory();
  assert.equal(game.runtime.profile.save.unlocked, LEVEL_COUNT - 1);
  assert.ok(game.runtime.profile.save.completed.includes(LEVEL_COUNT - 1));
  game.runtime.victory.finishCelebration();
  assert.ok(
    game.runtime.overlays.modal.children.some(
      (n) => n.name === 'Collection actions' && n.children.some((c) => c.name === '完成全部关卡'),
    ),
  );
  console.log('Sequential unlock and level selection passed.');

  // Real dispatch starts at each card, rather than choosing the board centre.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'nearby',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: Math.ceil(PIXEL_COUNT / 5),
  });
  while (game.runtime.session.model.slots.includes(null))
    game.runtime.session.model.place(
      game.runtime.session.model.visibleQueue.find((v) => v.row === 0).jar.id,
    );
  game.update(0.01);
  assert.equal(
    game.runtime.flights.flights.find((f) => f.pickup.slot === 0).pickup.pixel,
    (GRID_HEIGHT - 1) * GRID_WIDTH + Math.round((-228 + 292) / CELL_SIZE - 0.5),
  );
  assert.equal(
    game.runtime.flights.flights.find((f) => f.pickup.slot === 4).pickup.pixel,
    (GRID_HEIGHT - 1) * GRID_WIDTH + Math.round((228 + 292) / CELL_SIZE - 0.5),
  );
  assert.equal(new Set(game.runtime.flights.flights.map((f) => f.pickup.pixel)).size, 5);
  console.log('Five cards select distinct nearby targets from their own departure positions.');
};
