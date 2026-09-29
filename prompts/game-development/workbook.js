(function(){
 'use strict';
 const $=id=>document.getElementById(id),prompt=window.MSV_STUDENT_PROMPT;
 const input=$('planning'),output=$('preview'),button=$('copy'),status=$('status');
 if(typeof prompt!=='string'||!prompt.trim()){
  button.disabled=true;status.textContent='提示词未加载成功，请刷新后再试。你的策划尚未复制。';return;
 }
 function update(){
  output.value=prompt.trim()+'\n\n---\n\n我的游戏策划：\n'+(input.value.trim()||'我还没有写好策划，请先问我一个问题，帮我说清游戏想法。')+'\n';
 }
 input.addEventListener('input',()=>{update();status.textContent='准备好了。复制后，到你使用的 AI 中粘贴发送。';});
 button.addEventListener('click',async()=>{
  update();
  try{
   if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
   await navigator.clipboard.writeText(output.value);
   status.textContent='已复制！到你使用的 AI 中粘贴发送，跟着回答问题即可。';
  }catch{
   $('preview-panel').open=true;output.focus();output.select();output.setSelectionRange?.(0,output.value.length);
   status.textContent='自动复制不可用，完整内容已展开并选中。请按复制快捷键，或长按文本框选择“全选 → 复制”。';
  }
 });
 addEventListener('beforeunload',event=>{if(input.value.trim()){event.preventDefault();event.returnValue='';}});
 update();button.disabled=false;status.textContent='准备好了。复制后，到你使用的 AI 中粘贴发送。';
})();
