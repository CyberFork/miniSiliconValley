// Public prompts and course workbooks consume this same source, never a release snapshot.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const studentWorkbookSource=fileURLToPath(new URL('./game-development/',import.meta.url));
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
export async function buildPromptCenter(output){
 const manifest=await buildStudentWorkbook(studentWorkbookSource,output);
 manifest.files['student-prompt.txt']=manifest.promptSha256;
 manifest.canonical='/prompts/';
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw new Error('Usage: node prompts/build.mjs OUTPUT_DIRECTORY');
 console.log(JSON.stringify(await buildPromptCenter(resolve(process.argv[2]))));
}
