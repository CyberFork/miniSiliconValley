import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../loading.js', import.meta.url), 'utf8');
function setup() { const listeners={}; const nodes=[]; const doc={body:{appendChild:n=>nodes.push(n)},documentElement:{appendChild:n=>nodes.push(n)},createElement(tag){return {tagName:tag.toUpperCase(),style:{},children:[],appendChild(n){this.children.push(n)},setAttribute(k,v){this[k]=v}}},getElementById(){return null}}; let id=0; const ctx={document:doc,location:{origin:'http://x',reload(){id++}},setTimeout(fn){ctx.fn=fn;return 1},clearTimeout(){},addEventListener(k,fn){listeners[k]=fn}};ctx.window=ctx;vm.runInNewContext(source,ctx); return {ctx,doc,nodes,listeners,get reloads(){return id}}; }
test('progression and done',()=>{const x=setup(), l=x.ctx.MSVWorkshopLoading;l.set(2,'物理');assert.equal(x.nodes[0].children[2].value,2);l.done();assert.equal(x.nodes[0].hidden,true)});
test('timeout and retry preserve storage',()=>{const x=setup();x.ctx.MSVWorkshopLoading.set(1);x.ctx.fn();assert.match(x.nodes[0].children[0].textContent,/失败/);x.nodes[0].children.at(-1).onclick();assert.equal(x.reloads,1)});
test('ignores ethereum and catches script errors',()=>{const x=setup();x.listeners.error({message:'ethereum provider failed',filename:'chrome-extension://x'});assert.equal(x.nodes[0].children[0].textContent,'正在加载工坊 · 0 / 4');x.listeners.error({type:'error',target:{tagName:'SCRIPT',src:'/workshop/app.mjs'}});assert.match(x.nodes[0].children[0].textContent,/失败/)});
