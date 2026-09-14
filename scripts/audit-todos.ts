import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type TodoIssue = { file: string; message: string };
export type TodoRecord = { id: string; title: string; status: string; file: string; unchecked: number };

export function auditTodos(dir = join(process.cwd(), ".codex/inbox/todos")) {
  const issues: TodoIssue[] = [], records: TodoRecord[] = [], ids = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const text = readFileSync(join(dir, file), "utf8"), match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) { issues.push({ file, message: "missing frontmatter" }); continue; }
    const fields: Record<string,string> = {};
    for (const line of match[1].split("\n")) { const m = line.match(/^([\w-]+):\s*(.*)$/); if (m) fields[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
    const id = fields.id ?? "", prefix = file.match(/^(\d+)-/)?.[1];
    if (!/^T-\d{3}$/.test(id)) issues.push({ file, message: "invalid id" });
    if (!prefix) issues.push({ file, message: "filename must start with the numeric todo id" });
    if (prefix && Number(id.slice(2)) !== Number(prefix)) issues.push({ file, message: "filename prefix does not match id" });
    if (ids.has(id)) issues.push({ file, message: `duplicate id ${id}` }); ids.add(id);
    if (!["backlog","in-progress","blocked","completed"].includes(fields.status)) issues.push({ file, message: "invalid status" });
    const unchecked = (text.match(/^\s*- \[ \]/gm) ?? []).length;
    records.push({ id, title: fields.title ?? "", status: fields.status ?? "", file, unchecked });
  }
  return { records, issues, unfinished: records.filter((r) => r.status !== "completed"), warnings: records.filter((r) => r.status === "completed" && r.unchecked > 0) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = auditTodos();
  const json = process.argv.includes("--json");
  if (json) console.log(JSON.stringify(result, null, 2));
  else { console.log(`Todo registry: ${result.records.length} files`); result.unfinished.forEach((r) => console.log(`- ${r.id} [${r.status}] ${r.title}`)); result.warnings.forEach((r) => console.log(`warning: ${r.file} has ${r.unchecked} unchecked checkbox(es)`)); result.issues.forEach((i) => console.error(`error: ${i.file}: ${i.message}`)); }
  process.exitCode = result.issues.length ? 1 : 0;
}
