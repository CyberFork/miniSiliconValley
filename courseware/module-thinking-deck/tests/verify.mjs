import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataCode = await readFile(join(root, "deck-data.js"), "utf8");
const noteCode = await readFile(join(root, "presenter-notes.js"), "utf8");
const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(dataCode, sandbox); vm.runInContext(noteCode, sandbox);
const deck = sandbox.window.MSV_MODULE_DECK;
const notes = sandbox.window.MSV_MODULE_PRESENTER_NOTES;
const expectedSources = ["S01", "S02-A", "S02-B", ...Array.from({ length: 14 }, (_, index) => `S${String(index + 3).padStart(2,"0")}`)];
if (!deck || deck.slides.length !== 17) throw new Error(`Expected 17 slides, got ${deck?.slides?.length}`);
const ids = new Set();
for (let i = 0; i < deck.slides.length; i++) {
  const slide = deck.slides[i];
  if (ids.has(slide.id)) throw new Error(`Duplicate slide id ${slide.id}`); ids.add(slide.id);
  if (slide.source !== expectedSources[i]) throw new Error(`Bad source mapping ${slide.source}`);
  if (!slide.title || !slide.subtitle || !slide.content) throw new Error(`Incomplete slide ${slide.id}`);
  if (!notes[slide.id]) throw new Error(`Missing presenter notes ${slide.id}`);
  for (const field of ["minutes","goal","script","acceptable","misconception","reward","acceptance","materials"]) if (!notes[slide.id][field]) throw new Error(`Missing ${field} for ${slide.id}`);
}
if (Object.keys(notes).length !== deck.slides.length) throw new Error("Notes contain unmatched slide ids");
const totalMinutes = Object.values(notes).reduce((sum, note) => sum + Number.parseInt(note.minutes, 10), 0);
if (totalMinutes !== 60) throw new Error(`Expected 60 teaching minutes, got ${totalMinutes}`);

const transform = deck.slides.find((slide) => slide.id === "module-s02");
const build = deck.slides.find((slide) => slide.id === "module-s02-build");
if (!transform?.content.includes('data-transform-case="plane"') || !transform.content.includes('data-transform-role="wheel"') || !transform.content.includes('data-module-3d="transform"') || !transform.content.includes("复用失败示例")) {
  throw new Error("T-128 prebuilt-component interaction is incomplete");
}
if (!build?.content.includes('data-build-step="components"') || !build.content.includes('data-build-layer="parts"') || !build.content.includes('data-module-3d="automation"') || !build.content.includes("先创造，再组合")) {
  throw new Error("T-128 build-your-own-component interaction is incomplete");
}
if (!notes["module-s02"].misconception.includes("任意重装") || !notes["module-s02-build"].misconception.includes("自建不天然优于复用")) {
  throw new Error("T-128 accuracy boundaries are missing from presenter notes");
}
const threeRuntime = await readFile(join(root, "module-3d.js"), "utf8");
const threeLicense = await readFile(join(root, "vendor/THREE-LICENSE.txt"), "utf8");
const coursewareIcon = await readFile(join(root, "favicon.svg"), "utf8");
const audienceEntry = await readFile(join(root, "index.html"), "utf8");
const teacherEntry = await readFile(join(root, "presenter.html"), "utf8");
if (!threeRuntime.includes('from "./vendor/three.module.min.js"') || !threeRuntime.includes("prefers-reduced-motion") || !threeRuntime.includes("data-module-3d")) {
  throw new Error("T-128 Three.js runtime or reduced-motion fallback is incomplete");
}
if (!threeLicense.includes("MIT License")) throw new Error("Vendored Three.js license is missing");
if (createHash("sha256").update(coursewareIcon).digest("hex") !== "1f8f0a43980007cbc3000449803ce1503de17155f07ee69d2eea9e76a3d7f1f4") {
  throw new Error("T-128 courseware-specific M icon no longer matches the approved asset");
}
for (const entry of [audienceEntry, teacherEntry]) {
  if (!entry.includes('href="favicon.svg?v=20260918-r4"')) throw new Error("T-128 courseware icon cache-busting link is missing");
}

const audienceRoot = join(root, "dist/audience");
const forbidden = ["现场顺序", "可接受回答", "硅谷币提示", "常见误区", "教师视图数据", "presenter-notes.js"];
async function files(dir) {
  const output=[];
  for (const name of await readdir(dir)) {
    const p=join(dir,name);
    if ((await stat(p)).isDirectory()) output.push(...await files(p));
    else output.push(p);
  }
  return output;
}
for (const path of await files(audienceRoot)) {
  if (!/\.(html|js|css|json)$/.test(path)) continue;
  const text = await readFile(path,"utf8");
  for (const phrase of forbidden) if (text.includes(phrase)) throw new Error(`Audience bundle leaks teacher phrase ${phrase} in ${path}`);
}
const presenter = await readFile(join(root,"dist/teacher/presenter.html"),"utf8");
if (!presenter.includes('data-audience-url="../audience/index.html"')) throw new Error("Teacher bundle audience link is wrong");
for (const path of ["printables/module-map.html","printables/interface-card.html"]) if (!(await readFile(join(audienceRoot,path),"utf8")).includes("@page")) throw new Error(`Missing print style ${path}`);
for (const path of ["module-3d.js", "vendor/three.module.min.js", "vendor/three.core.min.js", "vendor/THREE-LICENSE.txt"]) if (!(await stat(join(audienceRoot,path))).isFile()) throw new Error(`Missing local 3D dependency ${path}`);
console.log("T-128 structural checks passed: 17 slides/16 source units, 60 minutes, complete notes, separated audience bundle, printable worksheets.");
