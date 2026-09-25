import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, createGameState, stepGame, discardItem, itemPosition } from '../state.mjs';

const pos = (item) => ({ ...item.position });
const drop = { x: 1, y: 1, z: 4 };

test('itemPosition uses dynamic drop coordinates and defaults for legacy state', () => {
  const state = createGameState();
  assert.deepEqual(itemPosition(state, 'coin'), ITEMS[0].position);
  const moved = discardItem(stepGame(state, pos(ITEMS[0])), 'coin', drop);
  assert.deepEqual(itemPosition(moved, 'coin'), drop);
  assert.deepEqual(itemPosition({ bag: [] }, 'coin'), ITEMS[0].position);
});

test('dropping away from spawn does not immediately recollect, then recollects at new point', () => {
  let state = stepGame(createGameState(), pos(ITEMS[0]));
  state = discardItem(state, 'coin', drop);
  assert.deepEqual(state.bag, []);
  state = stepGame(state, pos(ITEMS[0]));
  assert.deepEqual(state.bag, []);
  state = stepGame(state, { x: drop.x + 3, y: 1, z: drop.z });
  state = stepGame(state, drop);
  assert.deepEqual(state.bag, ['coin']);
});

test('spawn point no longer picks dropped item; multiple drops remain independent', () => {
  let state = createGameState();
  state = stepGame(state, pos(ITEMS[0]));
  state = stepGame(state, pos(ITEMS[1]));
  const coinDrop = { x: 0, y: 1, z: 5 };
  const toolDrop = { x: 6, y: 1, z: 5 };
  state = discardItem(state, 'coin', coinDrop);
  state = discardItem(state, 'tool', toolDrop);
  state = stepGame(state, pos(ITEMS[0]));
  assert.deepEqual(state.bag, []);
  state = stepGame(state, { x: 10, y: 1, z: 5 });
  state = stepGame(state, coinDrop);
  assert.deepEqual(state.bag, ['coin']);
  state = stepGame(state, { x: 10, y: 1, z: 5 });
  state = stepGame(state, toolDrop);
  assert.deepEqual(state.bag, ['coin', 'tool']);
});

test('inputs and ITEMS remain immutable; invalid drop positions preserve state', () => {
  const input = { ...ITEMS[0].position };
  const beforeItems = structuredClone(ITEMS);
  let state = stepGame(createGameState(), input);
  const before = structuredClone(state);
  for (const bad of [undefined, {}, { x: NaN, y: 1, z: 0 }, { x: 1, y: 1 }]) {
    assert.deepEqual(discardItem(state, 'coin', bad), state);
  }
  assert.deepEqual(input, ITEMS[0].position);
  assert.deepEqual(ITEMS, beforeItems);
  assert.deepEqual(state, before);
});

test('JSON save/restore and old state without droppedPositions remain playable', () => {
  let state = discardItem(stepGame(createGameState(), pos(ITEMS[0])), 'coin', drop);
  state = JSON.parse(JSON.stringify(state));
  assert.deepEqual(itemPosition(state, 'coin'), drop);
  state = stepGame(state, { x: 9, y: 1, z: 4 });
  state = stepGame(state, drop);
  assert.deepEqual(state.bag, ['coin']);
  const old = JSON.parse(JSON.stringify(createGameState()));
  delete old.droppedPositions;
  assert.doesNotThrow(() => stepGame(old, pos(ITEMS[0])));
  assert.deepEqual(stepGame(old, pos(ITEMS[0])).bag, ['coin']);
});

test('missing or NaN positions do not delete items; absent item and won state stay unchanged', () => {
  let state = stepGame(createGameState(), pos(ITEMS[0]));
  assert.deepEqual(discardItem(state, 'coin', { x: NaN, y: 1, z: 0 }).bag, ['coin']);
  assert.deepEqual(discardItem(state, 'missing', drop), state);
  const won = { ...state, won: true };
  assert.deepEqual(discardItem(won, 'coin', drop), won);
});
