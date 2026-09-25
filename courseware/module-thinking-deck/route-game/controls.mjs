/** Keyboard actions understood by the route game. */
export const ROUTE_KEY_ACTIONS = Object.freeze({
  Space: 'thrust',
  ' ': 'thrust',
  Up: 'forward',
  ArrowUp: 'forward',
  Down: 'reverse',
  ArrowDown: 'reverse',
  Left: 'left',
  ArrowLeft: 'left',
  Right: 'right',
  ArrowRight: 'right'
});

const ACTIONS = new Set(['forward', 'thrust', 'reverse', 'left', 'right']);

/**
 * Creates independent, source-aware route input state. A source may hold more
 * than one action; releasing one action never releases another source/action.
 */
export function createRouteInput() {
  const held = new Map();

  function press(source, action) {
    if (!ACTIONS.has(action)) return;
    const key = source ?? 'default';
    let actions = held.get(key);
    if (!actions) held.set(key, actions = new Set());
    actions.add(action);
  }

  function release(source, action) {
    const key = source ?? 'default';
    if (action === undefined) {
      held.delete(key);
      return;
    }
    const actions = held.get(key);
    if (!actions) return;
    actions.delete(action);
    if (!actions.size) held.delete(key);
  }

  function clear() {
    held.clear();
  }

  function read() {
    let thrust = false;
    let forward = false;
    let reverse = false;
    let left = false;
    let right = false;
    for (const actions of held.values()) {
      thrust ||= actions.has('thrust');
      forward ||= actions.has('forward');
      reverse ||= actions.has('reverse');
      left ||= actions.has('left');
      right ||= actions.has('right');
    }
    return {
      thrust,
      forward: forward && !reverse,
      reverse: reverse && !forward,
      steer: left === right ? 0 : left ? 1 : -1,
      holding: held.size > 0
    };
  }

  return { press, release, clear, read };
}
