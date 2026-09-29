// Public composer uses modules/. Frozen course workbook output remains byte-compatible.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
export const studentWorkbookSource=fileURLToPath(new URL('./game-development/',import.meta.url));
export const generalWorkbookSource=fileURLToPath(new URL('./general-project/',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function buildStudentWorkbook(source,output){
 await mkdir(output,{recursive:true});
 const text=await readFile(join(studentWorkbookSource,'student-prompt.txt'),'utf8');
 if(!text.trim())throw new Error('Student prompt is empty');
 for(const file of ['index.html','workbook.js','workbook.css','student-prompt.txt'])await writeFile(join(output,file),await readFile(join(['student-prompt.txt','workbook.js'].includes(file)?studentWorkbookSource:source,file)));
 await writeFile(join(output,'student-prompt.js'),'window.MSV_STUDENT_PROMPT = '+JSON.stringify(text)+';\n');
 const files={};
 // Retain the r24 overlay contract; standalone manifest additionally includes the text.
 for(const file of ['index.html','workbook.js','workbook.css','student-prompt.js'])files[file]=sha(await readFile(join(output,file)));
 return {version:'public-prompts-1',promptVersion:'r24-simple-5',promptSha256:sha(text),files};
}
const composerSource=fileURLToPath(new URL('./composer/',import.meta.url));
export async function loadPromptModules(){
 const modules={};
 for(const name of ['base','game','paths','start'])modules[name]=await readFile(new URL('./modules/'+name+'.txt',import.meta.url),'utf8');
 return modules;
}
async function buildComposerPage(output,{game=true}={}){
 await mkdir(output,{recursive:true});
 const modules=await loadPromptModules();
 const composeCode=await readFile(join(composerSource,'compose.js'),'utf8');
 const context={window:{}};vm.runInNewContext(composeCode,context);
 const compose=context.window.MSV_PROMPT_COMPOSER.compose;
 const combinations={};
 for(const g of [false,true])for(const p of [false,true])combinations[(g?'game':'general')+(p?'+paths':'')]=sha(compose(modules,{game:g,paths:p}));
 const text=compose(modules,{game,paths:false});
 for(const file of ['index.html','workbook.js','workbook.css','compose.js'])await writeFile(join(output,file),await readFile(join(composerSource,file)));
 await writeFile(join(output,'student-prompt.txt'),text);
 await writeFile(join(output,'student-prompt.js'),'window.MSV_PROMPT_MODULES = '+JSON.stringify(modules)+';\nwindow.MSV_STUDENT_PROMPT = window.MSV_PROMPT_COMPOSER.compose(window.MSV_PROMPT_MODULES, '+JSON.stringify({game,paths:false})+');\n');
 const files={};
 for(const file of ['index.html','workbook.js','workbook.css','compose.js','student-prompt.js','student-prompt.txt'])files[file]=sha(await readFile(join(output,file)));
 const manifest={version:'modular-prompts-1',canonical:game?'/prompts/':'/prompts/?game=0',defaults:{game,paths:false},required:['base'],moduleSha256:Object.fromEntries(Object.entries(modules).map(([name,text])=>[name,sha(text)])),combinations,promptSha256:sha(text),files};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
export async function buildPromptCenter(output){
 const manifest=await buildComposerPage(output);
 manifest.general=await buildGeneralWorkbook(join(output,'general'));
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
export async function buildGeneralWorkbook(output){return buildComposerPage(output,{game:false});}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw new Error('Usage: node prompts/build.mjs OUTPUT_DIRECTORY');
 console.log(JSON.stringify(await buildPromptCenter(resolve(process.argv[2]))));
}
