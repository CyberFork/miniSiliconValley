import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const load = async file => readFile(join(root, file), 'utf8');
const box = { window: {} };
vm.runInNewContext(await load('deck-data.js'), box);
const deck = box.window.MSV_MODULE_DECK;
assert.equal(deck.slides.length, 41, 'Minecraft module example should bring the deck to 41 slides');
const index = deck.slides.findIndex(slide => slide.id === 'ai-minecraft-modules');
assert.ok(index > 0, 'stable Minecraft slide id is registered');
assert.equal(deck.slides[index].source, 'AI-06');
assert.equal(deck.slides[index - 1].id, 'ai-06');
assert.deepEqual(Array.from(deck.slides.slice(index + 1), slide => slide.id), ['ai-07','ai-08','ai-09','ai-10','ai-11','ai-12','ai-13','ai-14','course-map','course-flow'], 'existing IDs after insertion remain unchanged');
const content = deck.slides[index].content;
const tabs = [...content.matchAll(/data-ai-key=["']minecraft["'][^>]*data-ai-value=["'](\d+)["']/g)].map(m => Number(m[1]));
const panels = [...content.matchAll(/data-ai-panel=["']minecraft["'][^>]*data-ai-is=["'](\d+)["']/g)].map(m => Number(m[1]));
assert.deepEqual(tabs, [...Array(12).keys()], 'Minecraft slide has exactly 12 ordered tabs');
assert.deepEqual(panels, [...Array(12).keys()], 'Minecraft slide has exactly 12 ordered panels');
const firstPanel = content.match(/<section[^>]*data-ai-is="0"[^>]*>/)[0];
assert.doesNotMatch(firstPanel, /\bhidden\b/, 'first panel is visible by default');
const images = [...content.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
assert.ok(images.length > 0, 'Minecraft slide includes local reference images');
for (const tag of images) {
  const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  const alt = tag.match(/\balt=["']([^"']+)["']/i)?.[1]?.trim();
  const source = tag.match(/\bdata-image-source=["']([^"']+)["']/i)?.[1]?.trim();
  assert.ok(src && !/^(?:https?:|data:|blob:)/i.test(src), `image must be local: ${tag}`);
  assert.ok(alt, `image must have alt text: ${tag}`);
  assert.ok(source, `image must record its source: ${tag}`);
  const file = resolve(root, src);
  const info = await stat(file);
  assert.ok(info.isFile() && info.size > 0, `image asset must be non-empty: ${src}`);
}
const panel = n => content.match(new RegExp(`<section[^>]*data-ai-is="${n}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? '';
const soundPanel = panel(5);
const audios = [...soundPanel.matchAll(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi)].map(m=>m[0]);
assert.equal(audios.length,3);
for (const [i,name] of ['hurt','cow','villager'].entries()) {
 const tag=audios[i];assert.match(tag,/\bcontrols\b/);assert.doesNotMatch(tag,/\bautoplay\b/);
 for(const ext of ['mp3','ogg']){const src=`assets/minecraft-modules/${name}.${ext}`;assert.ok(tag.includes(src));assert.ok((await stat(resolve(root,src))).size>0);}
}
for (const [n,file] of [[8,'world-map.png'],[9,'water-clutch.png']])assert.ok(panel(n).includes(`assets/minecraft-modules/${file}`));
for (const runtime of ['deck-runtime.js', 'presenter-runtime.js']) {
  const source = await load(runtime);
  assert.match(source, /MSVAiLessons\?\.wire/, `${runtime} uses the existing AI sync adapter`);
  assert.match(source, /state\.activity\.ai/, `${runtime} syncs AI activity state`);
}
assert.doesNotMatch(content, /教师提示|讲师备注|teacher-only|presenter-only/i, 'audience slide must not leak teacher notes');
console.log('verify-minecraft-architecture: PASS');
vm.runInNewContext(await load('ai-lessons.js'),box);
const {normalize,reduce}=box.window.MSVAiLessons;
for(let i=0;i<12;i++) assert.equal(reduce({},'minecraft',String(i)).minecraft,i);
assert.equal(normalize({minecraft:99}).minecraft,0);
assert.equal(normalize({minecraft:-1}).minecraft,0);
assert.equal(normalize({minecraft:3.2}).minecraft,0);
assert.equal(deck.slides.slice(25).reduce((n,s)=>n+s.minutes,0),120);
assert.equal(deck.slides.find(s=>s.id==='ai-13').minutes,27);
assert.deepEqual(Array.from(deck.slides.slice(25),s=>s.source),Array.from({length:14},(_,i)=>`AI-${String(i+1).padStart(2,'0')}`));

// Audio is local to the clicked window; new slide/tab stops previous playback.
for(const f of ['deck-runtime.js','presenter-runtime.js'])assert.match(await load(f),/MSVAiLessons\?\.stopMedia/);
const events=[{},{}],sample=events.map(e=>({currentTime:2,pauseCount:0,pause(){this.pauseCount++},addEventListener(k,fn){e[k]=fn}}));
const fake={querySelector:s=>s==='.ai-lesson'?{}:null,querySelectorAll:s=>s==='audio[data-mca-audio]'?sample:[]};
box.window.MSVAiLessons.wire(fake,{},()=>{});assert.ok(sample.every(a=>a.controls));events[0].play();assert.equal(sample[1].pauseCount,1);assert.equal(sample[1].currentTime,0);
box.window.MSVAiLessons.stopMedia(fake);assert.equal(sample[0].pauseCount,1);assert.equal(sample[0].currentTime,0);
box.window.MSVAiLessons.wire(fake,{},null);assert.ok(sample.every(a=>!a.controls));
console.log('verify-minecraft-media: PASS');
