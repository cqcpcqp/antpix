// Run real dispatch, predictive reservations and flight updates with mocked rendering.
// Select the next witness only when currently reachable work has finished.
const assert = require('node:assert/strict');
const { load } = require('./headless-game.cjs');
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { GardenModel } = load(process.cwd() + '/assets/scripts/model.ts');
const { makeLevel } = load(process.cwd() + '/assets/scripts/levels.ts');
const levels = (process.env.CONTAINER_LEVELS || '1,20,100').split(',').map(Number);
const variants = (process.env.CONTAINER_VARIANTS || '0').split(',').map(Number);
for (const number of levels)
  for (const variant of variants) {
    const game = new PixelGarden();
    game.onLoad();
    game.startLevel(0);
    const level = makeLevel(number - 1);
    game.model = new GardenModel(
      { ...level, containerPlans: [level.containerPlans[variant]] },
      () => 0.5,
    );
    game.routeBoard.width = level.width;
    game.routeBoard.height = level.height;
    game.routeBoard.pixels = game.model.pixels;
    game.drawSlots();
    game.drawQueue();
    game.drawBoard();
    let frame = 0,
      nextId = 0;
    for (; frame < 100000 && !game.model.complete; frame++) {
      assert.ok(!game.model.blocked, `level ${number} variant ${variant}: blocked at ${nextId}`);
      if (!game.model.inFlight && !game.model.canCollect && game.model.queue.length) {
        assert.ok(game.model.columns.some((c) => c[0]?.id === nextId));
        assert.ok(game.model.place(nextId++) >= 0);
        game.drawSlots();
        game.drawQueue();
      }
      game.update(0.05);
    }
    assert.ok(game.model.complete, `level ${number} variant ${variant}: timed out`);
    assert.equal(game.model.collected, level.pixels.length);
    console.log(
      JSON.stringify({
        level: number,
        variant,
        frames: frame,
        moves: game.model.moves,
        complete: true,
      }),
    );
    game.onDestroy();
  }
