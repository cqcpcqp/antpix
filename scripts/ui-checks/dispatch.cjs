module.exports = function checkDispatch({
  game,
  assert,
  GRID_WIDTH,
  GRID_HEIGHT,
  PIXEL_COUNT,
  GardenModel,
}) {
  // Five independent dispatchers keep launching at intervals even above three in flight.
  // Keep more containers queued so this checks ordinary 1x dispatch, not finishing.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel(
    {
      name: 'parallel',
      subtitle: '',
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      pixels: Array(PIXEL_COUNT).fill(0),
      capacity: PIXEL_COUNT / 10,
    },
    () => 0.5,
  );
  for (let slot = 0; slot < 5; slot++)
    game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  const dispatched = [],
    pickParallel = game.runtime.session.model.pick.bind(game.runtime.session.model);
  game.runtime.session.model.pick = (...args) => {
    const pickup = pickParallel(...args);
    if (pickup) dispatched.push(pickup);
    return pickup;
  };
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  game.update(0.016);
  assert.equal(game.runtime.flights.flights.length, 5);
  assert.equal(new Set(game.runtime.flights.flights.map((f) => f.pickup.slot)).size, 5);
  for (let i = 0; i < 9; i++) game.update(0.05);
  assert.equal(game.runtime.flights.flights.length, 5, 'must not dispatch before 0.5 seconds');
  for (let i = 0; i < 13; i++) game.update(0.05);
  assert.equal(game.runtime.flights.flights.length, 15);
  for (let slot = 0; slot < 5; slot++)
    assert.equal(game.runtime.flights.flights.filter((f) => f.pickup.slot === slot).length, 3);
  game.update(0.05);
  assert.equal(game.runtime.flights.flights.length, 15);
  assert.equal(new Set(game.runtime.flights.flights.map((f) => f.pickup.pixel)).size, 15);
  for (let i = 0; i < 21; i++) game.update(0.05);
  assert.equal(
    dispatched.length,
    25,
    'all five containers should keep launching independently of earlier arrivals',
  );
  for (let slot = 0; slot < 5; slot++)
    assert.equal(dispatched.filter((p) => p.slot === slot).length, 5);
  assert.equal(new Set(dispatched.map((p) => p.pixel)).size, 25);
  console.log(
    'Five slots independently dispatch beyond three in flight; interval and pixel reservations preserved.',
  );

  // Container labels decrement in the departure frame, stay stable on delivery,
  // and release the slot on the final departure, before the ant returns.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'counter',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: 2,
  });
  game.runtime.session.model.place(game.runtime.session.model.columns[0][0].id);
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  assert.equal(game.runtime.containers.slotLabels[0].string, '2');
  game.update(0.016);
  assert.equal(game.runtime.containers.slotLabels[0].string, '1');
  assert.equal(game.runtime.session.model.collected, 0);
  const firstTrip = game.runtime.flights.flights[0];
  game.runtime.session.model.lift(firstTrip.pickup);
  firstTrip.lifted = true;
  firstTrip.phase = 'enter';
  firstTrip.elapsed = 0.35;
  game.update(0.016);
  assert.equal(
    game.runtime.containers.slotLabels[0].string,
    '1',
    'arrival must not decrement again',
  );
  game.runtime.containers.drawSlots();
  assert.equal(
    game.runtime.containers.slotLabels[0].string,
    '1',
    'redraw preserves undispatched count',
  );
  game.runtime.dispatch.dispatchClocks[0] = 0.5;
  game.update(0.016);
  assert.equal(game.runtime.containers.slotLabels[0].string, '');
  assert.equal(game.runtime.session.model.slots[0], null);
  assert.equal(
    game.runtime.containers.slotViews[0].container.active,
    false,
    'final departure immediately removes the box',
  );
  game.runtime.containers.drawSlots();
  assert.equal(
    game.runtime.containers.slotLabels[0].string,
    '',
    'redraw cannot restore an empty container',
  );
  // Reuse immediately while the previous jar's final trip is still in flight.
  game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  game.runtime.containers.drawSlots();
  const replacement = game.runtime.session.model.slots[0];
  game.runtime.dispatch.dispatchJarIds[0] = replacement.id;
  game.runtime.dispatch.dispatchClocks[0] = 0;
  const lastTrip = game.runtime.flights.flights[0];
  game.runtime.session.model.lift(lastTrip.pickup);
  lastTrip.lifted = true;
  lastTrip.phase = 'enter';
  lastTrip.elapsed = 0.35;
  game.update(0.016);
  assert.equal(game.runtime.containers.slotLabels[0].string, '2');
  assert.equal(game.runtime.session.model.slots[0], replacement);
  console.log('Dispatch counters update immediately; deliveries never double-decrement.');

  // Actual elapsed time must include slow foreground frames, but exclude pauses.
  game.runtime.session.startLevel(0);
  game.update(0.2);
  assert.equal(game.runtime.session.elapsed, 0.2);
  game.runtime.lifecycle.hideHandler();
  game.update(1);
  assert.equal(game.runtime.session.elapsed, 0.2);
  game.runtime.lifecycle.showHandler();
  game.runtime.settings.settings();
  game.update(1);
  assert.equal(game.runtime.session.elapsed, 0.2);
  game.runtime.overlays.closeModal();
  game.update(0.1);
  assert.ok(Math.abs(game.runtime.session.elapsed - 0.3) < 1e-9);
  console.log('Foreground timing and pause checks passed.');

  // Full animation lifecycle through many capacity-40 jar replacements, using the
  // shipped current catalog dimensions. Check displayed values every frame, not just at launch.
  game.runtime.session.startLevel(0);
  game.runtime.session.model = new GardenModel({
    name: 'full counter lifecycle',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: 40,
  });
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  game.runtime.layout.drawBoard();
  game.runtime.session.speed = 2;
  let fullFrames = 0;
  while (!game.runtime.session.won && fullFrames++ < 50000) {
    let placed = false;
    while (
      game.runtime.session.model.slots.includes(null) &&
      game.runtime.session.model.queue.length
    ) {
      game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
      placed = true;
    }
    if (placed) {
      game.runtime.containers.drawSlots();
      game.runtime.queue.drawQueue();
    }
    game.update(0.05);
    assert.equal(game.runtime.flights.flights.length, game.runtime.session.model.inFlight);
    for (let slot = 0; slot < 5; slot++) {
      const jar = game.runtime.session.model.slots[slot];
      assert.equal(
        game.runtime.containers.slotLabels[slot].string,
        jar ? String(game.runtime.session.model.undispatched(slot)) : '',
      );
      if (jar) {
        assert.ok(game.runtime.session.model.undispatched(slot) > 0);
        assert.ok(game.runtime.session.model.undispatched(slot) <= jar.capacity);
      }
    }
  }
  assert.equal(game.runtime.session.won, true);
  assert.equal(game.runtime.session.model.collected, PIXEL_COUNT);
  assert.equal(game.runtime.flights.flights.length, 0);
  assert.equal(game.runtime.session.model.queue.length, 0);
  console.log(
    JSON.stringify({
      fullAnimationFrames: fullFrames,
      delivered: game.runtime.session.model.collected,
      replacedContainers: game.runtime.session.model.moves,
      allFrameCounters: 'passed',
    }),
  );
};
