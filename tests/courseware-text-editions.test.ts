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
const spec=catalog[0];
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
