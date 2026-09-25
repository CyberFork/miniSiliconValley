import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const preloadSource = fs.readFileSync(new URL('../../route-preload.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
const deck = fs.readFileSync(new URL('../../deck-runtime.js', import.meta.url), 'utf8');
const presenter = fs.readFileSync(new URL('../../presenter-runtime.js', import.meta.url), 'utf8');

function preloadHarness() {
  const listeners = {};
  const timers = [];
  const body = { children: [], append(node) { node.isConnected = true; this.children.push(node); } };
  const win = { location: { origin: 'https://course.test', href: 'https://course.test/deck/' }, document: { readyState: 'complete' },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    URL, console };
  win.window = win; win.posted = [];
  const context = vm.createContext({ window: win, location: win.location, document: win.document, URL, setTimeout: win.setTimeout, addEventListener: win.addEventListener.bind(win), console });
  vm.runInContext(preloadSource, context);
  function stage() {
    const frame = { dataset: { carGame: '' }, contentWindow: { messages:[], postMessage(data,origin) {this.messages.push({data,origin});} }, addEventListener(type, fn) { this.load = fn; }, setAttribute(k, v) { this[k] = v; } };
    return { dataset: {}, style: {}, setAttribute(k, v) { this[k] = v; }, querySelector(selector) { return selector==='[data-car-game]'?frame:null; }, remove() { this.removed = true; this.isConnected = false; }, frame };
  }
  let session='s1';return { win,body,timers,stage,listeners,setSession:s=>session=s,create:()=>win.MSVRoutePreload.create({container:body,makeStage:stage,getSession:()=>session,role:'teacher'}) };
}

test('preload schedules once, warms one hidden S06 iframe, and reuses it', () => {
  const h = preloadHarness(); const p = h.create(); p.schedule(); p.schedule(); assert.equal(h.timers.length, 1);
  h.timers[0].fn(); const first = p.inspect(); assert.equal(first.connected, true); assert.equal(first.session, 's1');
  const s = h.body.children[0]; assert.equal(s.dataset.routeResident, 'true'); assert.equal(s.dataset.gameSession, 's1'); assert.equal(s.style.visibility, 'hidden'); assert.equal(s.inert, true); assert.equal(s['aria-hidden'], 'true');
  p.select('other'); p.select('module-s06'); assert.equal(h.body.children[0], s); assert.match(s.frame.src, /route-game\/index\.html.*session=s1.*warm=1/);
});

test('preload checks message origin/source and session identity', () => {
 const h=preloadHarness(),p=h.create();p.schedule();h.timers[0].fn();
 const first=h.body.children[0],handler=h.listeners.message[0],data={type:'msv-route-loading',status:'ready'};
 handler({origin:'https://evil.test',source:first.frame.contentWindow,data});assert.equal(p.inspect().status,'loading');
 handler({origin:'https://course.test',source:{},data});assert.equal(p.inspect().status,'loading');
 handler({origin:'https://course.test',source:first.frame.contentWindow,data});assert.equal(p.inspect().status,'ready');
 p.select('module-s06');assert.equal(first.inert,false);assert.equal(first['aria-hidden'],'false');assert.equal(first.frame.contentWindow.messages.at(-1).data.active,true);
 p.select('module-s05');assert.equal(first.inert,true);assert.equal(first.frame.contentWindow.messages.at(-1).data.active,false);
 p.select('module-s06');assert.equal(h.body.children.length,1);assert.equal(p.inspect().active,true);
 h.setSession('s2');const second=p.select('module-s06');assert.equal(first.removed,true);assert.notEqual(first,second);assert.match(second.frame.src,/session=s2/);
 handler({origin:'https://course.test',source:first.frame.contentWindow,data});assert.equal(p.inspect().status,'loading');
});

test('route-game gates activity and RAF while warm/inactive', () => {
  assert.match(app, /params\.get\('warm'\)!=='1'/); assert.match(app, /!ready\|\|!active/); assert.match(app, /ready&&active/); assert.match(app, /frameRequest=requestAnimationFrame\(frame\)/);
  assert.match(deck, /gamePreload\?\.schedule\(\)/); assert.match(presenter, /gamePreload\?\.schedule\(\)/);
  assert.doesNotMatch(deck, /gamePreload\.select\([^)]*next/i); assert.doesNotMatch(presenter, /gamePreload\.select\([^)]*next/i);
});

test('loading UI preserves storage and exposes progress/failure/timeout/retry', () => {
  const source = fs.readFileSync(new URL('../loading.js', import.meta.url), 'utf8');
  for (const token of ['MSVRouteLoading', 'set(step,text)', 'done()', 'fail(message)', '60000', 'location.reload()', 'msv-route-loading']) assert.match(source, new RegExp(token.replace(/[().]/g, '\\$&')));
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

// Evaluate the classic loader with a stubbed import only; no real app is started.
test('loader actual stages, timeout and retry do not reset state',async()=>{
 const nodes=Object.fromEntries(['route-loading','loading-label','loading-progress','loading-retry','fallback'].map(id=>[id,{setAttribute(k,v){this[k]=v}}]));
 let timeout,reloads=0;const sent=[];const ctx={document:{getElementById:id=>nodes[id]},location:{origin:'https://course.test',reload(){reloads++}},parent:{postMessage:m=>sent.push(m)},console,setTimeout(fn,ms){assert.equal(ms,60000);timeout=fn;return 1},clearTimeout(){},loadApp:()=>Promise.resolve()};ctx.window=ctx;
 let source=fs.readFileSync(new URL('../loading.js',import.meta.url),'utf8').replace("import('./app.mjs')","loadApp()");
 vm.runInNewContext(source,ctx);assert.equal(nodes['loading-progress'].value,0);ctx.MSVRouteLoading.set(2,'create');assert.equal(nodes['loading-progress'].value,2);
 timeout();assert.equal(nodes['route-loading'].role,'alert');assert.equal(nodes['loading-retry'].hidden,false);nodes['loading-retry'].onclick();assert.equal(reloads,1);
 ctx.MSVRouteLoading.done();assert.equal(nodes['route-loading'].hidden,true);assert.equal(sent.at(-1).status,'ready');
});

test('S06 and AI-12 share one connected frame in either visit order',()=>{
 for(const order of [['module-s06','ai-12'],['ai-12','module-s06']]){
  const h=preloadHarness(),p=h.create();const first=p.select(order[0]),url=first.frame.src;
  assert.equal(p.select(order[1]),first);assert.equal(first.frame.src,url);assert.equal(h.body.children.length,1);
  p.select('module-s07');assert.equal(p.inspect().active,false);
  assert.equal(p.select(order[0]),first);assert.equal(p.inspect().active,true);assert.equal(h.body.children.length,1);
 }
});
