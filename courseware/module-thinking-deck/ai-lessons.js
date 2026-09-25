(function(){
 'use strict';
 const changeCopy={"original":"当前主棍 v1：两格。所有子棍仍引用 v1。","proposed":"人类确认主棍 v2：三格。AI 识别背包、提示及道具交接用例需复查；子棍尚未同步，暂停相关执行。","synced":"AI 已形成子棍更新草稿与差异清单。等待人类验收，不自动当作批准。","approved":"人类已验收：相关子棍引用最新三格背包版本，继续执行开发任务。","warning":"不能跳步：先由人类提出并确认主棍变化，再由 AI 同步子棍，最后由人类验收。"};
 const limits={minecraft:11,derive:2,tab:1,level:2,field:5,module:5,pipeline:4,recap:2,bagCase:2};
 const questions=['背包最多装几件？第一个选项：两件。','满包遇到钥匙怎么办？第一个选项：拒收，原物品不变。','怎么才过关？第一个选项：到终点，而且带着钥匙。'];
 const decisions=['容量：两件','满包：拒收，保留原物品','过关：到终点＋有钥匙'];
 function normalize(value){
  const v=value||{},out={};for(const [key,max] of Object.entries(limits))out[key]=Number.isInteger(v[key])&&v[key]>=0&&v[key]<=max?v[key]:0;
  out.answers=Array.isArray(v.answers)?v.answers.filter(x=>['first','later'].includes(x)).slice(0,3):[];
  out.change=['original','proposed','synced','approved'].includes(v.change)?v.change:'original';
  out.changeWarning=v.changeWarning===true;
  out.bagSteps=Array.isArray(v.bagSteps)?v.bagSteps.filter(x=>['collect','discard'].includes(x)).slice(-20):[];
  return out;
 }
 function reduce(value,key,choice){
  const s=normalize(value);
  if(Object.hasOwn(limits,key)){s[key]=Number(choice);if(key==='bagCase')s.bagSteps=[];}
  if(key==='answer'&&['first','later'].includes(choice)&&s.answers.length<3)s.answers.push(choice);
  if(key==='dialogReset')s.answers=[];
  if(key==='change'){
   s.changeWarning=false;
   if(choice==='propose')s.change='proposed';
   if(choice==='sync'){if(['proposed','synced','approved'].includes(s.change))s.change='synced';else s.changeWarning=true;}
   if(choice==='approve'){if(s.change==='synced')s.change='approved';else s.changeWarning=true;}
  }
  if(key==='bag'){if(choice==='reset')s.bagSteps=[];else if(['collect','discard'].includes(choice))s.bagSteps.push(choice);}
  return normalize(s);
 }
 async function bagResult(s){
  // Share the actual car rules, never a second hand-written inventory implementation.
  const rules=await import('./route-game/state.mjs');let g=rules.createGameState();
  const pos=id=>rules.ITEMS.find(item=>item.id===id).position;
  if(s.bagCase===1)g=rules.stepGame(g,pos('key'));
  if(s.bagCase===2){g=rules.stepGame(g,pos('coin'));g=rules.stepGame(g,pos('tool'));}
  for(const action of s.bagSteps){
   const before=g;g=action==='collect'?rules.stepGame(g,pos('key')):rules.discardItem(g,'tool',pos('key'));
   g.demoFeedback=action==='collect'&&before.bag.includes('key')?'重复碰到钥匙：已经拥有，背包不再增加。':action==='discard'&&!before.bag.includes('tool')?'没有工具可丢，背包清单不变。':g.message;
  }
  return g;
 }
 function stopMedia(root){root.querySelectorAll("audio[data-mca-audio]").forEach(audio=>{audio.pause();audio.currentTime=0;});}
 function wire(root,value,onChange){
  if(!root.querySelector('.ai-lesson'))return;
  const s=normalize(value);
  const audios=root.querySelectorAll('audio[data-mca-audio]');
  audios.forEach(audio=>{
   audio.controls=!!onChange;
   audio.addEventListener('play',()=>{audios.forEach(other=>{if(other!==audio){other.pause();other.currentTime=0;}});});
   audio.addEventListener('keydown',event=>event.stopPropagation());
  });
  root.querySelectorAll('[data-ai-panel]').forEach(el=>{el.hidden=String(s[el.dataset.aiPanel])!==el.dataset.aiIs;});
  root.querySelectorAll('[data-ai-key]').forEach(button=>{
   const {aiKey:key,aiValue:choice}=button.dataset;
   if(Object.hasOwn(limits,key))button.setAttribute('aria-pressed',String(String(s[key])===choice));
   button.disabled=!onChange||(key==='answer'&&s.answers.length>=3);
   button.addEventListener('keydown',event=>event.stopPropagation());
   if(onChange)button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();onChange(reduce(s,key,choice),key,choice);});
  });
  const scene=root.querySelector('[data-module-3d="car-modules"]');
  if(scene&&root.querySelector('[data-ai-key="module"]'))scene.setAttribute('data-module-3d-mode',['focus-move','joined','focus-pickup','focus-bag','joined','focus-finish'][s.module]);
  const set=(selector,text)=>{const node=root.querySelector(selector);if(node)node.textContent=text;};
  set('[data-ai-question]',questions[s.answers.length]||'三问结束：先核对人类主棍，再让 AI 派生子棍草稿。待决定的阻塞项不能偷偷执行。');
  set('[data-ai-decisions]',s.answers.length?s.answers.map((v,i)=>`${i+1}. ${v==='first'?'已确认：'+decisions[i]:'待决定：'+questions[i].split('？')[0]}`).join('\n'):'还没有确认内容，不能把默认值当成你的决定。');
  const affected=s.change!=='original';root.querySelectorAll('[data-ai-affected]').forEach(node=>node.classList.toggle('ai-affected',affected&&node.dataset.aiAffected==='yes'));
  const changeState=s.changeWarning?'warning':s.change;
  const status=root.querySelector('[data-ai-change-status]');
  if(status){
   // Each interaction state has its own editable identity, never one shared label.
   status.dataset.msvRuntimeField='runtime.change.'+changeState;
   status.textContent=changeCopy[changeState];
  }
  root.querySelectorAll('[data-ai-pipe]').forEach(el=>el.classList.toggle('ai-active',Number(el.dataset.aiPipe)<=Math.min(3,s.pipeline)));
  if(root.querySelector('[data-ai-bag-slots]')){
   set('[data-ai-bag-status]','正在读取小车原有规则…');
   bagResult(s).then(g=>{
    const names={key:'钥匙',coin:'金币',tool:'工具'};
    set('[data-ai-bag-slots]',[0,1].map(i=>'【'+(names[g.bag[i]]||'空位')+'】').join('  '));
    set('[data-ai-bag-status]',(s.bagSteps.length?(g.demoFeedback||g.message):'请先预测，再按按钮试一次。')+' 当前：'+g.bag.length+'/2。');
   }).catch(()=>set('[data-ai-bag-status]','规则加载失败，请刷新重试；没有执行测试，不能宣称通过。'));
  }
 }
 window.MSVAiLessons={normalize,reduce,wire,stopMedia,bagResult,changeCopy};
})();
