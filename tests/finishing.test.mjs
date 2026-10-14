import test from 'node:test';
import assert from 'node:assert/strict';
import headless from '../scripts/headless-game.cjs';
const {load} = headless;
const {GardenModel} = load(process.cwd() + '/assets/scripts/model.ts');
const {PixelGarden} = load(process.cwd() + '/assets/scripts/PixelGarden.ts');
const {GRID_WIDTH, GRID_HEIGHT} = load(process.cwd() + '/assets/scripts/levels.ts');
const pixelCount = GRID_WIDTH * GRID_HEIGHT;
const level = (pixels, capacity) => ({name:'finish', subtitle:'', width:1, height:pixels.length, pixels, capacity});
const create = () => {
    const game = new PixelGarden();
    game.onLoad();
    game.startLevel(0);
    game.model = new GardenModel({name:'finish', subtitle:'', width:GRID_WIDTH, height:GRID_HEIGHT,
        pixels:Array(pixelCount).fill(0), capacity:pixelCount / 2}, () => .5);
    return game;
};
const placeAll = game => {
    while (game.model.queue.length) game.model.place(game.model.queue[0].id);
    game.drawSlots();
    game.drawQueue();
};

test('only an empty container queue enables finishing, through reservations and final delivery', () => {
    const model = new GardenModel(level([0, 1, 0], 3), () => .5);
    assert.equal(model.finishing, false);
    model.place(model.queue[0].id);
    assert.equal(model.finishing, false);
    model.place(model.queue[0].id);
    assert.equal(model.finishing, true);
    const trips = [];
    for (let pixel = 2; pixel >= 0; pixel--) {
        const slot = model.slots.findIndex(jar => jar?.color === model.pixels[pixel]);
        trips.push(model.pick(slot, {pixel, approach:{x:0, y:pixel + 1}}));
    }
    assert.ok(model.slots.every(jar => jar === null));
    assert.equal(model.finishing, true);
    assert.equal(model.lift(trips[2]), false, 'finishing still respects covered targets');
    for (const trip of trips) assert.equal(model.lift(trip), true);
    for (const trip of trips.slice(0, -1)) model.arrive(trip);
    assert.equal(model.finishing, true);
    model.arrive(trips.at(-1));
    assert.equal(model.complete, true);
    assert.equal(model.finishing, false);
});

test('full slots with choices remaining never count as finishing, including a blocked board', () => {
    const model = new GardenModel(level([0, 1, 2, 3, 4, 5], 1), () => .5);
    for (const color of [0, 1, 2, 3, 4]) {
        model.place(model.queue.find(jar => jar.color === color).id);
    }
    assert.equal(model.blocked, true);
    assert.equal(model.finishing, false);
});

test('automatic 4x accelerates dispatch and flights, keeps real time, and needs no speed ad', () => {
    for (const manualSpeed of [1, 2]) {
        const game = create();
        game.speed = manualSpeed;
        game.speedUnlocked = manualSpeed === 2;
        placeAll(game);
        game.requestSpeed(); // A click before the next frame must not open an ad.
        assert.equal(game.modal, null);
        assert.equal(game.rewardAdDemo, null);
        game.update(.02);
        assert.equal(game.speedLabel.string, '4×');
        assert.equal(game.speedVideo.active, false);
        assert.match(game.queueCaption(), /收尾加速/);
        assert.equal(game.flights[0].elapsed, .08);
        assert.equal(game.slotViews[0].launchElapsed, .08);
        assert.equal(game.elapsed, .02);
        for (let i = 0; i < 7; i++) game.update(.02);
        assert.equal(game.model.inFlight, 4, 'both containers dispatch twice within 0.16 real seconds');
        assert.equal(game.speed, manualSpeed, 'manual preference remains separate');
        assert.equal(game.speedUnlocked, manualSpeed === 2);
        const elapsed = game.elapsed;
        const tripElapsed = game.flights.map(trip => trip.elapsed);
        game.hideHandler(); game.update(1);
        assert.equal(game.elapsed, elapsed);
        assert.deepEqual(game.flights.map(trip => trip.elapsed), tripElapsed);
        game.showHandler();
        game.settings(); game.update(1);
        assert.equal(game.elapsed, elapsed);
        game.closeModal();
        for (let i = 0; i < 10000 && !game.won; i++) game.update(.05);
        assert.equal(game.won, true);
        assert.equal(game.model.collected, pixelCount);
        assert.equal(game.model.inFlight, 0);
        game.startLevel(0);
        assert.equal(game.finishing, false);
        assert.equal(game.speedLabel.string, '1×');
        assert.equal(game.speedVideo.active, true);
        assert.equal(game.speedUnlocked, false);
        game.onDestroy();
    }
});

test('waiting for a slot while containers remain preserves the chosen speed', () => {
    const game = create();
    game.model.place(game.model.queue.find(jar => jar.color === 0).id);
    game.drawSlots(); game.drawQueue();
    game.update(.02);
    assert.equal(game.finishing, false);
    assert.equal(game.flights[0].elapsed, .02);
    game.onDestroy();
});

test('4x followers wait for real clearance when prerequisite workers are delayed', () => {
    const game = create();
    const pixels = Array(pixelCount).fill(1);
    const center = Math.floor(GRID_WIDTH / 2);
    for (let row = 0; row < GRID_HEIGHT; row++) pixels[row * GRID_WIDTH + center] = 0;
    game.model = new GardenModel({name:'finish corridor', subtitle:'', width:GRID_WIDTH,
        height:GRID_HEIGHT, pixels, capacity:pixelCount}, () => .5);
    placeAll(game);
    game.update(.02);
    const first = game.flights.find(trip => trip.pickup.color === 0);
    const {clearSegment} = load(process.cwd() + '/assets/scripts/routing.ts');
    const {worldToGrid} = load(process.cwd() + '/assets/scripts/boardLayout.ts');
    for (let frame = 0; frame < 60; frame++) {
        const poses = new Map(game.flights.filter(trip => trip.phase === 'outbound')
            .map(trip => [trip, {...trip.visual.node.position}]));
        for (const trip of game.flights)
            if (trip === first || trip.pickup.color === 1) trip.elapsed = 0;
        game.update(.05);
        for (const [trip, position] of poses)
            if (trip.phase === 'outbound')
                assert.ok(clearSegment({width:GRID_WIDTH, height:GRID_HEIGHT, pixels:game.model.pixels},
                    worldToGrid(position), worldToGrid(trip.visual.node.position), .45));
    }
    assert.equal(game.finishing, true);
    assert.equal(game.model.remaining, pixelCount);
    assert.ok(game.flights.filter(trip => trip.pickup.color === 0).length > 5);
    game.onDestroy();
});
