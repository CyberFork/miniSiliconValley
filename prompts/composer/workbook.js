(function(){
 'use strict';
 const $=id=>document.getElementById(id),modules=window.MSV_PROMPT_MODULES;
 const input=$('planning'),output=$('preview'),button=$('copy'),status=$('status'),game=$('use-game'),paths=$('use-paths');
 const terminal=$('copy-terminal'),download=$('download'),actions=[button,terminal,download];
 let generation=0,copyRequest=0;
 const normalize=text=>text.replace(/\r\n?/g,'\n').trimEnd();
 function fail(){for(const action of actions)action.disabled=true;game.disabled=true;paths.disabled=true;output.value='';status.textContent='提示词未加载完整，请刷新后再试。输入的项目说明仍在本页，尚未复制。';}
 if(!window.MSV_PROMPT_COMPOSER?.toTerminalText||!modules){fail();return;}
 const query=new URLSearchParams(window.location.search);
 game.checked=query.get('game')==='0'?false:query.get('game')==='1'?true:!window.location.pathname.startsWith('/prompts/general');
 paths.checked=query.get('paths')==='1';
 function update(){
  generation++;
  try{
   const prompt=window.MSV_PROMPT_COMPOSER.compose(modules,{game:game.checked,paths:paths.checked});
   output.value=normalize(prompt.trim()+'\n\n---\n\n'+(game.checked?'我的游戏策划：':'我的项目说明：')+'\n'+(input.value.trim()||(game.checked?'我还没有写好策划，请先问我一个问题，帮我说清游戏想法。':'我还没有写好方案，请先问我一个问题，帮我说清项目想法。')));
   $('selection-summary').textContent='当前组合：立棍底座'+(game.checked?'＋游戏领域':'（通用项目）')+(paths.checked?'＋路径对齐':'');
   $('outcome-title').textContent='最后拿到：'+(game.checked?'基于立棍方法的开发文档':'基于立棍方法的项目实施文档');
   for(const action of actions)action.disabled=false;return true;
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
 async function copy(mode){
  if(!update())return;
  const text=mode==='terminal'?window.MSV_PROMPT_COMPOSER.toTerminalText(output.value):output.value,version=generation,request=++copyRequest;
  try{
   if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
   await navigator.clipboard.writeText(text);
   if(request!==copyRequest)return;
   status.textContent=version===generation?(mode==='terminal'?'已复制终端单行版！粘贴到 AI 输入框，检查完整后再按回车。':'已复制！到你使用的 AI 中粘贴发送，跟着回答问题即可。'):'复制期间内容已改变，请重新复制当前组合。';
  }catch{
   if(request!==copyRequest)return;
   if(version!==generation){status.textContent='复制期间内容已改变，请重新复制当前组合。';return;}
   output.value=text;$('preview-panel').open=true;output.focus();output.select();output.setSelectionRange?.(0,output.value.length);
   status.textContent=(mode==='terminal'?'终端单行版：':'')+'自动复制不可用，当前完整内容已展开并选中。请按复制快捷键，或长按文本框选择“全选 → 复制”。';
  }
 }
 button.addEventListener('click',()=>copy('normal'));
 terminal.addEventListener('click',()=>copy('terminal'));
 download.addEventListener('click',()=>{
  if(!update())return;
  let url,link;
  try{
   url=URL.createObjectURL(new Blob([output.value],{type:'text/plain;charset=utf-8'}));
   link=document.createElement('a');link.href=url;link.download='ligun-prompt.txt';
   document.body.appendChild(link);link.click();
   status.textContent='已发起 TXT 下载，包含当前组合和项目说明。把文件放进项目文件夹，让 AI 读取 ligun-prompt.txt 并按文件开始问答。';
  }catch{
   $('preview-panel').open=true;output.focus();output.select();
   status.textContent='下载未成功，完整内容已展开。可复制到文本文件，保存为 ligun-prompt.txt。';
  }finally{
   link?.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
 });
 addEventListener('beforeunload',event=>{if(input.value.trim()){event.preventDefault();event.returnValue='';}});
 if(update()){game.disabled=false;paths.disabled=false;status.textContent='准备好了。复制后，到你使用的 AI 中粘贴发送。';}
})();
