import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const box={window:{}};
for(const name of ['deck-data.js','presenter-notes.js'])vm.runInNewContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),box);
const model=box.window.MSV_MODULE_DECK,slide=model.slides.find(s=>s.id==='module-my-check');
assert.match(slide.title,/钥匙.*背包满/);assert.doesNotMatch(slide.content,/线索 A|交入|预期列表|凑够三条/);
const cards=[...slide.content.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(x=>x[1]);assert.equal(cards.length,4);
const expected=[['空','空','钥匙','空'],['金币','工具','金币','工具'],['金币','工具','钥匙','工具'],['金币','工具','金币','钥匙']];
for(let i=0;i<4;i++){const slots=[...cards[i].matchAll(/class="bag-slot[^"]*">([^<]+)<\/span>/g)].map(x=>x[1]);assert.deepEqual(slots,expected[i]);assert.match(cards[i],new RegExp('0'+(i+1)+' '));}
assert.match(cards[1],/钥匙仍留在地上/);assert.match(cards[2],/错误示范/);assert.match(cards[2],/不自动替换/);assert.match(cards[3],/先重试满包.*再丢下工具/);
const notes=box.window.MSV_MODULE_PRESENTER_NOTES['module-my-check'];assert.match(JSON.stringify(notes),/不是游戏的正确行为/);assert.match(JSON.stringify(notes),/纸面摆卡不宣称程序测试通过/);
assert.equal(model.slides.length,41);assert.equal(model.slides.reduce((a,s)=>a+s.minutes,0),240);
console.log('HOW04_CONCRETE_BAG_PASS: normal/full/error/retest diagrams, bounded game rules and notes');
