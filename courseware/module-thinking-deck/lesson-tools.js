(function(){
 'use strict';
 const model=window.MSV_MODULE_DECK;
 const teacher=Boolean(document.documentElement.dataset.audienceUrl);
 let selected=-1,remaining=0,running=false,lastTime=0;
 const resourceBase=new URL(teacher?document.documentElement.dataset.audienceUrl:'./index.html',location.href);
 function wireResources(container){container.querySelectorAll('[data-resource]').forEach(a=>{const paths={workbook:'workbook/index.html',demo:'demo/index.html',materials:'printables/index.html'};a.href=new URL(paths[a.dataset.resource],resourceBase).href;});}
 function drawTimer(){const output=document.getElementById('timer-value');if(output)output.textContent=Math.floor(remaining/60).toString().padStart(2,'0')+':'+(remaining%60).toString().padStart(2,'0');const button=document.getElementById('timer-toggle');if(button)button.textContent=running?'暂停计时':'开始／继续计时';}
 function update(index){const jump=document.getElementById('slide-jump');if(jump)jump.value=String(index);if(index!==selected){selected=index;remaining=(model.slides[index].minutes||0)*60;running=false;drawTimer();}}
 window.MSVLessonTools={wireResources,update};
 addEventListener('DOMContentLoaded',()=>{
  wireResources(document);
  const jump=document.getElementById('slide-jump');if(jump){model.slides.forEach((slide,index)=>{const option=document.createElement('option');option.value=index;option.textContent=(index+1)+'. '+slide.title;jump.append(option);});jump.value=String(window.MSVModuleDeckController.getState().slide);jump.addEventListener('change',()=>window.MSVModuleDeckController.setState({slide:Number(jump.value),reveal:0}));}
  document.getElementById('timer-toggle')?.addEventListener('click',()=>{if(remaining<=0)return;running=!running;lastTime=Date.now();drawTimer();});
  document.getElementById('timer-reset')?.addEventListener('click',()=>{remaining=(model.slides[selected]?.minutes||0)*60;running=false;drawTimer();});
  drawTimer();
 });
 setInterval(()=>{if(!running)return;const now=Date.now(),seconds=Math.floor((now-lastTime)/1000);if(seconds<=0)return;remaining=Math.max(0,remaining-seconds);lastTime+=seconds*1000;if(!remaining)running=false;drawTimer();},250);
})();
