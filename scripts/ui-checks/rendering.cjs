module.exports = function checkRendering({
  load,
  cc,
  Graphics,
  Sprite,
  Texture2D,
  resourceLoads,
  game,
  assert,
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  PALETTE,
  PIXEL_COUNT,
  GardenModel,
}) {
  assert.equal(GRID_WIDTH, 48);
  assert.equal(GRID_HEIGHT, 60);
  assert.equal(game.runtime.layout.boardRows.length, GRID_HEIGHT);
  assert.equal(game.runtime.preview.hintRows.length, GRID_HEIGHT);
  assert.equal(CELL_SIZE * GRID_WIDTH, 584);
  assert.equal(CELL_SIZE * GRID_HEIGHT, 730);
  game.runtime.session.startLevel(0);
  for (let column = 0; column < 5; column++) {
    const card = game.runtime.queue.cardViews.find((v) => v.column === column && v.row === 0);
    assert.equal(
      game.runtime.containers.slotViews[column].art.node.position.x,
      card.node.position.x,
      'collection slots and queue columns must align',
    );
  }
  assert.equal(
    game.runtime.layout.expansionBoard.position.x,
    game.runtime.queue.cardViews.find((v) => v.column === 4).node.position.x,
    'extra slot must align with fifth column',
  );
  assert.equal(game.runtime.layout.expansionBoard.parent, game.runtime.layout.queue.parent);
  assert.equal(
    game.runtime.layout.boardRows[0].node.parent,
    game.runtime.layout.effects.node.parent,
    'board and ants must share the playfield transform',
  );
  assert.equal(
    game.runtime.layout.playfield.scale.x,
    game.runtime.layout.playfield.scale.y,
    'pixels retain their aspect ratio',
  );
  const shelfBottom =
    game.runtime.layout.playfield.position.y - 594 * game.runtime.layout.playfield.scale.y;
  assert.ok(shelfBottom < -660, 'main game fills the removed button row');
  assert.ok(
    shelfBottom > -game.runtime.lifecycle.screenHeight / 2 + 32,
    'bottom safe margin is preserved',
  );
  assert.ok(
    game.runtime.layout.speedLabel.node.parent.position.x < 0,
    'speed avoids the WeChat capsule on the right',
  );
  const expansionTop = game.runtime.layout.expansionBoard.position.y + 29;
  const expansionBottom = game.runtime.layout.expansionBoard.position.y - 33;
  const aboveGap = -163 - expansionTop,
    belowGap = expansionBottom - -243;
  assert.ok(
    aboveGap >= 8 && belowGap >= 8,
    'unlock board clears the artwork shadow and visible wood rim',
  );
  assert.ok(
    Math.abs(aboveGap - belowGap) <= 3,
    'unlock board is visually centred between the artwork and wood rim',
  );
  const testArt = new Graphics();
  game.runtime.layout.boardPixel(
    testArt,
    -CELL_SIZE / 2,
    CELL_SIZE / 2,
    load(process.cwd() + '/assets/scripts/domain/levels/levels.ts').PALETTE[0],
  );
  const worker = game.runtime.ants.acquireAnt(0);
  const carried = worker.cargo.getComponent(Graphics);
  assert.deepEqual(
    JSON.parse(JSON.stringify(carried.commands)),
    JSON.parse(JSON.stringify(testArt.commands)),
    'carried block must use exactly the same size, color and shadow geometry',
  );
  game.runtime.ants.releaseAnt(worker);
  const initialCards = game.runtime.queue.cardViews.length,
    initialSlots = game.runtime.containers.slotViews.length;
  const second = game.runtime.session.model.columns[2][1].id;
  game.runtime.session.model.place(game.runtime.session.model.columns[2][0].id);
  game.runtime.containers.drawSlots();
  game.runtime.queue.drawQueue();
  assert.equal(game.runtime.queue.cardViews.length, initialCards);
  assert.equal(game.runtime.containers.slotViews.length, initialSlots);
  const promoted = game.runtime.queue.cardViews.find((v) => v.id === second);
  assert.equal(promoted.row, 0);
  assert.ok(promoted.node.position.y < promoted.targetY);
  for (let i = 0; i < 50; i++) game.update(1 / 60);
  assert.ok(Math.abs(promoted.node.position.y - promoted.targetY) < 0.1);
  game.runtime.session.startLevel(0);

  game.runtime.session.model = new GardenModel({
    name: 'stress',
    subtitle: '',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    pixels: Array(PIXEL_COUNT).fill(0),
    capacity: Math.ceil(PIXEL_COUNT / 5),
  });
  while (game.runtime.session.model.queue.length)
    game.runtime.session.model.place(game.runtime.session.model.queue[0].id);
  game.runtime.containers.drawSlots();
  game.runtime.layout.drawBoard();
  game.runtime.session.speed = 2;
  for (const slot of [0, 2, 4]) {
    const out = game.runtime.flights.antRoute(PIXEL_COUNT - 1, false, slot);
    assert.ok(
      Math.abs(out[0].x - game.runtime.containers.slotViews[slot].art.node.position.x) < 1e-6,
    );
    assert.ok(
      Math.abs(out[0].y - (game.runtime.containers.slotViews[slot].art.node.position.y + 42)) <
        1e-6,
    );
    const back = game.runtime.flights.antRoute(PIXEL_COUNT - 1, true, slot);
    assert.equal(back.at(-1).x, 0);
    assert.ok(Math.abs(back.at(-1).y + 203) < 1e-6);
  }
  let draws = 0;
  const original = game.runtime.layout.drawAnt.bind(game.runtime.layout);
  game.runtime.layout.drawAnt = (...args) => {
    draws++;
    return original(...args);
  };
  let rowDraws = 0;
  const boardDraw = game.runtime.layout.drawBoard.bind(game.runtime.layout);
  game.runtime.layout.drawBoard = (rows) => {
    assert.ok(rows, 'animation must never redraw the whole board');
    rowDraws += rows.size;
    return boardDraw(rows);
  };
  let peakWorkers = 0;
  const acquire = game.runtime.ants.acquireAnt.bind(game.runtime.ants);
  game.runtime.ants.acquireAnt = (c) => {
    const worker = acquire(c);
    peakWorkers = Math.max(
      peakWorkers,
      game.runtime.ants.antPool.filter((v) => v.node.active).length,
    );
    return worker;
  };
  for (let i = 0; i < 1800; i++) game.update(1 / 60);
  game.runtime.ants.acquireAnt = acquire;
  assert.ok(game.runtime.session.model.collected > 0);
  assert.equal(
    game.runtime.ants.antPool.length,
    peakWorkers,
    'pool should reuse idle workers rather than grow each trip',
  );
  assert.ok(
    draws <= 3 * game.runtime.ants.antPool.length,
    'same-colored workers must reuse cached geometry',
  );
  assert.ok(
    rowDraws <=
      2 * (game.runtime.session.model.level.pixels.length - game.runtime.session.model.remaining),
    'a pickup redraws only its own row and the newly exposed wall above',
  );
  for (const f of game.runtime.flights.flights) {
    assert.equal(f.visual.color, f.pickup.color);
    assert.equal(f.visual.cargo.active, f.lifted);
  }
  console.log(
    JSON.stringify({
      frames: 1800,
      poolSize: game.runtime.ants.antPool.length,
      antGeometryDraws: draws,
      dirtyRows: rowDraws,
      delivered: game.runtime.session.model.collected,
    }),
  );
  // Loading during active trips must preserve poses, cargo and animation phases.
  const poses = game.runtime.ants.antPool.map((v) => [
    v.node.active,
    v.node.position,
    v.node.angle,
    v.frame,
    v.cargo.active,
    v.cargo.angle,
  ]);
  const atlas = new Texture2D();
  resourceLoads.get('ants/workers/texture')(null, atlas);
  assert.equal(atlas.refs, 1);
  assert.deepEqual(
    game.runtime.ants.antPool.map((v) => [
      v.node.active,
      v.node.position,
      v.node.angle,
      v.frame,
      v.cargo.active,
      v.cargo.angle,
    ]),
    poses,
  );
  for (const v of game.runtime.ants.antPool) {
    assert.equal(v.frames.length, 0);
    assert.ok(v.body instanceof Sprite);
    assert.equal(v.body.spriteFrame.texture, atlas);
    assert.equal(v.cargoSprite.spriteFrame.texture, atlas);
    assert.equal(v.body.spriteFrame, game.runtime.assets.antFrames[v.frame]);
    assert.equal(v.cargoSprite.spriteFrame, game.runtime.assets.antFrames[3]);
    assert.equal(v.body.node.getComponent(cc.UITransform).width, 32);
    assert.equal(v.cargo.getComponent(cc.UITransform).width, 32);
    assert.equal(v.cargo.getComponent(Graphics), null);
    assert.equal(v.body.spriteFrame.originalSize.width, 64);
    assert.equal(v.body.spriteFrame.originalSize.height, 64);
  }
  const drawsBeforeAtlas = draws;
  for (let i = 0; i < 180; i++) game.update(1 / 60);
  assert.equal(draws, drawsBeforeAtlas, 'atlas workers must not tessellate vector geometry');
  for (const f of game.runtime.flights.flights)
    assert.equal(f.visual.body.spriteFrame, game.runtime.assets.antFrames[f.visual.frame]);
  console.log('Shared atlas replaces live workers without changing poses, cargo or walk frames.');
  game.runtime.layout.drawBoard = boardDraw;
  game.runtime.session.startLevel(0);
  assert.ok(game.runtime.ants.antPool.every((v) => !v.node.active));
  // Recolored pooled workers and newly allocated workers share exactly one texture.
  for (let c = 0; c < PALETTE.length; c++) {
    const v = game.runtime.ants.acquireAnt(c);
    assert.equal(v.body.spriteFrame, game.runtime.assets.antFrames[0]);
    assert.equal(v.cargoSprite.spriteFrame, game.runtime.assets.antFrames[3]);
    assert.equal(v.cargoSprite.spriteFrame.rect.x, 3 * 64);
    assert.equal(v.cargoSprite.spriteFrame.rect.y, 0);
    assert.equal(v.bodyDetail.spriteFrame, game.runtime.assets.antFrames[4]);
    assert.equal(v.cargoDetail.spriteFrame, game.runtime.assets.antFrames[7]);
    assert.equal(v.body.color.r, parseInt(PALETTE[c].slice(1, 3), 16));
    assert.equal(v.cargoSprite.color.g, parseInt(PALETTE[c].slice(3, 5), 16));
    game.runtime.ants.releaseAnt(v);
  }

  return { atlas };
};
