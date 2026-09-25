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
test("dangling references and missing sequential ids are reported", () => { const d = mkdtempSync(join(tmpdir(), "todos-")); writeFileSync(join(d,"001-a.md"),"---\nid: T-001\ntitle: x\nstatus: backlog\n---\nRelated: T-002\n"); writeFileSync(join(d,"003-c.md"),"---\nid: T-003\ntitle: z\nstatus: completed\n---\n"); const issues=auditTodos(d).issues.map((i)=>i.message); assert.ok(issues.includes("references missing todo T-002")); assert.ok(issues.includes("missing sequential todo T-002")); });
test("blocked items require an explicit reason", () => { const r=auditTodos(fixture("---\nid: T-001\ntitle: x\nstatus: blocked\n---\n")); assert.ok(r.issues.some((i)=>i.message.includes("blocked_reason"))); });
test("open summary", () => { const r = auditTodos(fixture("---\nid: T-001\ntitle: x\nstatus: in-progress\n---\n- [ ] task\n")); assert.equal(r.unfinished[0].id, "T-001"); });
