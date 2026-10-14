import test from 'node:test';
import assert from 'node:assert/strict';
import headless from '../scripts/headless-game.cjs';
const { load, cc } = headless;
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const { CloudGameError } = load(process.cwd() + '/assets/scripts/cloudGame.ts');
const ads = load(process.cwd() + '/assets/scripts/rewardAd.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const create = () => {
  const game = new PixelGarden();
  game.onLoad();
  game.startLevel(0);
  return game;
};
const click = (parent, name) => {
  const node = parent.children.find((node) => node.name === name);
  assert.ok(node, `missing action: ${name}`);
  node.emit('end');
};

test('blocked players can leave without restarting or watching an ad', () => {
  const game = create();
  game.showBlocked();
  click(game.modal, '返回主页');
  assert.ok(game.home);
  assert.equal(game.modal, null);
  assert.equal(game.rewardAdDemo, null);
});

test('home recommends the next level but preserves a resumable run', () => {
  const game = create();
  game.victory();
  game.finishCelebration();
  game.showHome();
  click(game.home, '开始游戏');
  assert.equal(game.save.selected, 1);
  const model = game.model;
  game.showHome();
  click(game.home, '继续游戏');
  assert.equal(game.model, model);
});

test('speed unlock is reusable within the level and restart requires confirmation', () => {
  const game = create();
  game.requestSpeed();
  game.updateOverlays(3.1);
  assert.equal(game.speed, 2);
  game.requestSpeed();
  assert.equal(game.speed, 1);
  game.requestSpeed();
  assert.equal(game.speed, 2);
  assert.equal(game.rewardAdDemo, null);
  const model = game.model;
  game.settings();
  click(game.drawerSheet, '重新开始');
  click(game.modal, '继续游戏');
  assert.equal(game.model, model);
  game.settings();
  click(game.drawerSheet, '重新开始');
  click(game.modal, '重新开始');
  assert.notEqual(game.model, model);
  assert.equal(game.speed, 1);
  assert.equal(game.speedUnlocked, false);
});

test('first-run instructions pause play, persist completion and remain accessible', () => {
  const storage = cc.sys.localStorage;
  const data = new Map();
  cc.sys.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  try {
    const game = create();
    assert.ok(game.modal);
    game.update(1);
    assert.equal(game.elapsed, 0);
    click(game.modal, '下一步');
    click(game.modal, '下一步');
    click(game.modal, '开始收集');
    assert.equal(game.modal, null);
    const reopened = create();
    assert.equal(reopened.modal, null);
    reopened.settings();
    click(reopened.drawerSheet, '操作说明');
    assert.ok(reopened.modal);
    game.cardViews.find((view) => view.row === 1).node.emit('start');
    game.cardViews.find((view) => view.row === 1).node.emit('end');
    assert.ok(game.notification);
    assert.equal(game.model.moves, 0);
  } finally {
    cc.sys.localStorage = storage;
  }
});

test('phone hit regions reach 44 pixels without overlapping queue rows or rank actions', async () => {
  const getFrame = cc.view.getFrameSize;
  try {
    for (const frame of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
    ]) {
      cc.view.getFrameSize = () => frame;
      const game = create(),
        scale = frame.width / game.screenWidth;
      const bounds = (node) => node.getComponent(cc.UITransform);
      assert.ok(bounds(game.speedLabel.node.parent).height * scale >= 44 - 1e-8);
      const rows = game.cardViews.filter((view) => view.column === 0).sort((a, b) => a.row - b.row);
      assert.ok(bounds(rows[0].node).height * scale * game.playfield.scale.y >= 44 - 1e-8);
      assert.ok(
        rows[0].targetY - rows[1].targetY >=
          (bounds(rows[0].node).height + bounds(rows[1].node).height) / 2,
      );
      game.cloudMode = true;
      game.cloudReady = true;
      game.cloud = { leaderboard: async () => ({ rows: [], hasNext: true }) };
      game.worldLeaderboard(0);
      await flush();
      const actions = game.modal.children.filter((node) =>
        ['返回', '微信好友榜', '下一页'].includes(node.name),
      );
      for (let i = 0; i < actions.length; i++)
        for (let j = i + 1; j < actions.length; j++)
          assert.ok(
            Math.abs(actions[i].position.y - actions[j].position.y) >=
              (bounds(actions[i]).height + bounds(actions[j]).height) / 2,
          );
    }
  } finally {
    cc.view.getFrameSize = getFrame;
  }
});

test('ad confirmation pauses a nearly complete run and settlement is submitted exactly once', async () => {
  const original = ads.showRewardedVideo;
  ads.showRewardedVideo = async () => true;
  try {
    const game = create();
    game.cloudMode = true;
    game.cloudReady = true;
    game.cloudRunId = 'run';
    const state = {
      profile: game.save,
      highest: -1,
      reachedAt: 0,
      serverTime: Date.now(),
      output: { adId: 'ad' },
    };
    let confirm;
    const actions = [];
    game.cloud = {
      mutate: async (action) => {
        actions.push(action);
        if (action === 'adComplete')
          await new Promise((resolve) => {
            confirm = resolve;
          });
        return state;
      },
    };
    game.watchCloudAd('speed', () => {
      game.speed = 2;
    });
    await flush();
    game.model.pixels.fill(-1);
    game.model.remaining = 0;
    game.model.collected = game.model.level.pixels.length;
    game.update(0.05);
    assert.equal(game.elapsed, 0);
    assert.equal(game.won, false);
    game.victory();
    assert.equal(game.won, false);
    confirm();
    await flush();
    game.update(0.05);
    await flush();
    assert.equal(game.won, true);
    assert.ok(game.celebration);
    game.update(0.05);
    assert.equal(actions.filter((action) => action === 'complete').length, 1);
  } finally {
    ads.showRewardedVideo = original;
  }
});

test('invalid sessions offer a new run instead of retrying an expired run', async () => {
  const game = create();
  game.cloudMode = true;
  game.cloudReady = true;
  game.cloudRunId = 'expired';
  const actions = [];
  game.cloud = {
    mutate: async (action, values) => {
      actions.push(action);
      if (action === 'complete') throw new CloudGameError('SESSION', '本次挑战已失效，请重新开始');
      return {
        profile: game.save,
        highest: -1,
        reachedAt: 0,
        serverTime: Date.now(),
        output: { runId: 'new' },
      };
    },
  };
  game.victory();
  await flush();
  assert.equal(game.cloudRetry, null);
  click(game.modal, '重新开始');
  await flush();
  assert.deepEqual(actions, ['complete', 'start']);
  assert.equal(game.cloudRunId, 'new');
  assert.equal(game.won, false);
  assert.equal(game.modal, null);
});
