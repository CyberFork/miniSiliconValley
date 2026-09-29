(function(root){
 'use strict';
 function compose(modules,options={}){
  const game=options.game!==false,paths=options.paths===true;
  for(const key of ['base','start',...(game?['game']:[]),...(paths?['paths']:[])]){
   if(typeof modules?.[key]!=='string'||!modules[key].trim())throw Error('Missing prompt module: '+key);
  }
  const title=game?'基于立棍方法的开发文档':'基于立棍方法的项目实施文档';
  const parts=[
   '请先读完下面整份提示词，再开始对话。通用立棍底座始终适用；领域补充与可选增强只是同一次对话的补充，不重复启动问答，不改变人的确认权、六项结构或只交付文档的边界。',
   modules.base.replaceAll('{{DOCUMENT_TITLE}}',title).replaceAll('{{DOCUMENT_KIND}}',game?'开发文档':'项目实施文档').trim(),
   ...(game?[modules.game.trim()]:[]),...(paths?[modules.paths.trim()]:[]),modules.start.trim()
  ];
  return parts.join('\n\n')+'\n';
 }
 root.MSV_PROMPT_COMPOSER={compose};
})(typeof window==='undefined'?globalThis:window);
