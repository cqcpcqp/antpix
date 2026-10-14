module.exports = function checkExpansion({
  load,
  completeTestAd,
  game,
  assert,
  GRID_WIDTH,
  GRID_HEIGHT,
  PIXEL_COUNT,
  GardenModel,
  atlas,
}) {
  // Removing a lower block reveals its neighbor's vertical wall without a full
  // board rebuild. This dependency is also required when the atlas is loaded.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'exposed walls',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: Math.ceil(PIXEL_COUNT / 5),
  });
  game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  game.runtime.containers.drawSlots();
  game.runtime.layout.drawBoard();
  game.update(0.016);
  const wallTrip = game.runtime.flights.flights[0],
    wallRow = Math.floor(wallTrip.pickup.pixel / GRID_WIDTH);
  wallTrip.phase = 'outbound';
  wallTrip.elapsed = 100;
  game.update(0.016);
  assert.equal(wallTrip.lifted, true);
  assert.deepEqual(
    [...game.runtime.layout.dirtyRows].sort((a, b) => a - b),
    [wallRow - 1, wallRow],
  );
  console.log('Pixel removal redraws its row and the exposed wall above, including atlas workers.');
  // Spatial expansion is gated by completion, preserves the original five columns,
  // and launches from the unlocked board rather than the main tray.
  game.runtime.session.startLevel(0);
  const originalSlotPositions = game.runtime.containers.slotViews
    .slice(0, 5)
    .map((v) => ({ ...v.art.node.position }));
  assert.ok(
    !game.runtime.lifecycle.gameRoot.children.some(
      (n) => n.name === '打乱容器' || n.name === '扩展槽位' || n.name === '开启二倍速',
    ),
  );
  assert.equal(typeof game.requestShuffle, 'undefined');
  game.runtime.layout.expansionBoard.emit('end');
  assert.ok(game.runtime.overlays.modal);
  assert.equal(game.runtime.session.model.slots.length, 5);
  game.runtime.overlays.modal.children.find((n) => n.name === '取消').emit('end');
  for (let i = 0; i < 70; i++) game.update(0.05);
  assert.equal(game.runtime.session.model.slots.length, 5, 'cancelled ad never grants a slot');
  assert.equal(game.runtime.layout.expansionBoard.active, true);
  game.runtime.layout.expansionBoard.emit('end');
  completeTestAd();
  assert.equal(game.runtime.session.model.slots.length, 6);
  assert.equal(game.runtime.layout.expansionBoard.active, true);
  assert.equal(game.runtime.layout.expansionBoard.position.x, 114);
  assert.deepEqual(
    game.runtime.containers.slotViews.slice(0, 5).map((v) => ({ ...v.art.node.position })),
    originalSlotPositions,
  );
  const { EXTRA_SLOT_X, EXTRA_SLOT_Y } = load(
    process.cwd() + '/assets/scripts/presentation/boardLayout.ts',
  );
  const sixth = game.runtime.containers.slotViews[5];
  assert.equal(sixth.art.node.position.x, EXTRA_SLOT_X);
  assert.equal(sixth.art.node.position.y, EXTRA_SLOT_Y);
  // Use identical, exposed colors so availability does not depend on generated art.
  game.runtime.session.model = new GardenModel({
    name: 'six-slot launch',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: 100,
  });
  game.runtime.session.model.slots.push(null);
  for (let i = 0; i < 6; i++) {
    const jar = game.runtime.session.model.visibleQueue.find((v) => v.row === 0).jar;
    assert.equal(game.runtime.session.model.place(jar.id), i);
  }
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  game.update(0.016);
  const extraTrip = game.runtime.flights.flights.find((f) => f.pickup.slot === 5);
  assert.ok(extraTrip, 'the unlocked slot dispatches its own worker');
  assert.equal(extraTrip.launchOrigin.x, EXTRA_SLOT_X);
  assert.equal(extraTrip.launchOrigin.y, EXTRA_SLOT_Y + 25);
  assert.ok(sixth.launchElapsed >= 0);
  game.runtime.session.startLevel(0);
  const columns = [4, 3, 1, 0];
  for (let step = 0; step < 4; step++) {
    assert.equal(game.runtime.layout.expansionBoard.active, true);
    assert.equal(game.runtime.layout.expansionBoard.position.x, (columns[step] - 2) * 114);
    game.runtime.layout.expansionBoard.emit('end');
    assert.equal(
      game.runtime.session.model.slots.length,
      5 + step,
      'reward only arrives on completion',
    );
    if (step === 1) {
      game.runtime.overlays.modal.children.find((n) => n.name === '取消').emit('end');
      assert.equal(game.runtime.session.model.slots.length, 6);
      assert.equal(game.runtime.layout.expansionBoard.position.x, 114);
      game.runtime.layout.expansionBoard.emit('end');
    }
    completeTestAd();
    assert.equal(game.runtime.session.model.slots.length, 6 + step);
    assert.equal(
      game.runtime.containers.slotViews[5 + step].art.node.position.x,
      (columns[step] - 2) * 114,
    );
    assert.equal(game.runtime.containers.slotViews[5 + step].art.node.position.y, EXTRA_SLOT_Y);
    assert.deepEqual(
      game.runtime.containers.slotViews.slice(0, 5).map((v) => ({ ...v.art.node.position })),
      originalSlotPositions,
    );
  }
  assert.equal(game.runtime.layout.expansionBoard.active, false);
  game.runtime.boosts.requestSlotExpansion();
  assert.equal(game.runtime.session.model.slots.length, 9);
  assert.equal(game.runtime.overlays.modal, null);
  game.runtime.session.model = new GardenModel({
    name: 'nine-slot launch',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: 100,
  });
  for (let i = 0; i < 4; i++) game.runtime.session.model.slots.push(null);
  for (let i = 0; i < 9; i++)
    assert.equal(
      game.runtime.session.model.place(
        game.runtime.session.model.visibleQueue.find((v) => v.row === 0).jar.id,
      ),
      i,
    );
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  game.update(0.016);
  for (let i = 0; i < 4; i++) {
    const trip = game.runtime.flights.flights.find((f) => f.pickup.slot === 5 + i);
    assert.ok(trip, 'every expanded slot dispatches independently');
    assert.equal(trip.launchOrigin.x, (columns[i] - 2) * 114);
    assert.equal(trip.launchOrigin.y, EXTRA_SLOT_Y + 25);
  }
  game.runtime.session.startLevel(0);
  assert.equal(game.runtime.session.model.slots.length, 5);
  assert.ok(game.runtime.containers.slotViews.slice(5).every((v) => !v.art.node.active));
  assert.equal(game.runtime.layout.expansionBoard.position.x, 228);
  assert.equal(game.runtime.layout.expansionBoard.active, true);
  assert.equal(game.runtime.layout.speedLabel.string, '1×');
  game.runtime.layout.speedLabel.node.parent.emit('end');
  assert.ok(game.runtime.overlays.modal);
  game.runtime.overlays.modal.children.find((n) => n.name === '取消').emit('end');
  assert.equal(game.runtime.session.speed, 1);
  game.runtime.layout.speedLabel.node.parent.emit('end');
  completeTestAd();
  assert.equal(game.runtime.session.speed, 2);
  assert.equal(game.runtime.layout.speedLabel.string, '2×');
  game.runtime.session.startLevel(0);
  game.runtime.boosts.requestSlotExpansion();
  completeTestAd();
  game.runtime.session.startLevel(0);
  console.log(
    'Spatial ad unlock, cancellation, unchanged five columns, sixth-slot dispatch, restart and compact speed control passed.',
  );
  const ownedFrames = [...game.runtime.assets.antFrames];
  game.onDestroy();
  assert.equal(atlas.refs, 0);
  assert.ok(ownedFrames.every((f) => f.destroyed));
};
