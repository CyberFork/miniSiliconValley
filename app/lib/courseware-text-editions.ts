import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";
import catalog from "./courseware-text-catalog.json";
import runtimeCatalog from "../../courseware/shared/runtime-text-catalog.json";

type Spec = {id: string; version: string; slideIds: string[]; textSchema?: string; fields?: Record<string,string>};
const SHARED = "@shared-v1";
type Edit = {value: string | null; original: string; base: string};
type Shared = Record<string, Edit>;
type Patches = Record<string, string>;
type Row = { revision: number; patches_json: string; created_at: string };
export function textEditionBase(deckId: string, base: string) {
  const spec = (catalog as Spec[]).find((item) => item.id === deckId && item.version === base);
  if (!spec) throw new ClassroomError("TEXT_BASE_UNKNOWN", "这份课件尚不支持编辑，请从课件库打开最新版。", 404);
  const runtime = runtimeCatalog.find(item => item.id === deckId && item.bases.includes(base));
  return runtime ? {...spec, fields: {...spec.fields, ...runtime.fields}} : spec;
}
function canRead(user: AuthenticatedClassroomUser) {
  if (user.impersonationId || !["admin", "mentor", "learner"].includes(user.platformRole ?? "")) throw new ClassroomError("TEXT_ACCESS_FORBIDDEN", "当前身份不能读取这份课件。", 403);
}
function canEdit(user: AuthenticatedClassroomUser) {
  canRead(user);
  if (!["admin", "mentor"].includes(user.platformRole ?? "")) throw new ClassroomError("TEXT_EDIT_FORBIDDEN", "只有导师和管理员可以修改课件。", 403);
}
function fail(message: string): never { throw new ClassroomError("TEXT_INPUT_INVALID", message, 400); }
export async function readTextEdition(db: ClassroomD1, user: AuthenticatedClassroomUser, deckId: string, base: string, revision?: number) {
  canRead(user); const spec = textEditionBase(deckId, base);
  if (spec.textSchema === "shared-v1") return readShared(db,user,deckId,spec,revision);
  if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0)) fail("文字版本编号无效。");
  const latest = await db.prepare("SELECT revision, patches_json, created_at FROM courseware_text_editions WHERE deck_id = ? AND base_version = ? ORDER BY revision DESC LIMIT 1").bind(deckId, base).first<Row>();
  let row = latest;
  if (revision === 0) row = null;
  else if (revision !== undefined) {
    row = await db.prepare("SELECT revision, patches_json, created_at FROM courseware_text_editions WHERE deck_id = ? AND base_version = ? AND revision = ?").bind(deckId, base, revision).first<Row>();
    if (!row) throw new ClassroomError("TEXT_EDITION_NOT_FOUND", "找不到此文字版本。", 404);
  }
  const history = user.platformRole === "learner" ? [] : (await db.prepare("SELECT revision, created_at FROM courseware_text_editions WHERE deck_id = ? AND base_version = ? ORDER BY revision DESC LIMIT 100").bind(deckId, base).all<{revision: number; created_at: string}>()).results;
  return { conflicts: [], deckId, base, edition: { revision: row?.revision ?? 0, patches: row ? JSON.parse(row.patches_json) as Patches : {}, createdAt: row?.created_at ?? null }, latestRevision: latest?.revision ?? 0, history };
}
export async function saveTextEdition(db: ClassroomD1, user: AuthenticatedClassroomUser, deckId: string, input: {base: string; expectedRevision: number; key: string; value: string | null}) {
  canEdit(user);
  const spec = textEditionBase(deckId, input.base);
  if (spec.textSchema === "shared-v1") return saveShared(db,user,deckId,spec,input);
  if ((catalog as Spec[]).some(item => item.id === deckId && item.textSchema === "shared-v1"))
    throw new ClassroomError("TEXT_BASE_RETIRED", "这份旧课件仅保留历史文字。请从课件库打开新版继续编辑，已保存的修改会继承。", 409);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) fail("请先加载服务器最新版本。");
  const split = input.key.indexOf(":");
  const slideId = input.key.slice(0, split), field = input.key.slice(split + 1);
  if (split < 0 || !spec.slideIds.includes(slideId) || !/^(title|subtitle|body(?:\.\d{1,3}){1,12})$/.test(field)) fail("文字位置无效，请刷新课件后重试。");
  if (input.value !== null && (typeof input.value !== "string" || input.value.length > 2000 || Array.from(input.value).some((c) => c.charCodeAt(0) < 32 && ![9,10,13].includes(c.charCodeAt(0))))) fail("每处文字最多2000字，不能包含控制字符。");
  const current = await readTextEdition(db, user, deckId, input.base);
  if (current.latestRevision !== input.expectedRevision) throw new ClassroomError("TEXT_EDITION_CONFLICT", "另一位导师已保存新版。你的输入仍保留，请加载最新版本后核对再保存。", 409);
  const patches: Patches = { ...current.edition.patches };
  if (input.value === null) delete patches[input.key]; else patches[input.key] = input.value;
  if (Object.keys(patches).length > 2000 || new TextEncoder().encode(JSON.stringify(patches)).byteLength > 256 * 1024) fail("这份课件修改内容过多，请联系管理员整理课件。");
  const revision = input.expectedRevision + 1;
  // A single conditional INSERT is the publication point: concurrent saves
  // cannot both succeed, and a response failure can never corrupt a pointer.
  const result = await db.prepare(`INSERT INTO courseware_text_editions (deck_id,base_version,revision,patches_json,author_id,created_at)
    SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM courseware_text_editions WHERE deck_id=? AND base_version=?),0)=?`)
    .bind(deckId, input.base, revision, JSON.stringify(patches), user.userId, new Date().toISOString(), deckId, input.base, input.expectedRevision).run();
  if (!result.meta.changes) throw new ClassroomError("TEXT_EDITION_CONFLICT", "另一位导师刚保存了新版。请保留输入并加载最新版本后重试。", 409);
  return readTextEdition(db, user, deckId, input.base, revision);
}

function sharedFields(spec: Spec) { return spec.fields ?? {}; }
async function sharedRow(db: ClassroomD1,deckId: string,revision?: number) {
  if(revision===0)return null;
  return revision===undefined
    ? db.prepare("SELECT revision,patches_json,created_at FROM courseware_text_editions WHERE deck_id=? AND base_version=? ORDER BY revision DESC LIMIT 1").bind(deckId,SHARED).first<Row>()
    : db.prepare("SELECT revision,patches_json,created_at FROM courseware_text_editions WHERE deck_id=? AND base_version=? AND revision=?").bind(deckId,SHARED,revision).first<Row>();
}
async function readShared(db: ClassroomD1,user: AuthenticatedClassroomUser,deckId: string,spec: Spec,revision?: number) {
  if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0))fail("文字版本编号无效。");
  const latest=await sharedRow(db,deckId),row=revision===undefined?latest:await sharedRow(db,deckId,revision);
  if(revision && !row)throw new ClassroomError("TEXT_EDITION_NOT_FOUND","找不到此文字版本。",404);
  const state: Shared=row?JSON.parse(row.patches_json):{},fields=sharedFields(spec),patches: Patches={};
  const conflicts: {key:string;value:string;original:string;current:string|null;sourceBase:string;reason:string}[]=[];
  for(const [key,edit] of Object.entries(state)) {
    if(edit.value===null)continue;
    if(!Object.hasOwn(fields,key)||fields[key]!==edit.original) {
      conflicts.push({key,value:edit.value,original:edit.original,current:fields[key]??null,sourceBase:edit.base,reason:Object.hasOwn(fields,key)?"新版原文已改变，请确认沿用修改还是采用新版原文":"新版中已移除或无法确认对应位置；修改仍保留，可复制后重新安置"});
    }else patches[key]=edit.value;
  }
  const history=user.platformRole==="learner"?[]:(await db.prepare("SELECT revision,created_at FROM courseware_text_editions WHERE deck_id=? AND base_version=? ORDER BY revision DESC LIMIT 100").bind(deckId,SHARED).all<{revision:number;created_at:string}>()).results;
  return {deckId,base:spec.version,contentScope:SHARED,edition:{revision:row?.revision??0,patches,createdAt:row?.created_at??null},latestRevision:latest?.revision??0,history,conflicts:user.platformRole==="learner"?[]:conflicts};
}
async function saveShared(db: ClassroomD1,user: AuthenticatedClassroomUser,deckId: string,spec: Spec,input:{base:string;expectedRevision:number;key:string;value:string|null}) {
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)fail("请先加载服务器最新版本。");
  if(input.value!==null&&(typeof input.value!=="string"||input.value.length>2000||Array.from(input.value).some(c=>c.charCodeAt(0)<32&&![9,10,13].includes(c.charCodeAt(0)))))fail("每处文字最多2000字，不能包含控制字符。");
  const row=await sharedRow(db,deckId),state: Shared=row?JSON.parse(row.patches_json):{},fields=sharedFields(spec);
  if((row?.revision??0)!==input.expectedRevision)throw new ClassroomError("TEXT_EDITION_CONFLICT","另一位导师已保存新版。你的输入仍保留，请加载最新版本后核对再保存。",409);
  if(!Object.hasOwn(fields,input.key)&&!(input.value===null&&Object.hasOwn(state,input.key)))fail("文字位置无效，请刷新课件后重试。");
  // Tombstones are retained: restoring original must never resurrect a legacy edit.
  state[input.key]={value:input.value,original:fields[input.key]??state[input.key].original,base:spec.version};
  const encoded=JSON.stringify(state);
  if(Object.keys(state).length>3000||new TextEncoder().encode(encoded).byteLength>1024*1024)fail("修改内容过多，请联系管理员整理课件。");
  const result=await db.prepare(`INSERT INTO courseware_text_editions (deck_id,base_version,revision,patches_json,author_id,created_at)
    SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM courseware_text_editions WHERE deck_id=? AND base_version=?),0)=?`)
    .bind(deckId,SHARED,input.expectedRevision+1,encoded,user.userId,new Date().toISOString(),deckId,SHARED,input.expectedRevision).run();
  if(!result.meta.changes)throw new ClassroomError("TEXT_EDITION_CONFLICT","另一位导师刚保存了新版。请保留输入并加载最新版本后重试。",409);
  return readShared(db,user,deckId,spec,input.expectedRevision+1);
}
