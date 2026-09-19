import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const deckRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(deckRoot, "../..");
const manifest = JSON.parse(await readFile(join(deckRoot, "dist/BUILD-MANIFEST.json"), "utf8"));
const lines = [...manifest.audience, ...manifest.teacher]
  .map((item) => `${item.path}\0${item.sha256}\n`)
  .join("");
const digest = createHash("sha256").update(lines).digest("hex");
const registry = await readFile(join(repoRoot, "app/lib/courseware-store.ts"), "utf8");
const gateway = await readFile(join(repoRoot, "deploy/minisv/gateway/default.conf"), "utf8");
const packager = await readFile(join(repoRoot, "deploy/minisv/package_release.py"), "utf8");

if (manifest.digest !== digest) throw new Error("Candidate digest does not match files");
if (manifest.releaseStatus !== "deployment-ready" || manifest.manualAcceptance !== "not-signed-by-user") throw new Error("Deployment must not claim human acceptance");
if (registry.includes(`DEVELOPMENT_MODULE_THINKING_R4_CONTENT_TREE = "${digest}"`)) throw new Error("Candidate silently overwrote published revision");
if (!registry.includes('DEVELOPMENT_MODULE_THINKING_R4_CONTENT_TREE = "5d0e6d1dd92c10c99ad4767d33d92ef1039733996f9ec909d5a0910572787644"')) throw new Error("Published baseline changed unexpectedly");
if (!registry.includes('entryPath: "/courseware/development-mentor-module-thinking/audience/"')) {
  throw new Error("T-128 audience entry is missing from the Courseware Library registry");
}
if (!gateway.includes("auth_request /_minisv_mentor_courseware_auth")) {
  throw new Error("T-128 teacher route lacks the mentor-only server gate");
}
if (!packager.includes("validate_module_thinking_courseware")) {
  throw new Error("T-128 bundle is not part of release assembly validation");
}
for (const [name,constant,route] of [["module-thinking-deck","DEVELOPMENT_MODULE_THINKING_R5_CONTENT_TREE","development-mentor-module-thinking/r5"],["ligun-deck","DEVELOPMENT_LIGUN_R1_CONTENT_TREE","development-mentor-ligun/r1"]]) {
  const build = JSON.parse(await readFile(join(repoRoot, "courseware", name, "dist/BUILD-MANIFEST.json"), "utf8"));
  const smoke = await readFile(join(repoRoot, "deploy/minisv/scripts/public-smoke.py"), "utf8");
  if (!smoke.includes(build.digest)) throw new Error("Public smoke pins an obsolete build: " + name);
  if (!registry.includes(`${constant} = "${build.digest}"`)) throw new Error("New revision digest missing: " + name);
  if (!registry.includes(`/courseware/${route}/audience/`)) throw new Error("New immutable route missing: " + name);
  if (!gateway.includes(`location ^~ /courseware/${route}/teacher/ {\n        auth_request /_minisv_mentor_courseware_auth;`)) throw new Error("Teacher route is not protected: " + name);
}
console.log(`T-132/T-133 immutable release integration passed (human acceptance unsigned): ${digest}, audience ${manifest.audience.length}, teacher ${manifest.teacher.length}.`);
