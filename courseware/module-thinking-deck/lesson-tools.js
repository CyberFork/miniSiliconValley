(function(){
 'use strict';
 const model=window.MSV_MODULE_DECK;
 const teacher=Boolean(document.documentElement.dataset.audienceUrl);
 let selected=-1,remaining=0,running=false,lastTime=0;
 const resourceBase=new URL(teacher?document.documentElement.dataset.audienceUrl:'./index.html',location.href);
 function wireResources(container){container.querySelectorAll('[data-resource]').forEach(a=>{const paths={'ai-workbook':'ai-materials/workbook/index.html',workbook:'workbook/index.html',demo:'demo/index.html',materials:'printables/index.html'};a.href=new URL(paths[a.dataset.resource],resourceBase).href;});}
 // Shared tab behavior for teacher and audience; content remains editable HTML.
 function wireInterfaceCases(container,selected,onSelect){
  const tabs=[...container.querySelectorAll('[data-interface-case]')];
  if(!tabs.length)return;
  const active=tabs.some(tab=>tab.dataset.interfaceCase===selected)?selected:'move';
  tabs.forEach(tab=>{
   tab.setAttribute('aria-selected',String(tab.dataset.interfaceCase===active));
   tab.tabIndex=onSelect&&tab.dataset.interfaceCase===active?0:-1;
   if(!onSelect)return;
   tab.addEventListener('click',event=>{event.stopPropagation();onSelect(tab.dataset.interfaceCase);});
   tab.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const index=tabs.indexOf(tab);let next;
    if(event.key==='ArrowDown')next=(index+1)%tabs.length;
    else if(event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();event.stopPropagation();onSelect(tabs[next].dataset.interfaceCase);
   });
  });
  container.querySelectorAll('[data-interface-panel]').forEach(panel=>{panel.hidden=panel.dataset.interfacePanel!==active;});
 }
 function paintAssembly(container,mode){
  if(!container.querySelector('[data-assembly-mode]'))return;
  const scene=container.querySelector('[data-module-3d="car-modules"]');if(!scene)return;
  scene.setAttribute('data-module-3d-mode',mode);
  container.querySelectorAll('[data-assembly-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.assemblyMode===mode)));
  const feedback=container.querySelector('[data-assembly-feedback]');
  if(feedback)feedback.textContent=mode==='joined'?'按接口合作：位置 → 道具 → 背包清单 → 终点检查。黄色点演示交接，不代替实际测试。':'四个模块已分开：名字、职责不同，但都来自同一款小车游戏。';
 }
 function wireAssembly(container,mode,onSelect){
  paintAssembly(container,mode);
  if(onSelect)container.querySelectorAll('[data-assembly-mode]').forEach(button=>{
   button.addEventListener('click',()=>onSelect(button.dataset.assemblyMode));
   button.addEventListener('keydown',event=>event.stopPropagation());
  });
 }
 function paintBagDemo(container,state={}){
  const panel=container.querySelector('[data-bag-demo-panel]');if(!panel)return;
  panel.hidden=!state.open;
  const host=panel.querySelector('[data-module-3d]');host.dataset.bagDemoStart=String(state.startedAt||0);host.setAttribute('data-module-3d-mode',state.mode==='wrong'?'wrong':'correct');
  panel.querySelectorAll('[data-bag-demo-action]').forEach(button=>{const action=button.dataset.bagDemoAction;if(['wrong','correct'].includes(action))button.setAttribute('aria-pressed',String(action===state.mode));});
 }
 function wireBagDemo(container,state,onSelect){
  paintBagDemo(container,state);
  container.querySelectorAll('[data-bag-demo-action]').forEach(button=>{button.disabled=!onSelect;if(!onSelect)return;button.addEventListener('click',event=>{event.stopPropagation();onSelect(button.dataset.bagDemoAction);});button.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape')onSelect('close');});});
 }
 // A single shared module node connects to several player-visible functions.
 function paintGameMap(container,selected){
  container.querySelectorAll('[data-game-map]').forEach(map=>{
   const modules=[...map.querySelectorAll('[data-map-module]')],paths=[...map.querySelectorAll('[data-map-path]')];
   const links=path=>path.dataset.modules.split(' ');
   const choice=[...modules,...paths].find(button=>(button.dataset.mapModule?'module:':'path:')+(button.dataset.mapModule||button.dataset.mapPath)===selected);
   const kind=choice?.dataset.mapModule?'module':choice?'path':'all',key=choice?.dataset.mapModule||choice?.dataset.mapPath;
   modules.forEach(button=>{const active=kind==='all'||(kind==='module'?button.dataset.mapModule===key:links(choice).includes(button.dataset.mapModule));button.classList.toggle('map-related',active);button.classList.toggle('map-muted',!active);button.setAttribute('aria-pressed',String(button===choice));});
   paths.forEach(button=>{const active=kind==='all'||(kind==='path'?button.dataset.mapPath===key:links(button).includes(key));button.classList.toggle('map-related',active);button.classList.toggle('map-muted',!active);button.setAttribute('aria-pressed',String(button===choice));});
   map.querySelectorAll('[data-map-edge]').forEach(edge=>{const [module,path]=edge.dataset.mapEdge.split(':');edge.classList.toggle('map-edge-active',kind==='all'||(kind==='module'?module===key:path===key));});
  });
 }
 function wireGameMap(container,selected,onSelect){
  paintGameMap(container,selected);
  container.querySelectorAll('[data-map-module],[data-map-path],[data-map-reset]').forEach(button=>{
   button.disabled=!onSelect;
   if(!onSelect)return;
   button.addEventListener('click',event=>{event.stopPropagation();onSelect(button.hasAttribute('data-map-reset')?'all':(button.dataset.mapModule?'module:':'path:')+(button.dataset.mapModule||button.dataset.mapPath));});
   button.addEventListener('keydown',event=>event.stopPropagation());
  });
 }
 function paintWorkedExample(container,selected){
  const tabs=[...container.querySelectorAll('[data-worked-case]')];
  const active=tabs.some(tab=>tab.dataset.workedCase===selected)?selected:'route';
  container.querySelector('.worked-example')?.classList.toggle('worked-show-map',active==='route');
  tabs.forEach(tab=>{tab.setAttribute('aria-selected',String(tab.dataset.workedCase===active));tab.tabIndex=tab.dataset.workedCase===active?0:-1;});
  container.querySelectorAll('[data-worked-panel]').forEach(panel=>{panel.hidden=panel.dataset.workedPanel!==active;});
  const scene=container.querySelector('[data-module-3d="car-modules"]');
  if(tabs.length&&scene)scene.setAttribute('data-module-3d-mode',active==='route'?'joined':active==='check'?'bag-full':'focus-'+active);
 }
 function wireWorkedExample(container,selected,onSelect){
  paintWorkedExample(container,selected);
  const tabs=[...container.querySelectorAll('[data-worked-case]')];
  tabs.forEach(tab=>{
   if(!onSelect){tab.tabIndex=-1;return;}
   tab.addEventListener('click',event=>{event.stopPropagation();onSelect(tab.dataset.workedCase);});
   tab.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const index=tabs.indexOf(tab);let next;
    if(event.key==='ArrowDown')next=(index+1)%tabs.length;
    else if(event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();event.stopPropagation();onSelect(tabs[next].dataset.workedCase);
   });
  });
 }
 function paintTradeoffTransform(container,activity){
  const scene=container.querySelector('[data-module-3d="transform"]');if(!scene)return;
  scene.setAttribute('data-transform-start',String(activity.tradeoffStarted||0));
  scene.setAttribute('data-module-3d-mode',activity.tradeoffPlay?'plane':'car');
  const action=container.querySelector('[data-tradeoff-action]');
  if(action)action.textContent=activity.tradeoffPlay?'5 秒拆开 → 组合成汽车':'5 秒拆开 → 组合成飞机';
  const text=container.querySelector('[data-tradeoff-description]');
  if(text)text.textContent='先展开同一组组件（2 秒），再接成新对象（3 秒）。看轮组和透明件怎样换一个角色。';
 }
 // Reuse the actual WebGL host on same-slide state updates, not just its camera coordinates.
 function takeScenes(container,slideId){
  if(!container.querySelector(`[data-slide-id="${slideId}"]`))return [];
  return [...container.querySelectorAll('[data-module-3d][data-webgl-ready="true"]')].filter(node=>!node.dataset.sceneLeaving);
 }
 // data-module-3d maps to dataset['module-3d'], not dataset.module3d.
 // Compare the real attributes: otherwise undefined === undefined reuses a car
 // renderer for the conveyor/voxel/game tabs and their controls appear broken.
 function restoreScenes(container,scenes){
  for(const previous of scenes){
   const next=[...container.querySelectorAll('[data-module-3d]')].find(node=>node.getAttribute('data-module-3d')===previous.getAttribute('data-module-3d')&&!node.dataset.webglReady);
   if(!next){
    const incoming=container.querySelector('[data-module-3d]');
    if(incoming&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      previous.dataset.sceneLeaving='true';previous.setAttribute('aria-hidden','true');previous.inert=true;
      Object.assign(previous.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'5',pointerEvents:'none',transition:'opacity .4s ease',opacity:'1'});
      incoming.append(previous);requestAnimationFrame(()=>{previous.style.opacity='0';});setTimeout(()=>previous.remove(),450);
    }
    continue;
   }
   for(const attr of next.attributes)if(attr.name.startsWith('data-'))previous.setAttribute(attr.name,attr.value);
   next.replaceWith(previous);
  }
 }
 function paintRelation(container,activity){
  const scene=container.querySelector('[data-car-functions]');if(!scene)return;
  const view=activity.relationView||'product',action=activity.carAction||'drive';
  scene.setAttribute('data-module-3d-mode','car:'+(view==='product'?'object':view==='modules'?'components':action));
  container.querySelectorAll('[data-relation-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.relationView===view)));
  container.querySelectorAll('[data-car-action]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.carAction===action)));
  container.querySelector('[data-car-actions]').hidden=view!=='functions';
  const captions={product:'产品：模块接起来，形成一辆完整的小车。',modules:'模块：轮组、车架、方向盘与座椅渐渐分开，各自承担不同责任。',drive:'道路移动：推进与轮组配合，车架连接并承载各部分。',jump:'飞跃坡道：前进速度＋坡道，产生短暂腾空；这是功能示意，不是飞机。',turn:'转向绕行：方向控制与轮组配合，改变小车前进路线。',river:'过桥渡河：同一辆车借助桥面通过河流；没有把小车变成船。'};
  container.querySelector('[data-relation-caption]').textContent=captions[view==='functions'?action:view];
 }
 function wireRelation(container,activity,onSelect){
  paintRelation(container,activity);
  for(const selector of ['data-relation-view','data-car-action'])container.querySelectorAll('['+selector+']').forEach(button=>{
   button.disabled=!onSelect;if(!onSelect)return;
   button.addEventListener('click',event=>{event.stopPropagation();onSelect(selector==='data-relation-view'?'relationView':'carAction',button.getAttribute(selector));});
   button.addEventListener('keydown',event=>event.stopPropagation());
  });
 }
 function drawTimer(){const output=document.getElementById('timer-value');if(output)output.textContent=Math.floor(remaining/60).toString().padStart(2,'0')+':'+(remaining%60).toString().padStart(2,'0');const button=document.getElementById('timer-toggle');if(button)button.textContent=running?'暂停计时':'开始／继续计时';}
 function update(index){const jump=document.getElementById('slide-jump');if(jump)jump.value=String(index);if(index!==selected){selected=index;remaining=(model.slides[index].minutes||0)*60;running=false;drawTimer();}}
 window.MSVLessonTools={paintBagDemo,wireBagDemo,paintGameMap,wireGameMap,wireResources,wireInterfaceCases,wireAssembly,paintAssembly,wireWorkedExample,paintWorkedExample,paintTradeoffTransform,takeScenes,restoreScenes,paintRelation,wireRelation,update};
 addEventListener('DOMContentLoaded',()=>{
  wireResources(document);
  document.querySelectorAll('[data-workshop-link]').forEach(link=>{const url=new URL(link.href);const session=new URLSearchParams(location.search).get('session');if(session)url.searchParams.set('session',session);link.href=url.href;});
  const jump=document.getElementById('slide-jump');if(jump){model.slides.forEach((slide,index)=>{const option=document.createElement('option');option.value=index;option.textContent=(index+1)+'. '+slide.title;jump.append(option);});jump.value=String(window.MSVModuleDeckController.getState().slide);jump.addEventListener('change',()=>window.MSVModuleDeckController.setState({slide:Number(jump.value),reveal:0}));}
  document.getElementById('timer-toggle')?.addEventListener('click',()=>{if(remaining<=0)return;running=!running;lastTime=Date.now();drawTimer();});
  document.getElementById('timer-reset')?.addEventListener('click',()=>{remaining=(model.slides[selected]?.minutes||0)*60;running=false;drawTimer();});
  drawTimer();
 });
 setInterval(()=>{if(!running)return;const now=Date.now(),seconds=Math.floor((now-lastTime)/1000);if(seconds<=0)return;remaining=Math.max(0,remaining-seconds);lastTime+=seconds*1000;if(!remaining)running=false;drawTimer();},250);
})();
