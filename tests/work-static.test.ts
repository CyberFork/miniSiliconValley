import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";

const WORK_DIST = new URL("../dist/work/msv/", import.meta.url);

const EXPECTED_CANONICAL = "https://work.cyberforker.com/msv/demo.html";
const MAP_FILES = ["map-1939.webp", "map-1968.webp", "map-1998.webp", "silicon-valley-base-map.webp"];

function pickManifestFileName(entries: string[]) {
  const directCandidates = ["manifest.json", "demo-manifest.json", "manifest.webmanifest"];
  for (const candidate of directCandidates) {
    if (entries.includes(candidate)) return candidate;
  }
  return entries.find((name) => /manifest(\.json|\.webmanifest)$/i.test(name));
}

async function ensureWorkDistExists() {
  try {
    await access(WORK_DIST);
  } catch {
    assert.fail("dist/work/msv 未生成：请先执行构建产出静态部署目录");
  }
}

test("static deployment output exists at dist/work/msv and contains required assets", async () => {
  await ensureWorkDistExists();

  const dirEntries = await readdir(WORK_DIST, { withFileTypes: true });
  const names = dirEntries.map((entry) => entry.name);

  assert.ok(names.includes("demo.html"), "缺少 dist/work/msv/demo.html");
  assert.ok(names.includes("_next"), "缺少 dist/work/msv/_next 目录");
  assert.ok(names.includes("assets"), "缺少 dist/work/msv/assets 目录");
  assert.ok(pickManifestFileName(names), "缺少 dist/work/msv manifest 文件");

  const faviconEntry = dirEntries.find((entry) => entry.isFile() && /^favicon(\.ico|\.svg|\.png)?$/i.test(entry.name));
  assert.ok(faviconEntry, "缺少 favicon 文件（建议 favicon.svg）");

  const html = await readFile(new URL("demo.html", WORK_DIST), "utf8");
  const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i);
  assert.ok(canonicalMatch, "HTML 中缺少 canonical 元标签");
  const canonicalHrefMatch = canonicalMatch[0].match(/href=["']([^"']+)["']/i);
  assert.ok(canonicalHrefMatch, "canonical 标签缺少 href");
  assert.equal(canonicalHrefMatch[1], EXPECTED_CANONICAL, "canonical 不是要求的 https://work.cyberforker.com/msv/demo.html");

  const hrefSrc = Array.from(html.matchAll(/\b(?:href|src)=(["'])([^"']+)\1/gi));
  assert.ok(hrefSrc.length > 0, "未找到可检查的 href/src 资源引用");

  for (const [, , value] of hrefSrc as Iterable<[string, string, string]>) {
    if (value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) continue;
    if (value.startsWith("/") || value.startsWith("https://")) {
      assert.ok(
        value.startsWith("/msv/") || value.startsWith("https://work.cyberforker.com/msv/"),
        `资源路径应挂在 /msv/ 下：${value}`,
      );
      continue;
    }

    if (/^[^/]+\//.test(value) || value.startsWith("./") || value.startsWith("../")) {
      assert.fail(`非绝对路径不应出现（仅允许 /msv/ 子路径引用）：${value}`);
    }
  }

  const assetDir = new URL("assets/", WORK_DIST);
  for (const name of MAP_FILES) {
    try {
      await access(new URL(name, assetDir));
    } catch {
      assert.fail(`缺少地图资源 ${name}`);
    }
  }
});

test("manifest metadata matches actual file size and sha256", async () => {
  await ensureWorkDistExists();

  const files = await readdir(WORK_DIST);
  const manifestFileName = pickManifestFileName(files);
  assert.ok(manifestFileName, "manifest 文件未找到");

  const manifestPath = new URL(manifestFileName, WORK_DIST);
  const raw = await readFile(manifestPath);

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(raw.toString("utf8"));
  } catch {
    assert.fail(`${manifestFileName} 不是有效 JSON，无法验证 size/sha256 一致性`);
    return;
  }

  const fileRecords = Array.isArray(manifest.files) ? manifest.files : [];
  if (fileRecords.length > 0) {
    for (const item of fileRecords) {
      assert.ok(item && typeof item === "object", `${manifestFileName} 的 files 项应为对象`);
      const record = item as Record<string, unknown>;
      const filePathRaw = typeof record.path === "string" ? record.path : undefined;
      assert.ok(filePathRaw, `${manifestFileName} 的 files 项缺少 path`);

      const filePath = new URL(filePathRaw.replace(/^\//, ""), WORK_DIST);
      const fileData = await readFile(filePath);
      const size = fileData.byteLength;
      const sha256 = createHash("sha256").update(fileData).digest("hex");

      const declaredSize =
        typeof record.bytes === "number"
          ? record.bytes
          : typeof record.fileSize === "number"
            ? record.fileSize
            : undefined;
      const declaredHash =
        typeof record.sha256 === "string"
          ? record.sha256
          : typeof record.hash === "string"
            ? record.hash
            : typeof record.integrity === "string"
              ? record.integrity.replace(/^sha256-/, "")
              : undefined;

      assert.ok(declaredSize !== undefined, `${manifestFileName} ${filePathRaw} 缺少 size/bytes 声明`);
      assert.ok(declaredHash !== undefined, `${manifestFileName} ${filePathRaw} 缺少 sha256/hash/integrity 声明`);
      assert.equal(declaredSize, size, `${manifestFileName} ${filePathRaw} 的 size/bytes 与实际字节数不一致`);
      assert.equal(declaredHash, sha256, `${manifestFileName} ${filePathRaw} 的 sha256 与实际文件哈希不一致`);
    }
    return;
  }

  const declaredSize =
    (typeof manifest.size === "number" ? manifest.size : undefined)
    ?? (typeof manifest.fileSize === "number" ? manifest.fileSize : undefined)
    ?? undefined;
  const declaredHash =
    (typeof manifest.sha256 === "string" ? manifest.sha256 : undefined)
    ?? (typeof manifest.hash === "string" ? manifest.hash : undefined)
    ?? (typeof manifest.integrity === "string" ? manifest.integrity.replace(/^sha256-/, "") : undefined)
    ?? undefined;

  assert.ok(declaredSize !== undefined, `${manifestFileName} 缺少 size 声明`);
  assert.ok(declaredHash !== undefined, `${manifestFileName} 缺少 sha256/hash 声明`);

  const manifestSize = raw.byteLength;
  const manifestSha256 = createHash("sha256").update(raw).digest("hex");
  assert.equal(declaredSize, manifestSize, `${manifestFileName} 的 size 字段与文件实际字节数不一致`);
  assert.equal(declaredHash, manifestSha256, `${manifestFileName} 的 sha256/hash 字段与文件哈希不一致`);
});
