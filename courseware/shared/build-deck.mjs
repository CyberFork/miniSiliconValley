import {cp,mkdir,readFile,rm,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
import vm from 'node:vm';
import {writeTeachingPlan} from './generate-plans.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildDeck(name){
 const root=join(base,name),engine=join(base,'module-thinking-deck'),dist=join(root,'dist');
 const p1=name==='module-thinking-deck';const box={window:{}};vm.createContext(box);vm.runInContext(await readFile(join(root,'deck-data.js'),'utf8'),box);const model=box.window.MSV_MODULE_DECK;
 await writeTeachingPlan(root,model);
 await rm(dist,{recursive:true,force:true});
 const local=['deck-data.js'];const engineFiles=['deck-runtime.js','deck.css','presenter-runtime.js','presenter.css','lesson-tools.js','favicon.svg'];
 for(const surface of ['audience','teacher']){
  const target=join(dist,surface);await mkdir(target,{recursive:true});
  for(const file of local)await cp(join(root,file),join(target,file));
  for(const file of engineFiles){if(surface==='audience'&&file.startsWith('presenter'))continue;if(surface==='teacher'&&file==='deck-runtime.js')continue;await cp(join(engine,file),join(target,file));}
  await cp(join(engine,'assets'),join(target,'assets'),{recursive:true});
  if(p1){for(const file of ['module-3d.js','voxel-designs.js','p1-scenes.css'])await cp(join(engine,file),join(target,file));await cp(join(engine,'vendor'),join(target,'vendor'),{recursive:true});}
 }
 await cp(join(root,'index.html'),join(dist,'audience/index.html'));
 await cp(join(root,'presenter-notes.js'),join(dist,'teacher/presenter-notes.js'));
 let presenter=await readFile(join(root,'presenter.html'),'utf8');presenter=presenter.replace('data-audience-url="./index.html"','data-audience-url="../audience/index.html"');await writeFile(join(dist,'teacher/presenter.html'),presenter);
 if(p1)await cp(join(root,'printables'),join(dist,'audience/printables'),{recursive:true});
 else{
  for(const dir of ['workbook','templates','demo'])await cp(join(root,dir),join(dist,'audience',dir),{recursive:true});
  const catalog=JSON.parse(await readFile(join(root,'templates/catalog.json'),'utf8'));
  // Derive browser catalog from canonical Markdown every build; never keep two mutable copies.
  for(const doc of catalog)doc.text=await readFile(join(root,'templates',doc.filename),'utf8');
  await writeFile(join(dist,'audience/workbook/catalog.js'),'window.MSV_PROMPT_TEMPLATES = '+JSON.stringify(catalog)+';\n');
 }
 const materials=join(dist,'audience',p1?'printables':'templates');
 zip(materials,join(materials,p1?'materials.zip':'templates.zip'));
 async function list(dir){let out=[];for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,entry.name);out.push(...(entry.isDirectory()?await list(p):[p]));}return out;}
 async function records(surface){return Promise.all((await list(join(dist,surface))).map(async path=>{const buf=await readFile(path);return {path:relative(dist,path),sha256:createHash('sha256').update(buf).digest('hex'),bytes:buf.length};}));}
 const manifest={schemaVersion:1,todoId:p1?'T-132':'T-133',changeTodoIds:p1?['T-122','T-128','T-130','T-132']:['T-089','T-120','T-133'],coursewareId:model.id,releaseRevision:p1?7:1,version:model.version,releaseStatus:'deployment-ready',manualAcceptance:'not-signed-by-user',sourceXmindSha256:model.sourceHash||null,audience:await records('audience'),teacher:await records('teacher'),securityBoundary:'audience 不含教师提示；teacher 必须沿用服务端导师权限保护。以新 revision URL 部署，不覆盖历史版本；人工试讲未签署。'};
 manifest.digest=createHash('sha256').update([...manifest.audience,...manifest.teacher].map(i=>i.path+'\0'+i.sha256+'\n').join('')).digest('hex');
 await writeFile(join(dist,'BUILD-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 zip(join(dist,'audience'),join(dist,'audience-offline.zip'));zip(join(dist,'teacher'),join(dist,'teacher-private.zip'));
 console.log(`${model.id}: ${model.slides.length} slides; deployment-ready ${manifest.digest}; physical teacher split`);
 return manifest;
}
function zip(source,target){execFileSync('python3',['-c',`import sys,zipfile\nfrom pathlib import Path\ns=Path(sys.argv[1]);t=Path(sys.argv[2])\nwith zipfile.ZipFile(t,'w',zipfile.ZIP_DEFLATED) as z:\n for p in sorted(s.rglob('*')):\n  if p.is_file() and p!=t:\n   i=zipfile.ZipInfo(p.relative_to(s).as_posix(),(2026,9,19,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o644<<16;z.writestr(i,p.read_bytes())`,source,target]);}
