import test from 'node:test';
import assert from 'node:assert/strict';
import headless from '../scripts/headless-game.cjs';
const { load } = headless;
const { AntFlights } = load(process.cwd() + '/assets/scripts/features/gameplay/AntFlights.ts');
const { gridToWorld } = load(process.cwd() + '/assets/scripts/presentation/boardLayout.ts');
const { prepareRoute } = load(process.cwd() + '/assets/scripts/domain/routing/routing.ts');

test('a waiting flight resumes after removal despite world-space corner roundoff', () => {
  // This tangent was accepted by grid routing, but conversion through the
  // 48-column world cell size made the same corridor appear blocked forever.
  const pixels = Array(48 * 60).fill(-1);
  pixels[41 * 48 + 8] = 1;
  pixels[20 * 48 + 8] = 1;
  const session = { model: { remaining: 2 }, effectiveSpeed: 1 };
  const flights = new AntFlights({ session, ants: { updateAntVisual() {} }, layout: {} });
  flights.routeBoard = { width: 48, height: 60, pixels };
  const route = prepareRoute(
    [
      { x: 4.76027397260274, y: 71.5 },
      { x: 9, y: 42 },
      { x: 8, y: 3 },
    ].map(gridToWorld),
  );
  assert.equal(flights.routeHasBlockedSegment(route), true);
  const trip = {
    phase: 'outbound',
    elapsed: 1.8266880326527795,
    distance: route.distance,
    route,
    fromPose: {},
    toPose: {},
    fromGrid: {},
    toGrid: {},
    clearanceBlocked: true,
    clearanceRemaining: 2,
  };
  flights.flights.push(trip);
  const before = trip.elapsed;
  flights.updateFlights(0.05);
  assert.equal(trip.elapsed, before, 'real obstacles must still stop movement');
  pixels[20 * 48 + 8] = -1;
  session.model.remaining--;
  flights.updateFlights(0.05);
  assert.equal(trip.clearanceBlocked, false);
  assert.ok(trip.elapsed > before, 'removal must refresh the route before rechecking the frame');
});
