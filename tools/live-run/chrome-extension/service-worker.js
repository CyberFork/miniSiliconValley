/* global chrome */
importScripts("grid-math.js");

const BASE = "http://127.0.0.1:18765/seat.html";
const SEATS = ["mentor01", "mentor02", "mentor03", "mentor04", "learner01", "learner02", "learner03", "learner04"];
let launchPromise = null;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function primaryWorkArea() {
  const displays = await chrome.system.display.getInfo();
  const display = displays.find((item) => item.isPrimary) || displays[0];
  if (!display || !display.workArea) throw new Error("No display work area is available");
  // `workArea` is the only safe tiling boundary on macOS: unlike `bounds`, it
  // excludes the menu bar, a visible Dock (including a left-side Dock), and
  // Stage Manager's reserved strip.  The grid must fill this rectangle rather
  // than hide controls behind system UI.
  return {
    left: display.workArea.left,
    top: display.workArea.top,
    width: display.workArea.width,
    height: display.workArea.height,
  };
}

async function correctBounds(records) {
  for (const record of records) {
    await chrome.windows.update(record.id, { state: "normal", ...record.bounds });
  }
}

async function launchGridOnce() {
  const workArea = await primaryWorkArea();
  const tiles = self.MsvGridMath.tileWorkArea(workArea, 4, 2);
  if (!self.MsvGridMath.validateTiles(workArea, tiles, 4, 2)) throw new Error("Computed grid is not an exact, non-overlapping cover");

  const records = [];
  for (let index = 0; index < SEATS.length; index += 1) {
    const tile = tiles[index];
    const created = await chrome.windows.create({
      url: `${BASE}?seat=${SEATS[index]}&window=W${String(index).padStart(2, "0")}`,
      type: "popup",
      focused: index === 0,
      state: "normal",
      left: tile.left,
      top: tile.top,
      width: tile.width,
      height: tile.height,
    });
    records.push({ id: created.id, seat: SEATS[index], bounds: tile });
  }

  // macOS/Chrome can clamp the first requested bounds while several windows
  // are being created.  Updating stable window IDs after creation prevents all
  // windows from drifting to the last slot (the prior overlap bug).
  await sleep(250);
  await correctBounds(records);
  await sleep(500);
  await correctBounds(records);

  const keep = new Set(records.map((record) => record.id));
  // Query again instead of relying only on the startup snapshot: on macOS the
  // CLI's about:blank window can appear after onInstalled started running.
  const after = await chrome.windows.getAll({ populate: true });
  for (const window of after) {
    if (typeof window.id === "number" && !keep.has(window.id)) {
      try { await chrome.windows.remove(window.id); } catch { /* already closed */ }
    }
  }
  await chrome.storage.local.set({
    lastLayout: { at: new Date().toISOString(), workArea, windows: records },
  });
  await chrome.windows.update(records[0].id, { focused: true });
}

function launchGrid() {
  if (!launchPromise) launchPromise = launchGridOnce().finally(() => { launchPromise = null; });
  return launchPromise;
}

chrome.runtime.onInstalled.addListener(() => { launchGrid().catch(console.error); });
chrome.runtime.onStartup.addListener(() => { launchGrid().catch(console.error); });
chrome.action.onClicked.addListener(() => { launchGrid().catch(console.error); });
