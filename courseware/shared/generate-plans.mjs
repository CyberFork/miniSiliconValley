import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import vm from 'node:vm';

// Design decisions and migration mappings are authored; scripts/budgets derive
// from the same slide and note data rendered by the courseware.
export async function writeTeachingPlan(root,model){
 const box={window:{}};vm.createContext(box);
 vm.runInContext(await readFile(join(root,'presenter-notes.js'),'utf8'),box);
 const notes=box.window.MSV_MODULE_PRESENTER_NOTES;
 const path=join(root,'source/content-map.md');
 let preamble=(await readFile(path,'utf8')).split(/## (?:完整脚本索引|逐页教学脚本)/)[0];
 if(model.legacySlideIds){
  preamble='# P1 r6 内容迁移与活动脚本\n\n保留旧 18 页语义 ID，新增 7 页。时间是试讲基线，非已通过试讲。\n\n';
  preamble+=model.slides.map((s,i)=>`${model.legacySlideIds.includes(s.id)?'- 保留旧':'- 新增'} ${s.source} → 第 ${i+1} 页 \`${s.id}\`：${s.title}。`).join('\n')+'\n\n';
 }
 let content=preamble+'## 逐页教学脚本\n\n以下由 deck-data.js 与 presenter-notes.js 构建生成；修改源数据后重新构建，不手改副本。\n';
 const phases=[];
 let elapsed=0;
 for(const [index,slide] of model.slides.entries()){
  const note=notes[slide.id];
  content+=`\n### ${index+1}. ${slide.source} ${slide.title} · ${slide.minutes} 分钟\n`;
  content+=`- 阶段：${slide.phase}\n- 目标：${note.goal}\n- 学生动作／产出：${note.acceptance}\n`;
  content+=note.script.map(line=>'- 教师：'+line).join('\n')+'\n';
  content+='- 回答参考：'+note.acceptable.join('；')+'\n- 常见误区：'+note.misconception+'\n';
  const last=phases.at(-1);
  if(last?.name===slide.phase){last.minutes+=slide.minutes;last.end+=slide.minutes;}
  else phases.push({name:slide.phase,minutes:slide.minutes,start:elapsed,end:elapsed+slide.minutes});
  elapsed+=slide.minutes;
 }
 await writeFile(path,content);
 await writeFile(join(root,'source/120-minute-plan.json'),JSON.stringify({totalMinutes:elapsed,phases},null,2)+'\n');
}
