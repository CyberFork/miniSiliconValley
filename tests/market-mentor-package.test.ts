import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../public/courseware/market-mentor-user-system/", import.meta.url);
const manifestPath = new URL("SOURCE-MANIFEST.json", root);

type Manifest = {
  title: string;
  mentorRole: string;
  packageId: string;
  slug: string;
  slideCount: number;
  contentTreeSha256: string;
  transformed: boolean;
  files: Array<{ path: string; sha256: string; bytes: number }>;
};

test("M user-system courseware is bound to its exact immutable bytes", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  assert.deepEqual({
    title: manifest.title,
    mentorRole: manifest.mentorRole,
    packageId: manifest.packageId,
    slug: manifest.slug,
    slideCount: manifest.slideCount,
    transformed: manifest.transformed,
  }, {
    title: "市场导师｜产品的用户体系",
    mentorRole: "M",
    packageId: "cw-market-mentor-user-system",
    slug: "market-mentor-user-system",
    slideCount: 49,
    transformed: false,
  });
  const canonical = manifest.files.map((item) => {
    const bytes = readFileSync(new URL(item.path, root));
    assert.equal(bytes.byteLength, item.bytes, item.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.path);
    return `${item.path}\0${item.sha256}\n`;
  }).join("");
  assert.equal(createHash("sha256").update(canonical).digest("hex"), manifest.contentTreeSha256);
  const registryCanonical = `static-bundle:/courseware/market-mentor-user-system/:sha256:${manifest.contentTreeSha256}`;
  assert.equal(createHash("sha256").update(registryCanonical).digest("hex"), "c48010b29cf4e9319552cee7748b6a8126ddf2c00486390e967e5b40d10cdc20");
  const registry = readFileSync(new URL("../app/lib/courseware-store.ts", import.meta.url), "utf8");
  for (const marker of [manifest.packageId, manifest.slug, manifest.contentTreeSha256, "/courseware/market-mentor-user-system/"]) {
    assert.ok(registry.includes(marker), `runtime registry is missing ${marker}`);
  }
});

test("M user-system courseware contains 49 usable browser slides", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  assert.equal((html.match(/<section\b[^>]*class="[^"]*\bslide\b[^"]*"/g) ?? []).length, 49);
  assert.match(html, /<title>产品的用户体系 · MINI硅谷<\/title>/);
  assert.match(html, /ArrowRight/);
  assert.match(html, /ArrowLeft/);
  assert.match(html, /touchstart/);
  assert.match(html, /Home/);
  assert.match(html, /End/);
  assert.match(html, /'PingFang SC'/);
  assert.match(html, /'Microsoft YaHei'/);
  assert.doesNotMatch(html, /(?:src|href)=["'](?:\.\/|\.\.\/|\/)(?!\/)/);
});
