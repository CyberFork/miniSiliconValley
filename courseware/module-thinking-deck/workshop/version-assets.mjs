import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const names=['loading.js','app.mjs','gameplay.mjs','drive-input.mjs','model.mjs','physics.mjs','render.mjs','workshop.css','teacher/presenter.html','audience/index.html'];
export async function stampAssets(){
 const source=await Promise.all(names.map(async name=>({name,text:(await readFile(new URL(name,root),'utf8')).replace(/\?v=mc-[a-f0-9]{12}/g,'')})));
 const version='mc-'+createHash('sha256').update(source.map(s=>s.name+'\0'+s.text).join('\n')).digest('hex').slice(0,12);
 for(const {name,text} of source){
  const updated=text.replace(/(['"])(\.\.?\/(?:app|gameplay|drive-input|model|physics|render)\.mjs|\.\.\/loading\.js|\.\.\/workshop\.css)\1/g,(_,q,path)=>q+path+'?v='+version+q);
  if(await readFile(new URL(name,root),'utf8')!==updated)await writeFile(new URL(name,root),updated);
 }
 return version;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await stampAssets());
