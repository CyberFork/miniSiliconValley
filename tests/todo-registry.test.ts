import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditTodos } from "../scripts/audit-todos";
function fixture(body: string) { const d = mkdtempSync(join(tmpdir(), "todos-")); writeFileSync(join(d, "001-test.md"), body); return d; }
test("duplicate id is reported", () => { const d = mkdtempSync(join(tmpdir(), "todos-")); const f = "---\nid: T-001\ntitle: x\nstatus: backlog\n---\n"; writeFileSync(join(d,"001-a.md"),f); writeFileSync(join(d,"001-b.md"),f); assert.ok(auditTodos(d).issues.some((i)=>i.message.includes("duplicate"))); });
test("bad filename and status", () => { const r = auditTodos(fixture("---\nid: T-002\ntitle: x\nstatus: nope\n---\n")); assert.equal(r.issues.length, 2); });
test("missing numeric filename prefix", () => { const d = mkdtempSync(join(tmpdir(), "todos-")); writeFileSync(join(d,"orphan.md"),"---\nid: T-001\ntitle: x\nstatus: backlog\n---\n"); assert.ok(auditTodos(d).issues.some((i)=>i.message.includes("must start"))); });
test("open summary", () => { const r = auditTodos(fixture("---\nid: T-001\ntitle: x\nstatus: in-progress\n---\n- [ ] task\n")); assert.equal(r.unfinished[0].id, "T-001"); });
