(function(){
  'use strict';
  const docs=window.MSV_PROMPT_TEMPLATES.map(item=>({...item}));
  const select=document.getElementById('template'),title=document.getElementById('title'),area=document.getElementById('text'),status=document.getElementById('status');
  let current=0,dirty=false;
  function choices(){select.replaceChildren();docs.forEach((doc,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=doc.title;select.append(option);});select.value=String(current);}
  function show(){title.value=docs[current].title;area.value=docs[current].text;status.textContent=docs[current].kind==='example'?'这是完整示例，请按自己的游戏修改；示例结果不是你的测试证据。':'请填写自己的内容。这里没有自动上传或保存。';}
  function capture(){docs[current].title=title.value;docs[current].text=area.value;}
  select.addEventListener('change',()=>{capture();current=Number(select.value);show();});
  [title,area].forEach(node=>node.addEventListener('input',()=>{capture();dirty=true;choices();status.textContent='已修改（尚未备份）；请复制或下载后再关闭。';}));
  document.getElementById('add').addEventListener('click',()=>{capture();const n=docs.filter(d=>d.id.startsWith('my-module-')).length+1;docs.push({id:'my-module-'+n,title:'我的模块子棍 '+n,filename:'my-module-'+n+'.md',text:docs.find(d=>d.id==='sub-rod').text,kind:'blank'});current=docs.length-1;dirty=true;choices();show();title.focus();title.select();});
  document.getElementById('copy').addEventListener('click',async()=>{capture();try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(area.value);status.textContent='已复制当前整份正文，可以粘贴到你的 AI。';}catch{area.focus();area.select();status.textContent='浏览器未允许自动复制，正文已选中；请按 Ctrl+C 或 ⌘C 手动复制。';}});
  function download(text,filename){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.getElementById('download').addEventListener('click',()=>{capture();download(area.value,docs[current].filename);status.textContent='已发起当前文档下载；请确认文件已保存。其他文档仍需备份。';});
  document.getElementById('download-all').addEventListener('click',()=>{capture();download(docs.map(d=>'<!-- '+d.title+' -->\n\n'+d.text).join('\n\n---\n\n'),'my-game-all-prompts.md');dirty=false;status.textContent='已发起全部文档下载；请确认文件已保存。';});
  document.getElementById('print').addEventListener('click',()=>{capture();document.getElementById('print-content').textContent=title.value+'\n\n'+area.value;window.print();});
  addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  choices();show();
})();
