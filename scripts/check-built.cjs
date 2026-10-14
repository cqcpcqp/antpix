// This suite executes the actual generated JS and the actual generated Babel helpers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
// Check the real bundle address and native image, not just a mocked load callback.
const bundle = JSON.parse(fs.readFileSync('build/wechatgame/assets/resources/config.json', 'utf8'));
const bitmapPath = Object.values(bundle.paths).find((path) => path[0] === 'fonts/ant-nest-bitmap');
assert.ok(bitmapPath, 'platform-independent bitmap font must be bundled');
assert.equal(bundle.types[bitmapPath[1]], 'cc.BitmapFont');
const fontUuid = JSON.parse(
  fs.readFileSync('assets/resources/fonts/ant-nest-bitmap.png.meta', 'utf8'),
).uuid;
assert.deepEqual(
  fs.readFileSync(
    `build/wechatgame/assets/resources/native/${fontUuid.slice(0, 2)}/${fontUuid}.png`,
  ),
  fs.readFileSync('assets/resources/fonts/ant-nest-bitmap.png'),
  'built UI font must match the complete clean glyph atlas',
);
const atlasPath = Object.values(bundle.paths).find((path) => path[0] === 'ants/workers/texture');
assert.ok(atlasPath, 'shared ant texture must be present in the resource bundle');
assert.equal(bundle.types[atlasPath[1]], 'cc.Texture2D');
const atlasUuid = JSON.parse(
  fs.readFileSync('assets/resources/ants/workers.png.meta', 'utf8'),
).uuid;
const atlasImage = fs.readFileSync(
  `build/wechatgame/assets/resources/native/${atlasUuid.slice(0, 2)}/${atlasUuid}.png`,
);
assert.deepEqual(
  atlasImage,
  fs.readFileSync('assets/resources/ants/workers.png'),
  'built atlas must match the baked artwork',
);
const titlePath = Object.values(bundle.paths).find((path) => path[0] === 'home/title/texture');
assert.ok(titlePath, 'generated home title must be present in the resource bundle');
assert.equal(bundle.types[titlePath[1]], 'cc.Texture2D');
const titleUuid = JSON.parse(fs.readFileSync('assets/resources/home/title.png.meta', 'utf8')).uuid;
assert.deepEqual(
  fs.readFileSync(
    `build/wechatgame/assets/resources/native/${titleUuid.slice(0, 2)}/${titleUuid}.png`,
  ),
  fs.readFileSync('assets/resources/home/title.png'),
  'built title must match the generated transparent asset',
);
for (const name of ['play', 'album', 'shop', 'rank']) {
  const path = Object.values(bundle.paths).find((path) => path[0] === `home/${name}/texture`);
  assert.ok(path, `${name} home asset must be bundled`);
  assert.equal(bundle.types[path[1]], 'cc.Texture2D');
  const uuid = JSON.parse(fs.readFileSync(`assets/resources/home/${name}.png.meta`)).uuid;
  assert.deepEqual(
    fs.readFileSync(`build/wechatgame/assets/resources/native/${uuid.slice(0, 2)}/${uuid}.png`),
    fs.readFileSync(`assets/resources/home/${name}.png`),
  );
}
for (const [name, extension] of [
  ['garden', 'jpg'],
  ['furnishings', 'png'],
]) {
  const path = Object.values(bundle.paths).find((path) => path[0] === `home/${name}/texture`);
  assert.ok(path, `courtyard texture ${name} must be bundled`);
  const file = `assets/resources/home/${name}.${extension}`;
  const uuid = JSON.parse(fs.readFileSync(file + '.meta', 'utf8')).uuid;
  assert.deepEqual(
    fs.readFileSync(
      `build/wechatgame/assets/resources/native/${uuid.slice(0, 2)}/${uuid}.${extension}`,
    ),
    fs.readFileSync(file),
  );
}
const assertContact = require('./assert-contact.cjs');
const load = require('./load-built.cjs')({ cclegacy: { _RF: { push() {}, pop() {} } } });
const { GardenModel } = load('chunks:///_virtual/model.ts');
const { makeLevel, LEVEL_COUNT, GRID_WIDTH, GRID_HEIGHT } = load('chunks:///_virtual/levels.ts');
const profile = load('chunks:///_virtual/profile.ts');
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const regression = new GardenModel({
  name: 'negative',
  subtitle: '',
  width: 80,
  height: 1,
  pixels: Array(80).fill(0),
  capacity: 40,
});
regression.place(regression.queue[0].id);
for (let i = 0; i < 10; i++) {
  const p = regression.pick(0);
  regression.lift(p);
  regression.arrive(p);
}
for (let i = 0; i < 36; i++) regression.pick(0);
assert.equal(regression.undispatched(0), 0, 'old build showed -6 after overbooking');
assert.equal(regression.inFlight, 30, 'only the unfilled capacity may be reserved');
let checked = 0,
  finished = 0,
  blocked = 0;
function simulate(level, seed) {
  const random = seeded(seed),
    m = new GardenModel(level, random),
    jobs = [],
    picked = new Set();
  function verify() {
    checked++;
    assert.equal(m.inFlight, jobs.length);
    const carrying = jobs.filter((p) => m.pixels[p.pixel] < 0).length;
    assert.equal(m.carrying, carrying);
    assert.equal(m.remaining + carrying + m.collected, level.pixels.length);
    const jars = m.queue.concat(m.slots.filter(Boolean));
    assert.equal(new Set(jars.map((j) => j.id)).size, jars.length);
    const activeIds = new Set(jars.map((j) => j.id));
    const departedTasks = jobs.filter((p) => !activeIds.has(p.jarId)).length;
    assert.equal(jars.reduce((n, j) => n + j.remaining, 0) + departedTasks, m.remaining + carrying);
    m.slots.forEach((jar, slot) => {
      if (!jar) return;
      const reserved = jobs.filter((p) => p.jarId === jar.id).length;
      assert.ok(reserved <= jar.remaining && jar.remaining <= jar.capacity);
      assert.equal(m.undispatched(slot), jar.remaining - reserved);
      assert.ok(m.undispatched(slot) >= 0);
    });
  }
  for (let frame = 0; frame < 30000 && !m.complete && !m.blocked; frame++) {
    if (random() < 0.05) m.shuffle();
    if (m.slots.includes(null) && m.queue.length) {
      const top = m.visibleQueue.filter((v) => v.row === 0);
      m.place(top[Math.floor(random() * top.length)].jar.id);
    }
    for (let slot = 0; slot < 5; slot++) {
      const p = m.pick(slot);
      if (!p) continue;
      assert.ok(!picked.has(p.pixel));
      picked.add(p.pixel);
      assertContact(m.pixels, level.width, level.height, p);
      jobs.push(p);
      verify();
    }
    // Different outbound/return times deliberately produce out-of-order completion.
    for (let i = jobs.length - 1; i >= 0; i--) {
      const p = jobs[i];
      if (random() > 0.22) continue;
      if (m.pixels[p.pixel] >= 0) {
        assert.equal(m.lift(p), true);
        assert.equal(m.lift(p), false);
      } else {
        const before = m.collected;
        m.arrive(p);
        assert.equal(m.collected, before + 1);
        m.arrive(p);
        assert.equal(m.collected, before + 1);
        jobs.splice(i, 1);
      }
      verify();
    }
    verify();
  }
  assert.ok(m.complete || m.blocked, 'simulation must reach a terminal state');
  if (m.complete) {
    finished++;
    assert.equal(picked.size, level.pixels.length);
  } else blocked++;
}
for (let seed = 1; seed <= 30; seed++)
  simulate(
    {
      name: 'full completion',
      subtitle: '',
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      pixels: Array(GRID_WIDTH * GRID_HEIGHT).fill(0),
      capacity: 40,
    },
    seed,
  );
for (let level = 0; level < LEVEL_COUNT; level++)
  for (let seed = 1; seed <= 30; seed++) simulate(makeLevel(level), seed);
const p = profile.freshProfile();
profile.recordWin(p, { level: 0, seconds: 20, moves: 2 }, 10);
profile.claimRewards(p, '2026-09-28');
profile.buyOrEquip(p, 'moss');
let saved = p;
for (let i = 0; i < 3; i++) {
  saved = profile.readProfile(JSON.stringify(saved), 10);
  assert.equal(JSON.stringify(saved.completed), '[0]');
  assert.equal(JSON.stringify(saved.claimed), '[0]');
  assert.ok(saved.owned.includes('sand') && saved.owned.includes('moss'));
  assert.equal(saved.nest, 'moss');
  assert.equal(saved.coins, 30);
  assert.equal(profile.rewardAmount(saved, '2026-09-28'), 0);
  assert.equal(profile.claimRewards(saved, '2026-09-28'), 0);
}
console.log(
  JSON.stringify({
    builtGames: 30 + LEVEL_COUNT * 30,
    finished,
    blocked,
    invariantChecks: checked,
    negativeCountRegression: 'passed',
    saveRoundTrips: 3,
  }),
);

assert.equal(
  LEVEL_COUNT,
  JSON.parse(fs.readFileSync('cloudfunctions/game/catalog.json', 'utf8')).levelCount,
);
assert.equal(makeLevel(0).id, 'penguin-sailor');
const legacy = {
  catalogVersion: 2,
  unlocked: 99,
  selected: 75,
  sound: true,
  completed: [0, 75],
  claimed: [0],
  coins: 55,
  owned: ['sand'],
  nest: 'sand',
  best: [{ level: 75, seconds: 15, moves: 2 }],
};
const migrated = profile.readProfile(JSON.stringify(legacy), 1);
assert.equal(migrated.selected, 0);
assert.equal(migrated.unlocked, 0);
assert.equal(migrated.completed.length, 0);
assert.equal(migrated.claimed.length, 0);
assert.equal(migrated.best.length, 0);
assert.equal(migrated.coins, 55);
assert.equal(
  JSON.stringify(profile.readProfile(JSON.stringify(migrated), 1)),
  JSON.stringify(migrated),
);
console.log('Nick catalog and deleted artwork save migration passed.');

// Replay the planned dependencies using the actual emitted model and routing code.
const { nearestAntTarget, AntTargetSearch } = load('chunks:///_virtual/routing.ts');
const { worldToGrid, collectionSlotX, collectionSlotY } = load('chunks:///_virtual/boardLayout.ts');
let solvedPlans = 0;
for (let level = 0; level < LEVEL_COUNT; level++)
  for (let variant = 0; variant < 3; variant++) {
    const art = makeLevel(level),
      m = new GardenModel(art, () => (variant + 0.1) / 3);
    const search = new AntTargetSearch();
    for (let id = 0; id < art.containerPlans[variant].length; id++) {
      if (id % 9 === 0) m.shuffle();
      assert.ok(
        m.columns.some((column) => column[0]?.id === id),
        'witness must be selectable',
      );
      assert.ok(m.place(id) >= 0, 'witness must fit five slots');
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (let slot = 0; slot < m.slots.length; slot++) {
          const target = nearestAntTarget(
            { ...art, pixels: m.pixels },
            worldToGrid({
              x: collectionSlotX(slot, m.slots.length),
              y: collectionSlotY(slot) + 42,
            }),
            m.availableTargets(slot),
            0.45,
            search,
          );
          if (!target) continue;
          const pickup = m.pick(slot, target);
          assert.ok(pickup);
          assert.ok(m.lift(pickup));
          m.arrive(pickup);
          progressed = true;
        }
      }
      assert.ok(m.slots.filter(Boolean).length <= 1);
    }
    assert.equal(m.complete, true);
    assert.equal(m.collected, art.pixels.length);
    solvedPlans++;
  }
console.log(JSON.stringify({ verifiedContainerPlans: solvedPlans, allPixelsDelivered: true }));
