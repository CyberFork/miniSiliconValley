import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataCode = await readFile(join(root, "deck-data.js"), "utf8");
const noteCode = await readFile(join(root, "presenter-notes.js"), "utf8");
const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(dataCode, sandbox); vm.runInContext(noteCode, sandbox);
const deck = sandbox.window.MSV_MODULE_DECK;
const notes = sandbox.window.MSV_MODULE_PRESENTER_NOTES;
if (!deck || deck.slides.length !== 16) throw new Error(`Expected 16 slides, got ${deck?.slides?.length}`);
const ids = new Set();
for (let i = 0; i < deck.slides.length; i++) {
  const slide = deck.slides[i];
  if (ids.has(slide.id)) throw new Error(`Duplicate slide id ${slide.id}`); ids.add(slide.id);
  if (slide.source !== `S${String(i + 1).padStart(2,"0")}`) throw new Error(`Bad source mapping ${slide.source}`);
  if (!slide.title || !slide.subtitle || !slide.content) throw new Error(`Incomplete slide ${slide.id}`);
  if (!notes[slide.id]) throw new Error(`Missing presenter notes ${slide.id}`);
  for (const field of ["minutes","goal","script","acceptable","misconception","reward","acceptance","materials"]) if (!notes[slide.id][field]) throw new Error(`Missing ${field} for ${slide.id}`);
}
if (Object.keys(notes).length !== deck.slides.length) throw new Error("Notes contain unmatched slide ids");

const audienceRoot = join(root, "dist/audience");
const forbidden = ["现场顺序", "可接受回答", "硅谷币提示", "常见误区", "教师视图数据", "presenter-notes.js"];
async function files(dir) {
  const output=[]; for (const name of await readdir(dir)) { const p=join(dir,name); (await stat(p)).isDirectory() ? output.push(...await files(p)) : output.push(p); } return output;
}
for (const path of await files(audienceRoot)) {
  if (!/\.(html|js|css|json)$/.test(path)) continue;
  const text = await readFile(path,"utf8");
  for (const phrase of forbidden) if (text.includes(phrase)) throw new Error(`Audience bundle leaks teacher phrase ${phrase} in ${path}`);
}
const presenter = await readFile(join(root,"dist/teacher/presenter.html"),"utf8");
if (!presenter.includes('data-audience-url="../audience/index.html"')) throw new Error("Teacher bundle audience link is wrong");
for (const path of ["printables/module-map.html","printables/interface-card.html"]) if (!(await readFile(join(audienceRoot,path),"utf8")).includes("@page")) throw new Error(`Missing print style ${path}`);
console.log("T-122 structural checks passed: 16 slides, complete notes, separated audience bundle, printable worksheets.");
