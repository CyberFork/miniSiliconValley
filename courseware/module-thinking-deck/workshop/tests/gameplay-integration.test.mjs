import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, recipe, saveDefinition, placeOnChassis } from '../model.mjs';
import { initPhysics, DriveWorld } from '../physics.mjs';
import { createGameState, stepGame, discardItem } from '../../route-game/state.mjs';

function car() {
  let p = emptyProject('gameplay-integration');
  for (const behavior of ['wheel', 'thruster', 'chassis'])
    p = saveDefinition(p, { id: behavior, name: behavior, responsibility: 'integration', behavior, blocks: recipe(behavior) });
  const wheel = (id, x, z) => placeOnChassis(p, { id, definitionId: 'wheel', position: [x, 0, z], normal: [0, 0, z > 0 ? 1 : -1] });
  for (const [id, x, z] of [['w1', -1, -.84], ['w2', -1, .84], ['w3', 1, -.84], ['w4', 1, .84]]) p = wheel(id, x, z);
  p = placeOnChassis(p, { id: 'body', definitionId: 'chassis', position: [2.1, 0, 0], normal: [1, 0, 0] });
  for (const [id, z] of [['w5', -.84], ['w6', .84]]) p = placeOnChassis(p, { id, definitionId: 'wheel', position: [2.5, 0, z], normal: [0, 0, z > 0 ? 1 : -1] });
  p = placeOnChassis(p, { id: 'e1', definitionId: 'thruster', position: [.7, .44, 0], normal: [0, 1, 0], rotation: 180 });
  return placeOnChassis(p, { id: 'e2', definitionId: 'thruster', position: [-.7, .44, 0], normal: [0, 1, 0], rotation: 180 });
}

test('workshop car drives route-game pickup, bag rejection/discard, and finish', async () => {
  await initPhysics();
  const world = new DriveWorld(car(), { differential: true, glassFinish: true, breakableWall: true });
  assert.ok(world.glass.length > 0);
  assert.ok(world.crash?.length > 0, 'breakable wall should expose dynamic orange bodies');
  let game = createGameState(), fullObserved = false, rejectedKey = false, dropped = false, won = false;
  for (let i = 0; i < 1800 && !won; i++) {
    const snapshot = world.advance(1 / 60, { forward: true });
    const next = stepGame(game, snapshot.chassis.p);
    if (next.message.includes('两格已满')) {
      fullObserved = true;
      rejectedKey ||= !next.bag.includes('key');
      if (!dropped) { game = discardItem(next, 'coin', snapshot.chassis.p); dropped = !game.bag.includes('coin'); continue; }
    }
    game = next;
    won = game.won;
  }
  assert.ok(fullObserved, 'must observe full-bag rejection');
  assert.ok(rejectedKey, 'key rejection must not consume key');
  assert.ok(dropped, 'coin must be dropped to make room');
  assert.ok(won, 'car must reach key finish');
  assert.deepEqual(game.bag.sort(), ['key', 'tool']);
  assert.ok(game.bag.length <= 2);
  world.dispose();
});

test('empty project settles without forward/thrust movement or game progress', async () => {
  await initPhysics();
  const world = new DriveWorld(emptyProject('empty'), { differential: true, glassFinish: true, breakableWall: true });
  for (let i = 0; i < 120; i++) world.advance(1 / 60);
  const x = world.snapshot().chassis.p.x;
  let game = createGameState();
  for (let i = 0; i < 120; i++) {
    const snapshot = world.advance(1 / 60, { forward: true, thrust: true });
    game = stepGame(game, snapshot.chassis.p);
  }
  assert.ok(Math.abs(world.snapshot().chassis.p.x - x) < .1);
  assert.deepEqual(game, createGameState());
  world.dispose();
});
