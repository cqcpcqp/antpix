module.exports = function checkInteraction({
  Graphics,
  game,
  assert,
  GRID_WIDTH,
  GRID_HEIGHT,
  PIXEL_COUNT,
  GardenModel,
}) {
  // Short taps place; holds preview without placing, and cancellation never commits.
  game.runtime.session.startLevel(0);
  let card = game.runtime.queue.cardViews.find((v) => v.row === 0),
    moves = game.runtime.session.model.moves;
  card.node.emit('start');
  game.update(0.3);
  assert.equal(game.runtime.preview.hold.shown, true);
  assert.match(game.runtime.layout.queueCount.string, /同色/);
  card.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves);
  assert.equal(game.runtime.preview.hold, null);
  assert.ok(game.runtime.preview.hintRows.every((g) => g.commands.length === 0));
  card.node.emit('start');
  card.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves + 1);
  card = game.runtime.queue.cardViews.find((v) => v.row === 0);
  card.node.emit('start');
  game.update(0.3);
  card.node.emit('cancel');
  card.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves + 1);
  card.node.emit('start');
  card.node.emit('move', {
    getUILocation: () => ({ x: 30, y: 0 }),
    getUIStartLocation: () => ({ x: 0, y: 0 }),
  });
  card.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves + 1);
  const secondRow = game.runtime.queue.cardViews.find((v) => v.row === 1);
  secondRow.node.emit('start');
  game.update(0.3);
  assert.equal(game.runtime.preview.hold.shown, true);
  secondRow.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves + 1);
  card.node.emit('start');
  game.update(0.3);
  game.runtime.lifecycle.hideHandler();
  assert.equal(game.runtime.preview.hold, null);
  game.runtime.lifecycle.showHandler();
  card.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves + 1);
  // A held slot previews and clears when its jar disappears.
  const slot = game.runtime.containers.slotViews.find((v) => v.id >= 0);
  slot.art.node.emit('start');
  game.update(0.3);
  assert.ok(game.runtime.preview.hold.shown);
  slot.art.node.emit('end');
  assert.equal(game.runtime.session.model.moves, moves + 1);
  // Reconstruct from the immutable artwork, persist immediately, and allow skipping.
  game.runtime.session.startLevel(0);
  const originalPixels = [...game.runtime.session.model.level.pixels];
  game.runtime.session.model.pixels.fill(-1);
  game.runtime.session.model.collected = game.runtime.session.model.level.pixels.length;
  game.runtime.session.model.remaining = 0;
  game.runtime.victory.victory();
  let celebration = game.runtime.victory.celebration;
  assert.ok(game.runtime.profile.save.completed.includes(0));
  assert.equal(celebration.actions.active, false);
  assert.equal(celebration.rows.length, GRID_HEIGHT);
  assert.equal(
    celebration.rows.reduce((sum, r) => sum + r.getComponent(Graphics).commands.length, 0),
    GRID_WIDTH * GRID_HEIGHT,
  );
  assert.deepEqual([...game.runtime.session.model.level.pixels], originalPixels);
  game.update(0.05);
  const beforePause = celebration.elapsed;
  game.runtime.lifecycle.hideHandler();
  game.update(0.05);
  assert.equal(celebration.elapsed, beforePause);
  game.runtime.lifecycle.showHandler();
  for (let i = 0; i < 70; i++) game.update(0.05);
  assert.equal(game.runtime.victory.celebration, null);
  assert.equal(celebration.actions.active, true);
  assert.equal(celebration.album.active, true);
  assert.equal(celebration.skip.active, false);
  assert.ok(celebration.rows.every((r) => r.active && r.scale.x === 1));
  assert.equal(celebration.art.scale.x, 0.72);
  game.runtime.session.startLevel(0);
  game.runtime.victory.victory();
  celebration = game.runtime.victory.celebration;
  celebration.skip.emit('end');
  assert.equal(game.runtime.victory.celebration, null);
  assert.equal(celebration.actions.active, true);
  assert.equal(game.runtime.profile.save.completed.filter((i) => i === 0).length, 1);
  game.runtime.session.startLevel(1);
  assert.equal(game.runtime.overlays.modal, null);
  assert.equal(game.runtime.victory.celebration, null);
  assert.equal(game.runtime.session.won, false);
  console.log(
    'Hold preview, cancellation, backgrounding, collection animation and skip checks passed.',
  );

  // Whole-picture highlight includes covered and reserved pixels and updates only dirty rows.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'highlight',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: PIXEL_COUNT,
  });
  game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  const previewNode = game.runtime.containers.slotViews[0].art.node;
  previewNode.emit('start');
  game.runtime.preview.updatePreview(0.3);
  assert.equal(
    game.runtime.preview.hintCounts.reduce((a, b) => a + b, 0),
    PIXEL_COUNT,
  );
  assert.ok(game.runtime.preview.hintRows[0].commands.length > 0);
  const pending = game.runtime.session.model.pick();
  game.runtime.preview.updatePreview(0.1);
  assert.equal(
    game.runtime.preview.hintCounts.reduce((a, b) => a + b, 0),
    PIXEL_COUNT,
  );
  let clears = Array(GRID_HEIGHT).fill(0);
  for (let i = 0; i < GRID_HEIGHT; i++) {
    const clear = game.runtime.preview.hintRows[i].clear.bind(game.runtime.preview.hintRows[i]);
    game.runtime.preview.hintRows[i].clear = () => {
      clears[i]++;
      clear();
    };
  }
  for (let i = 0; i < 60; i++) game.runtime.preview.updatePreview(1 / 60);
  assert.equal(
    clears.reduce((a, b) => a + b, 0),
    0,
    'idle hold must not redraw the picture',
  );
  game.runtime.session.model.lift(pending);
  game.runtime.preview.drawPreview(new Set([GRID_HEIGHT - 1]));
  assert.equal(
    game.runtime.preview.hintCounts.reduce((a, b) => a + b, 0),
    PIXEL_COUNT - 1,
  );
  assert.equal(clears[GRID_HEIGHT - 1], 1);
  assert.ok(clears.slice(0, GRID_HEIGHT - 1).every((n) => n === 0));
  previewNode.emit('end');
  assert.ok(game.runtime.preview.hintRows.every((g) => g.commands.length === 0));
  // UI loop must dispatch to a newly exposed column while another bottom worker travels.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'dispatch',
    subtitle: '',
    width: 8,
    height: 3,
    pixels: Array(24).fill(0),
    capacity: 24,
  });
  game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  const bottomJobs = Array.from({ length: 8 }, () => game.runtime.session.model.pick());
  game.runtime.session.model.lift(bottomJobs[0]);
  game.runtime.dispatch.dispatchClocks.fill(0.5);
  game.runtime.containers.drawSlots();
  game.update(0.016);
  assert.equal(game.runtime.flights.flights.length, 1);
  assert.ok(game.runtime.flights.flights[0].pickup.pixel < 16);
  console.log(
    'Whole-picture highlight caching and non-blocking bottom-first dispatch checks passed.',
  );
};
