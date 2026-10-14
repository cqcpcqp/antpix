// Run real dispatch, predictive reservations and flight updates with mocked rendering.
// Select the next witness only when currently reachable work has finished.
const assert = require('node:assert/strict');
const { load } = require('./headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { GardenModel } = load(process.cwd() + '/assets/scripts/domain/game/model.ts');
const { makeLevel } = load(process.cwd() + '/assets/scripts/domain/levels/levels.ts');
const levels = (process.env.CONTAINER_LEVELS || '1,20,100').split(',').map(Number);
const variants = (process.env.CONTAINER_VARIANTS || '0').split(',').map(Number);
for (const number of levels)
  for (const variant of variants) {
    const game = new PixelGarden();
    game.onLoad();
    game.runtime.session.startLevel(0);
    const level = makeLevel(number - 1);
    game.runtime.session.model = new GardenModel(
      { ...level, containerPlans: [level.containerPlans[variant]] },
      () => 0.5,
    );
    game.runtime.flights.routeBoard.width = level.width;
    game.runtime.flights.routeBoard.height = level.height;
    game.runtime.flights.routeBoard.pixels = game.runtime.session.model.pixels;
    game.runtime.containers.drawSlots();
    game.runtime.queue.drawQueue();
    game.runtime.layout.drawBoard();
    let frame = 0,
      nextId = 0;
    for (; frame < 100000 && !game.runtime.session.model.complete; frame++) {
      assert.ok(
        !game.runtime.session.model.blocked,
        `level ${number} variant ${variant}: blocked at ${nextId}`,
      );
      if (
        !game.runtime.session.model.inFlight &&
        !game.runtime.session.model.canCollect &&
        game.runtime.session.model.queue.length
      ) {
        assert.ok(game.runtime.session.model.columns.some((c) => c[0]?.id === nextId));
        assert.ok(game.runtime.session.model.place(nextId++) >= 0);
        game.runtime.containers.drawSlots();
        game.runtime.queue.drawQueue();
      }
      game.update(0.05);
    }
    assert.ok(game.runtime.session.model.complete, `level ${number} variant ${variant}: timed out`);
    assert.equal(game.runtime.session.model.collected, level.pixels.length);
    console.log(
      JSON.stringify({
        level: number,
        variant,
        frames: frame,
        moves: game.runtime.session.model.moves,
        complete: true,
      }),
    );
    game.onDestroy();
  }
