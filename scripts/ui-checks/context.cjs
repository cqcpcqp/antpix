// Headless component checks; rendering is mocked, so these do not measure FPS.
const {
  load,
  cc,
  Node,
  Graphics,
  Label,
  AudioSource,
  Sprite,
  Texture2D,
  resourceLoads,
} = require('../headless-game.cjs');
function completeTestAd() {
  game.runtime.boosts.rewardAdDemo.complete();
  game.runtime.boosts.rewardAdDemo = null;
  game.runtime.overlays.closeModal();
}
const { PixelGarden } = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const game = new PixelGarden();
game.onLoad();
const assert = require('node:assert/strict');
const { CELL_SIZE } = load(process.cwd() + '/assets/scripts/presentation/boardLayout.ts');
const { GRID_WIDTH, GRID_HEIGHT, PALETTE, LEVEL_COUNT } = load(
  process.cwd() + '/assets/scripts/domain/levels/levels.ts',
);
const PIXEL_COUNT = GRID_WIDTH * GRID_HEIGHT;

const { GardenModel } = load(process.cwd() + '/assets/scripts/domain/game/model.ts');
module.exports = {
  load,
  cc,
  Node,
  Graphics,
  Label,
  AudioSource,
  Sprite,
  Texture2D,
  resourceLoads,
  completeTestAd,
  PixelGarden,
  game,
  assert,
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  PALETTE,
  LEVEL_COUNT,
  PIXEL_COUNT,
  GardenModel,
};
