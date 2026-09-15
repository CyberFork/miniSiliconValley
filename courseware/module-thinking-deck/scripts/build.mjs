import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const audience = join(dist, "audience");
const teacher = join(dist, "teacher");
await rm(dist, { recursive: true, force: true });
await mkdir(join(audience, "assets"), { recursive: true });
await mkdir(join(audience, "printables"), { recursive: true });
await mkdir(join(teacher, "assets"), { recursive: true });

const audienceFiles = ["index.html", "favicon.svg", "deck.css", "deck-data.js", "deck-runtime.js"];
const teacherFiles = ["presenter.html", "favicon.svg", "presenter.css", "presenter-runtime.js", "presenter-notes.js", "deck.css", "deck-data.js"];
for (const file of audienceFiles) await cp(join(root, file), join(audience, file));
for (const file of teacherFiles) await cp(join(root, file), join(teacher, file));
for (const target of [audience, teacher]) await cp(join(root, "assets/mini-silicon-valley-logo-transparent.png"), join(target, "assets/mini-silicon-valley-logo-transparent.png"));
await cp(join(root, "printables/module-map.html"), join(audience, "printables/module-map.html"));
await cp(join(root, "printables/interface-card.html"), join(audience, "printables/interface-card.html"));

const presenterPath = join(teacher, "presenter.html");
const presenter = (await readFile(presenterPath, "utf8")).replace('data-audience-url="./index.html"', 'data-audience-url="../audience/index.html"');
await writeFile(presenterPath, presenter);

async function hashFile(path) {
  const bytes = await readFile(path);
  return { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}
async function collect(base, names) {
  const result = [];
  for (const name of names) result.push({ path: relative(dist, join(base, name)), ...(await hashFile(join(base, name))) });
  return result;
}
const manifest = {
  schemaVersion: 1,
  todoId: "T-122",
  coursewareId: "module-thinking-p1",
  version: "2026.09.15-r2",
  sourceXmindSha256: "a31489645adcfaf6b7afd3be734349175740c520120cda65552cfa0f3e833793",
  audience: await collect(audience, [...audienceFiles, "assets/mini-silicon-valley-logo-transparent.png", "printables/module-map.html", "printables/interface-card.html"]),
  teacher: await collect(teacher, [...teacherFiles, "assets/mini-silicon-valley-logo-transparent.png"]),
  securityBoundary: "audience 目录可作为学员静态 bundle；teacher 目录必须由服务端导师权限保护，禁止复制进公开静态目录。",
};
await writeFile(join(dist, "BUILD-MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Built ${manifest.audience.length} audience files and ${manifest.teacher.length} teacher files.`);
