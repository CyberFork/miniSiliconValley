import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('ai-materials/workbook/index.html', root), 'utf8');
class El { value=''; textContent=''; open=false; focused=false; selected=false; events={}; addEventListener(n,f){this.events[n]=f;} focus(){this.focused=true;} select(){this.selected=true;} click(){return this.events.click?.({});} }
const nodes=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El()]));
assert(nodes.planning&&nodes.copy&&nodes['preview-panel']&&nodes.preview&&nodes.status);
assert.match(html,/<textarea[^>]*id="preview"[^>]*readonly/i);
assert(!/references|reference-select|copy-reference|copy-skill|download|id="master"|id="map"/.test(html));
const prompt=fs.readFileSync(new URL('ai-materials/workbook/student-prompt.txt',root),'utf8').trim(); assert(prompt);
let copied='',denied=false,beforeUnload; const window={MSV_STUDENT_PROMPT:prompt};
const ctx={window,document:{getElementById:id=>nodes[id]},navigator:{clipboard:{writeText:async t=>{if(denied)throw Error('denied');copied=t;}}},addEventListener:(n,f)=>{if(n==='beforeunload')beforeUnload=f;},setTimeout:f=>f(),console};
const source=fs.readFileSync(new URL('ai-materials/workbook/workbook.js',root),'utf8');
assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML|outerHTML/.test(source)); vm.runInNewContext(source,ctx);
const marker='<img src=x onerror="globalThis.__pwned=1">'; nodes.planning.value=marker; nodes.planning.events.input();
assert.equal(nodes.preview.value,`${prompt}\n\n---\n\n我的游戏策划：\n${marker}\n`); assert.equal(window.__pwned,undefined); await nodes.copy.click(); assert.equal(copied,nodes.preview.value);
denied=true; await nodes.copy.click(); assert(nodes['preview-panel'].open&&nodes.preview.focused&&nodes.preview.selected); assert.equal(nodes.preview.value,copied); assert(nodes.status.textContent);
delete ctx.navigator.clipboard; await nodes.copy.click(); assert(nodes['preview-panel'].open&&nodes.preview.selected);
assert.equal(nodes.copy.disabled,false);
nodes.planning.value='   '; nodes.planning.events.input(); assert(nodes.preview.value.endsWith('\n')); assert(nodes.preview.value.includes('我还没有写好策划'));  let prevented=false; beforeUnload({preventDefault(){prevented=true;}}); assert.equal(prevented,false);
nodes.planning.value='想法'; nodes.planning.events.input(); beforeUnload({preventDefault(){prevented=true;}}); assert(prevented);
console.log('PASS workbook: canonical prompt, planning composition, safe text input, clipboard fallback, beforeunload, memory-only');

const failed={...ctx,window:{}}; vm.runInNewContext(source,failed); assert.equal(nodes.copy.disabled,true); assert.match(nodes.status.textContent,/未加载成功/);
