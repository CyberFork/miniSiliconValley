import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=text=>createHash('sha256').update(text).digest('hex');
const VERSION='2026.09.24-plan-only.1';
const SOURCE_SHA='a3553c2cc9ace2b8b141704140ca8a59c34c24f0c27cc4aa938e8a53afd3d133';
const files=['SKILL.md','agents/openai.yaml','assets/start-prompt.md','references/rod-spec.md','references/handoff-prompt.md','references/source-basis.md'];
export async function coachSpec(templatesDir){
 const root=resolve(templatesDir,'../coach/ligun-game-coach');
 const source=Object.fromEntries(await Promise.all(files.map(async p=>[p,await readFile(join(root,p),'utf8')])));
 const hashes=files.map(path=>({path,sha256:sha(source[path])}));
 const digest=sha(hashes.map(f=>f.path+'\0'+f.sha256+'\n').join(''));
 const inline=text=>text.replace(/^---\n[\s\S]*?\n---\n/,'').replace(/\[([^\]]+)\]\((?:references|assets)\/[^)]+\)/g,'「$1」（完整规范已附在本消息内）');
 const compatible='# ①策划 → ②立棍方案｜完整对齐规范\n\n技能版本：'+VERSION+'\n内容标识：'+digest+'\n\n这不是最终②，也没有任何学生预先确认。请依照下面完整规范，在外部 AI 对话中读策划、逐问补全、等待真实确认，最终只生成②。不得把示例当作我的项目或替我确认。\n\n'+['SKILL.md','references/rod-spec.md','references/handoff-prompt.md','assets/start-prompt.md','references/source-basis.md'].map(p=>inline(source[p])).join('\n\n---\n\n');
 return {version:VERSION,digest,sourcePackageSha256:SOURCE_SHA,files:hashes,compatible,start:source['assets/start-prompt.md'],root};
}
export async function promptPacks(dir){
 const spec=await coachSpec(dir);
 return {'plan-coach-compatible.md':{text:spec.compatible},'skill-start.md':{text:spec.start},'alignment-prompt.md':{text:spec.compatible}};
}
export async function buildCoach(dir,output){
 const spec=await coachSpec(dir);await mkdir(output,{recursive:true});
 const manifest={version:spec.version,digest:spec.digest,sourcePackageSha256:spec.sourcePackageSha256,files:spec.files,distributionChanges:['删除内部来源文件名和教师稿溯源细节，保留公开方法口径','对齐检查例子改用既有方块小车；方案边界和确认分工未变']};
 await writeFile(join(output,'CONTENT-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 const zip=join(output,'ligun-game-coach-plan-only.zip');
 execFileSync('python3',['-c',`import sys,zipfile,json\nfrom pathlib import Path\nr=Path(sys.argv[1]);m=Path(sys.argv[2]);out=Path(sys.argv[3])\nwith zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:\n for f in json.loads(m.read_text())['files']:\n  p=r/f['path'];i=zipfile.ZipInfo('ligun-game-coach/'+f['path'],(2026,9,24,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o644<<16;z.writestr(i,p.read_bytes())\n i=zipfile.ZipInfo('ligun-game-coach/CONTENT-MANIFEST.json',(2026,9,24,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o644<<16;z.writestr(i,m.read_bytes())`,spec.root,join(output,'CONTENT-MANIFEST.json'),zip]);
 return {...manifest,packageSha256:sha(await readFile(zip))};
}

// The public prompt center owns the student source; course builds only consume it.
export {buildStudentWorkbook,studentWorkbookSource} from '../../../prompts/build.mjs';
