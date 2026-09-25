import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
const code=fs.readFileSync('deploy/minisv/site/courseware-current.js','utf8');
function node(tag){return {tag,style:{},dataset:{},children:[],setAttribute(k,v){this[k]=v},append(...kids){this.children.push(...kids)},prepend(...kids){this.children.unshift(...kids)},querySelector(){return null},cloneNode(){const n=node(this.tag);Object.assign(n,this);return n}}}
async function run(path,record,search='',hostKind=null){
 const body=node('body');body.classList={contains:()=>false};body.style.gridTemplateRows='auto 1fr';const marker=node('main');if(hostKind)body.append(marker);const host=hostKind?node(hostKind):null;if(host)host.className=hostKind==='header'?'top':'session-panel';let replaced=null,fetches=0;const document={body,createElement:node,querySelector(sel){if(sel==='.session-panel'&&hostKind==='session')return host;if(sel==='header.top'&&hostKind==='header')return host;return null}};const ctx={URLSearchParams,document,location:{pathname:path,search,replace(v){replaced=v}},MutationObserver:class{observe(){}},fetch:async()=>{fetches++;return{ok:true,json:async()=>record}},navigator:{}};
 vm.runInNewContext(code,ctx);await new Promise(r=>setTimeout(r,0));return{body,host,replaced,fetches};
}
const record={p1:{teacher:'/courseware/development-mentor-module-thinking/r14/teacher/presenter.html',workshop:'/courseware/development-mentor-module-thinking/r14/teacher/workshop/'}};
let x=await run('/courseware/latest/p1/',record,'?session=test&slideId=abc&revision=12&digest=old');assert.equal(x.replaced,record.p1.teacher+'?session=test&slideId=abc');
x=await run('/courseware/latest/p1/workshop/',record,'?session=existing');assert.equal(x.replaced,record.p1.workshop+'teacher/presenter.html?session=existing');
x=await run('/courseware/latest/p1/',{p1:{teacher:'https://evil.test/'}});assert.equal(x.replaced,null);
x=await run('/courseware/development-mentor-module-thinking/r12/teacher/presenter.html',record,'?session=test');assert.equal(x.replaced,null);assert.equal(x.body.children[0].children[1].target,'_blank');assert.match(x.body.children[0].children[0].textContent,/旧版/);
x=await run('/courseware/development-mentor-module-thinking/r14/teacher/presenter.html',record);assert.equal(x.body.children[0].children[1].href,'/courseware/latest/p1/');
x=await run('/courseware/development-mentor-module-thinking/r12/teacher/workshop/teacher/presenter.html',record,'?session=existing');assert.equal(x.body.children[0].children[1].href,record.p1.workshop+'teacher/presenter.html?session=existing');
x=await run('/courseware/development-mentor-module-thinking/r14/teacher/presenter.html',record,'','session');assert.equal(x.body.children.length,1);assert.equal(x.host.children.at(-1).id,'msv-current-courseware');assert.equal(x.body.style.gridTemplateRows,'auto 1fr');assert.equal(x.host.children.at(-1).children[1].href,'/courseware/latest/p1/');
x=await run('/courseware/development-mentor-module-thinking/r14/teacher/workshop/teacher/presenter.html',record,'','header');assert.equal(x.body.children.length,1);assert.equal(x.host.children.at(-1).id,'msv-current-courseware');assert.equal(x.body.style.gridTemplateRows,'auto 1fr');
x=await run('/courseware/development-mentor-module-thinking/r14/teacher/presenter.html',record,'','unknown');assert.equal(x.body.children.length,2);assert.equal(x.body.children.at(-1).style.position,'fixed');assert.equal(x.body.style.gridTemplateRows,'auto 1fr');
x=await run('/courseware/development-mentor-module-thinking/r14/audience/index.html',record);assert.equal(x.fetches,0);
console.log('LATEST_UI_DYNAMIC_PASS: pointer, query isolation, old window preservation, workshop session, unknown URL rejection');
