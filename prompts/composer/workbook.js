(function(){
 'use strict';
 const $=id=>document.getElementById(id),modules=window.MSV_PROMPT_MODULES;
 const input=$('planning'),output=$('preview'),button=$('copy'),status=$('status'),game=$('use-game'),paths=$('use-paths');
 let generation=0,copyRequest=0;
 function fail(){button.disabled=true;game.disabled=true;paths.disabled=true;output.value='';status.textContent='提示词未加载完整，请刷新后再试。输入的项目说明仍在本页，尚未复制。';}
 if(!window.MSV_PROMPT_COMPOSER||!modules){fail();return;}
 const query=new URLSearchParams(window.location.search);
 game.checked=query.get('game')==='0'?false:query.get('game')==='1'?true:!window.location.pathname.startsWith('/prompts/general');
 paths.checked=query.get('paths')==='1';
 function update(){
  generation++;
  try{
   const prompt=window.MSV_PROMPT_COMPOSER.compose(modules,{game:game.checked,paths:paths.checked});
   output.value=prompt.trim()+'\n\n---\n\n'+(game.checked?'我的游戏策划：':'我的项目说明：')+'\n'+(input.value.trim()||(game.checked?'我还没有写好策划，请先问我一个问题，帮我说清游戏想法。':'我还没有写好方案，请先问我一个问题，帮我说清项目想法。'))+'\n';
   $('selection-summary').textContent='当前组合：立棍底座'+(game.checked?'＋游戏领域':'（通用项目）')+(paths.checked?'＋路径对齐':'');
   $('outcome-title').textContent='最后拿到：'+(game.checked?'基于立棍方法的开发文档':'基于立棍方法的项目实施文档');
   button.disabled=false;return true;
  }catch{fail();return false;}
 }
 input.addEventListener('input',()=>{if(update())status.textContent='内容已更新，复制后到你使用的 AI 中粘贴发送。';});
 for(const checkbox of [game,paths])checkbox.addEventListener('change',()=>{
  if(!update())return;
  // Only selection flags enter the URL; never project text or materials.
  const search=new URLSearchParams();if(!game.checked)search.set('game','0');if(paths.checked)search.set('paths','1');
  try{window.history.replaceState(null,'','/prompts/'+(search.size?'?'+search.toString():''));}catch{}
  status.textContent='组合已更新，输入内容已保留。请重新复制后交给 AI。';
 });
 button.addEventListener('click',async()=>{
  if(!update())return;
  const text=output.value,version=generation,request=++copyRequest;
  try{
   if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
   await navigator.clipboard.writeText(text);
   if(request!==copyRequest)return;
   status.textContent=version===generation?'已复制！到你使用的 AI 中粘贴发送，跟着回答问题即可。':'复制期间内容已改变，请重新复制当前组合。';
  }catch{
   if(request!==copyRequest)return;
   $('preview-panel').open=true;output.focus();output.select();output.setSelectionRange?.(0,output.value.length);
   status.textContent='自动复制不可用，当前完整内容已展开并选中。请按复制快捷键，或长按文本框选择“全选 → 复制”。';
  }
 });
 addEventListener('beforeunload',event=>{if(input.value.trim()){event.preventDefault();event.returnValue='';}});
 if(update()){game.disabled=false;paths.disabled=false;status.textContent='准备好了。复制后，到你使用的 AI 中粘贴发送。';}
})();
