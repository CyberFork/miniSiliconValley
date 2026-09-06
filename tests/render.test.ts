import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function renderPath(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function getWebPDimensions(buffer: Buffer) {
  if (buffer.readUInt32BE(0) !== 0x52494646 || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("not webp");
  }

  let offset = 12;
  while (offset < buffer.length) {
    const chunkName = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const chunkData = offset + 8;

    if (chunkName === "VP8X") {
      return {
        width: buffer.readUIntLE(chunkData + 4, 3) + 1,
        height: buffer.readUIntLE(chunkData + 7, 3) + 1,
      };
    }

    const trimmedChunkName = chunkName.trimEnd();

    if (trimmedChunkName === "VP8") {
      const bits = buffer.readUInt16LE(chunkData + 6);
      const width = bits & 0x3fff;
      const height = (buffer.readUInt16LE(chunkData + 8) & 0x3fff);
      return { width, height };
    }

    if (chunkName === "VP8L") {
      const header = buffer.readUInt32LE(chunkData + 1);
      const width = (header & 0x3fff) + 1;
      const height = ((header >>> 14) & 0x3fff) + 1;
      return { width, height };
    }

    offset += 8 + size + (size & 1);
  }

  throw new Error("no dimensions");
}

function collectFilesForContentScan() {
  const candidates = [
    "../app/page.tsx",
    "../app/layout.tsx",
    "../app/lib/validate.ts",
    "../app/lib/state.ts",
    "../app/lib/model.ts",
    "../app/data/history.ts",
    "../app/data/missions.ts",
    "../app/data/curriculum.ts",
    "../app/components/WorldApp.tsx",
    "../app/components/CurriculumOutline.tsx",
    "../app/components/MissionPlayer.tsx",
    "../app/components/MentorGuide.tsx",
    "../app/components/Modal.tsx",
    "../app/course/CourseOutlineApp.tsx",
    "../app/lib/course-outline.ts",
  ];

  return candidates.map((relative) => new URL(relative, import.meta.url));
}


test("server-rendered built HTML includes Mini Silicon Valley metadata and shell, excludes starter skeleton", async () => {
  const response = await renderPath();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/i);
  assert.match(html, /<title>Mini Silicon Valley \| 真实科技史创业 RPG/i);
  assert.match(html, /Mini Silicon Valley/i);
  assert.match(html, /世界线/i);
  assert.match(html, /LIVE WORLD MAP/i);

  assert.equal(/Your site is taking shape/i.test(html), false);
  assert.equal(/react-loading-skeleton/i.test(html), false);
  assert.equal(/codex-preview/i.test(html), false);
});

test("server-rendered course route exposes one stable five-step Course Package projection", async () => {
  const response = await renderPath("/course/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<link rel="canonical" href="https:\/\/minisv\.vip\/course\/"/);
  assert.match(html, /aria-current="page">课程大纲<\/a>/);
  assert.equal((html.match(/data-step-id=/g) ?? []).length, 5);
  assert.match(html, /data-course-steps="5"/);
  assert.match(html, /data-course-blocks="13"/);
  assert.match(html, /data-course-decks="5"/);
  assert.match(html, /course-outline-world-map\.webp/);
  assert.match(html, /找真问题/);
  assert.match(html, /跑真运营/);
  assert.match(html, /六分钟 Demo Day/);
});

test("course outline ships only optimized, correctly sized chj visual assets", async () => {
  const map = await readFile(new URL("../public/assets/course-outline-world-map.webp", import.meta.url));
  const icons = await readFile(new URL("../public/assets/course-outline-chapter-icons.webp", import.meta.url));

  assert.deepEqual(getWebPDimensions(map), { width: 1671, height: 941 });
  assert.deepEqual(getWebPDimensions(icons), { width: 633, height: 621 });
  assert.ok(map.byteLength < 512_000, `课程地图未完成 Web 优化：${map.byteLength} bytes`);
  assert.ok(icons.byteLength < 256_000, `章节图标未完成 Web 优化：${icons.byteLength} bytes`);
});

test("all map webp assets exist and share dimensions", async () => {
  const assetDir = new URL("../public/assets/", import.meta.url);
  const [assets, dirErr] = await Promise.all([
    readdir(assetDir, { withFileTypes: true }),
    access(assetDir).then(() => true, () => false),
  ]);

  assert.equal(dirErr, true, "assets 目录应存在");

  const names = ["map-1939.webp", "map-1968.webp", "map-1998.webp", "silicon-valley-base-map.webp"];
  const dimensions = [] as { file: string; width: number; height: number }[];
  for (const name of names) {
    const exists = assets.some((entry) => entry.isFile() && entry.name === name);
    assert.equal(exists, true, `${name} 应该存在`);

    const buffer = await readFile(new URL(name, assetDir));
    const size = getWebPDimensions(buffer);
    dimensions.push({ file: name, ...size });
  }

  assert.equal(dimensions.length, 4);
  const first = dimensions[0];
  for (const current of dimensions.slice(1)) {
    assert.equal(current.width, first.width);
    assert.equal(current.height, first.height);
  }
});

test("content scan: no TODO / old starter / fake template phrases in core app text", async () => {
  const forbidden = [
    /TODO\b/i,
    /old\s+starter/i,
    /fake\s+template/i,
    /\b(?:AI|ARM)\s+progress\b/i,
  ];

  for (const file of collectFilesForContentScan()) {
    const text = await readFile(file, "utf8");
    for (const entry of forbidden) {
      assert.equal(entry.test(text), false, `${file.pathname} 包含禁止短语 ${entry}`);
    }
  }
});
