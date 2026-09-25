import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import type { ClassroomD1 } from "../db";
import type { AuthenticatedClassroomUser } from "../app/lib/classroom-api";
import { readTextEdition, saveTextEdition } from "../app/lib/courseware-text-editions";
import catalog from "../app/lib/courseware-text-catalog.json";
type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };

function database(maximum = Number.POSITIVE_INFINITY): LocalDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item) && Number(item.slice(0, 4)) <= maximum).sort()) {
    raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  const api = {
    raw,
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; },
        async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; },
        async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; },
        async run() { return statement.execute(); },
        execute() {
          const result = raw.prepare(sql).run(...values);
          return { success: true, meta: { changes: result.changes } } as unknown as D1Result;
        },
      };
      return statement;
    },
    async batch(statements: LocalStatement[]) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return api as unknown as LocalDatabase;
}


const mentor: AuthenticatedClassroomUser={userId:"test-mentor",displayName:"synthetic",platformRole:"mentor"};
const learner: AuthenticatedClassroomUser={...mentor,userId:"test-learner",platformRole:"learner"};
const spec={id:"synthetic-legacy-only",version:"legacy-test",slideIds:["s1","s2"]};
(catalog as unknown as unknown[]).push(spec);
const input={base:spec.version,expectedRevision:0,key:spec.slideIds[0]+":title",value:"新标题"};
const save=(db:ClassroomD1,patch:Partial<typeof input>={})=>saveTextEdition(db,mentor,spec.id,{...input,...patch});

test("server editions persist complete immutable snapshots and old editions remain readable",async()=>{
 const db=database();
 assert.equal((await readTextEdition(db,mentor,spec.id,spec.version)).edition.revision,0);
 await save(db);
 await save(db,{expectedRevision:1,key:spec.slideIds[1]+":subtitle",value:"第二项"});
 const current=await readTextEdition(db,mentor,spec.id,spec.version);
 assert.equal(current.edition.revision,2); assert.equal(Object.keys(current.edition.patches).length,2);
 const old=await readTextEdition(db,mentor,spec.id,spec.version,1);assert.deepEqual(old.edition.patches,{[input.key]:"新标题"});
 assert.deepEqual((await readTextEdition(db,mentor,spec.id,spec.version,0)).edition.patches,{});
 await assert.rejects(readTextEdition(db,mentor,spec.id,spec.version,99),{code:"TEXT_EDITION_NOT_FOUND"});
});
test("CAS concurrent and stale saves do not overwrite another mentor",async()=>{
 const db=database();
 const results=await Promise.allSettled([save(db,{value:"A"}),save(db,{value:"B"})]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(results.filter(r=>r.status==="rejected").length,1);
 const before=await readTextEdition(db,mentor,spec.id,spec.version);
 await assert.rejects(save(db,{value:"stale"}),{code:"TEXT_EDITION_CONFLICT"});
 assert.deepEqual((await readTextEdition(db,mentor,spec.id,spec.version)).edition,before.edition);
});
test("learner can read public text but cannot write; impersonation and observers cannot access editions",async()=>{
 const db=database();await save(db);
 const read=await readTextEdition(db,learner,spec.id,spec.version);assert.equal(read.edition.revision,1);assert.deepEqual(read.history,[]);
 await assert.rejects(saveTextEdition(db,learner,spec.id,input),{code:"TEXT_EDIT_FORBIDDEN"});
 for(const user of [{...mentor,impersonationId:"test"},{...mentor,platformRole:"observer" as const}]){
  await assert.rejects(readTextEdition(db,user,spec.id,spec.version),{code:"TEXT_ACCESS_FORBIDDEN"});
  await assert.rejects(saveTextEdition(db,user,spec.id,input),{code:"TEXT_ACCESS_FORBIDDEN"});
 }
});
test("base and field bounds reject invalid data, plain text is stored without executing HTML",async()=>{
 const db=database();
 await assert.rejects(save(db,{base:"unknown"}),{code:"TEXT_BASE_UNKNOWN"});
 for(const key of ["unknown:title",spec.slideIds[0]+":__proto__",spec.slideIds[0]+":body.x"]){await assert.rejects(save(db,{key}),{code:"TEXT_INPUT_INVALID"});}
 for(const value of ["x".repeat(2001),"\u0000",undefined,7])await assert.rejects(saveTextEdition(db,mentor,spec.id,{...input,value:value as string}),{code:"TEXT_INPUT_INVALID"});
 const value='<img src=x onerror="alert(1)">';await save(db,{value});
 assert.equal((await readTextEdition(db,mentor,spec.id,spec.version)).edition.patches[input.key],value);
});
test("restoring original text is a new edition; decks and bases are isolated",async()=>{
 const db=database();await save(db);
 await saveTextEdition(db,mentor,spec.id,{...input,expectedRevision:1,value:null});
 assert.deepEqual((await readTextEdition(db,mentor,spec.id,spec.version)).edition.patches,{});
 assert.equal((await readTextEdition(db,mentor,spec.id,spec.version,1)).edition.patches[input.key],"新标题");
 assert.equal((await readTextEdition(db,mentor,catalog[1].id,catalog[1].version)).edition.revision,0);
});

test("shared-v1 carries an edit across bases and reports changed or removed originals",async()=>{
 const db=database(); const deckId="synthetic-shared";
 const original={id:deckId,version:"v1",slideIds:["s"],textSchema:"shared-v1",fields:{"s:title":"原文","s:subtitle":"保留"}};
 const same={...original,version:"v2",fields:{...original.fields}};
 const changed={...original,version:"v3",fields:{"s:title":"新版原文","s:subtitle":"保留"}};
 const removed={...original,version:"v4",fields:{"s:title":"原文"}};
 const additions=[original,same,changed,removed]; (catalog as unknown as unknown[]).push(...additions);
 try {
  await saveTextEdition(db,mentor,deckId,{base:"v1",expectedRevision:0,key:"s:title",value:"我的修改"});
  await saveTextEdition(db,mentor,deckId,{base:"v1",expectedRevision:1,key:"s:subtitle",value:"副标题修改"});
  const inherited=await readTextEdition(db,mentor,deckId,"v2");
  assert.equal(inherited.edition.patches["s:title"],"我的修改"); assert.deepEqual(inherited.conflicts,[]);
  const conflict=await readTextEdition(db,mentor,deckId,"v3");
  assert.equal(conflict.edition.patches["s:title"],undefined); assert.equal(conflict.conflicts[0].reason,"新版原文已改变，请确认沿用修改还是采用新版原文");
  const removedRead=await readTextEdition(db,mentor,deckId,"v4");
  assert.equal(removedRead.edition.patches["s:subtitle"],undefined); assert.equal(removedRead.conflicts.some((item)=>item.key==="s:subtitle"&&item.current===null),true);
  await saveTextEdition(db,mentor,deckId,{base:"v4",expectedRevision:2,key:"s:subtitle",value:null});
  const cleared=await readTextEdition(db,mentor,deckId,"v4"); assert.equal(cleared.edition.revision,3); assert.equal(cleared.edition.patches["s:title"],"我的修改"); assert.equal(cleared.edition.patches["s:subtitle"],undefined);
 } finally { (catalog as unknown as unknown[]).splice(-additions.length,additions.length); }
});

test("shared-v1 CAS is global across bases while decks remain isolated",async()=>{
 const db=database(); const specs=[
  {id:"cas-a",version:"a1",slideIds:["s"],textSchema:"shared-v1",fields:{"s:title":"A"}},
  {id:"cas-a",version:"a2",slideIds:["s"],textSchema:"shared-v1",fields:{"s:title":"A"}},
  {id:"cas-b",version:"b1",slideIds:["s"],textSchema:"shared-v1",fields:{"s:title":"B"}},
 ]; (catalog as unknown as unknown[]).push(...specs);
 try { const results=await Promise.allSettled([
   saveTextEdition(db,mentor,"cas-a",{base:"a1",expectedRevision:0,key:"s:title",value:"一"}),
   saveTextEdition(db,mentor,"cas-a",{base:"a2",expectedRevision:0,key:"s:title",value:"二"}),
 ]); assert.equal(results.filter(r=>r.status==="fulfilled").length,1); assert.equal(results.filter(r=>r.status==="rejected").length,1);
  assert.equal((await readTextEdition(db,mentor,"cas-b","b1")).edition.revision,0);
 } finally { (catalog as unknown as unknown[]).splice(-specs.length,specs.length); }
});

test("shared history supports explicit zero and immutable old reads",async()=>{
 const db=database(); const spec={id:"history-shared",version:"v1",slideIds:["s"],textSchema:"shared-v1",fields:{"s:title":"原文"}}; (catalog as unknown as unknown[]).push(spec);
 try { await saveTextEdition(db,mentor,spec.id,{base:spec.version,expectedRevision:0,key:"s:title",value:"一"}); await saveTextEdition(db,mentor,spec.id,{base:spec.version,expectedRevision:1,key:"s:title",value:"二"});
  assert.deepEqual((await readTextEdition(db,mentor,spec.id,spec.version,0)).edition.patches,{});
  assert.equal((await readTextEdition(db,mentor,spec.id,spec.version,1)).edition.patches["s:title"],"一");
 } finally { (catalog as unknown as unknown[]).pop(); }
});

test("legacy bases are retired after a shared edition exists",async()=>{
 const db=database(); const specs=[
  {id:"retired-shared",version:"legacy",slideIds:["s"]},
  {id:"retired-shared",version:"new",slideIds:["s"],textSchema:"shared-v1",fields:{"s:title":"原文"}},
 ]; (catalog as unknown as unknown[]).push(...specs);
 try { await assert.rejects(saveTextEdition(db,mentor,"retired-shared",{base:"legacy",expectedRevision:0,key:"s:title",value:"旧"}),{code:"TEXT_BASE_RETIRED"});
  await saveTextEdition(db,mentor,"retired-shared",{base:"new",expectedRevision:0,key:"s:title",value:"新"});
  await assert.rejects(saveTextEdition(db,mentor,"retired-shared",{base:"legacy",expectedRevision:0,key:"s:title",value:"旧"}),{code:"TEXT_BASE_RETIRED"});
 } finally { (catalog as unknown as unknown[]).splice(-specs.length,specs.length); }
});

test("AI-08 runtime fields are editable in r22 and shared with r23, with state isolation",async()=>{
 const db=database(),deck="module-thinking-p1",key="ai-09:runtime.change.approved";
 const a="2026.09.23-p1-r22",b="2026.09.24-p1-r23";
 await saveTextEdition(db,mentor,deck,{base:a,expectedRevision:0,key,value:"课堂验收后继续开发"});
 for(const base of [a,b]){
  const r=await readTextEdition(db,mentor,deck,base);
  assert.equal(r.edition.patches[key],"课堂验收后继续开发");assert.deepEqual(r.conflicts,[]);
  assert.equal(r.edition.patches["ai-09:runtime.change.proposed"],undefined);
 }
 await assert.rejects(saveTextEdition(db,learner,deck,{base:a,expectedRevision:1,key,value:"not allowed"}),{code:"TEXT_EDIT_FORBIDDEN"});
 await assert.rejects(saveTextEdition(db,mentor,deck,{base:b,expectedRevision:1,key:"ai-09:runtime.change.unknown",value:"bad field"}),{code:"TEXT_INPUT_INVALID"});
 await saveTextEdition(db,mentor,deck,{base:b,expectedRevision:1,key,value:null});
 assert.equal((await readTextEdition(db,mentor,deck,a)).edition.patches[key],undefined);
});
