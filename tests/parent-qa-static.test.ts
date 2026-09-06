import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const OUTPUT = new URL("../dist/work-qa/msv/", import.meta.url);

test("parent Q&A static output has the production route, client endpoint and no secret", async () => {
  const html = await readFile(new URL("qa.html", OUTPUT), "utf8");
  assert.match(html, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/work\.cyberforker\.com\/msv\/qa\.html["']/i);
  for (const copy of ["Mini Silicon Valley 家长问答", "请勿输入孩子的真实姓名", "不猜测", "待补充清单"]) {
    assert.ok(html.includes(copy), `qa.html 缺少关键内容：${copy}`);
  }
  assert.doesNotMatch(html, /DEEPSEEK_API_KEY|sk-[a-zA-Z0-9]{16,}/);

  const manifest = JSON.parse(await readFile(new URL("qa-manifest.json", OUTPUT), "utf8")) as {
    target: string;
    files: Array<{ path: string; bytes: number; sha256: string }>;
  };
  assert.equal(manifest.target, "https://work.cyberforker.com/msv/qa.html");
  assert.ok(manifest.files.some(({ path }) => path === "qa.html"));
  assert.ok(manifest.files.some(({ path }) => path.startsWith("_next/") && path.endsWith(".js")));

  let combinedText = html;
  for (const file of manifest.files) {
    const url = new URL(file.path, OUTPUT);
    const bytes = await readFile(url);
    assert.equal((await stat(url)).size, file.bytes, `${file.path} 字节数不匹配`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `${file.path} 哈希不匹配`);
    if (/\.(?:js|html|css)$/.test(file.path)) combinedText += bytes.toString("utf8");
  }
  assert.match(combinedText, /\/msv\/api\/qa/);
  assert.doesNotMatch(combinedText, /DEEPSEEK_API_KEY|sk-[a-zA-Z0-9]{16,}/);
});
