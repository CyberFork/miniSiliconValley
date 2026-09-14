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

if (!registry.includes(`DEVELOPMENT_MODULE_THINKING_CONTENT_TREE = "${digest}"`)) {
  throw new Error(`T-122 registry digest is not the built bundle digest: ${digest}`);
}
if (!registry.includes('entryPath: "/courseware/development-mentor-module-thinking/audience/"')) {
  throw new Error("T-122 audience entry is missing from the Courseware Library registry");
}
if (!gateway.includes("auth_request /_minisv_mentor_courseware_auth")) {
  throw new Error("T-122 teacher route lacks the mentor-only server gate");
}
if (!packager.includes("validate_module_thinking_courseware")) {
  throw new Error("T-122 bundle is not part of release assembly validation");
}
console.log(`T-122 release integration passed: ${digest}, audience ${manifest.audience.length}, teacher ${manifest.teacher.length}.`);
