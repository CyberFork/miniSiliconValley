import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveInput } from '../drive-input.mjs';

test('Space thrust and left/right sources remain independent', () => {
  const input = createDriveInput();
  input.press('Space', 'thrust');
  input.press('keyboard-left', 'left');
  assert.deepEqual(input.read(), { forward: false, reverse: false, thrust: true, brake: false, steer: 1, holding: true });
  input.release('Space');
  assert.deepEqual(input.read(), { forward: false, reverse: false, thrust: false, brake: false, steer: 1, holding: true });
  input.release('keyboard-left');
  assert.deepEqual(input.read(), { forward: false, reverse: false, thrust: false, brake: false, steer: 0, holding: false });
});

test('two independent thrust sources require both releases, and clear resets all state', () => {
  const input = createDriveInput();
  input.press('Space', 'thrust');
  input.press('gamepad-a', 'thrust');
  input.press('gamepad-left', 'left');
  input.press('gamepad-right', 'right');
  assert.deepEqual(input.read(), { forward: false, reverse: false, thrust: true, brake: false, steer: 0, holding: true });
  input.release('Space');
  assert.equal(input.read().thrust, true);
  input.release('gamepad-a');
  assert.equal(input.read().thrust, false);
  input.clear();
  assert.deepEqual(input.read(), { forward: false, reverse: false, thrust: false, brake: false, steer: 0, holding: false });
});
