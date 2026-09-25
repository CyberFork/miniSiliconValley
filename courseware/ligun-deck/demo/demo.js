import {MAP,createGame,runChecks,compareRepeatedClue} from './game.js';
const version=document.getElementById('version'),map=document.getElementById('map'),bag=document.getElementById('bag'),log=document.getElementById('log'),checks=document.getElementById('checks');
let game=createGame({broken:true});
function render(){const state=game.snapshot();map.replaceChildren();for(let y=0;y<6;y++)for(let x=0;x<6;x++){const cell=document.createElement('div');const clue=MAP.clues.find(c=>c.x===x&&c.y===y);cell.textContent=clue?.id||'';if(MAP.walls.some(w=>w.x===x&&w.y===y)){cell.className='wall';cell.textContent='墙';}if(x===5&&y===5){cell.className='exit';cell.textContent='出口';}if(state.position.x===x&&state.position.y===y){cell.className='player';cell.textContent='我';}cell.setAttribute('aria-label',x+','+y+' '+cell.textContent);map.append(cell);}bag.textContent='线索：'+(state.collectedIds.join('、')||'空')+' ｜ 数量 '+state.count;log.textContent=state.message+(state.won?' ✓ 已获胜':'');}
function move(d){game.move(d);render();}
document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>move(b.dataset.move)));
addEventListener('keydown',event=>{if(event.target.closest('select,input,textarea,button,a'))return;const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[event.key];if(d){event.preventDefault();move(d);}});
document.getElementById('reset').addEventListener('click',()=>{game.reset();render();});
version.addEventListener('change',()=>{game=createGame({broken:version.value==='broken'});checks.replaceChildren();render();});
document.getElementById('check').addEventListener('click',()=>{checks.replaceChildren();runChecks(version.value==='broken').forEach(result=>{const li=document.createElement('li');li.className=result.pass?'passed':'failed';li.textContent=(result.pass?'通过：':'未通过：')+result.name;checks.append(li);});});
render();

document.getElementById('replay-abb').addEventListener('click',()=>{const target=document.getElementById('replay-result');target.replaceChildren();for(const result of compareRepeatedClue()){const p=document.createElement('p');p.className=result.version==='首版'?'failed':'passed';p.textContent=result.version+'：输入 A、B、B → ['+result.ids.join(', ')+']，数量 '+result.count+'；到出口'+(result.wonAtExit?'错误判赢':'不赢，仍缺 C');target.append(p);}});
