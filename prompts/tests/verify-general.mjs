import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {loadPromptModules} from '../build.mjs';
const modules=await loadPromptModules(),ctx={window:{}};
vm.runInNewContext(await readFile(new URL('../composer/compose.js',import.meta.url),'utf8'),ctx);
const text=ctx.window.MSV_PROMPT_COMPOSER.compose(modules,{game:false,paths:false});
const baseline=await readFile(new URL('../general-project/student-prompt.txt',import.meta.url),'utf8');
// The generic core is lossless apart from its explicit document-title parameters.
const renderedBase=modules.base.replaceAll('{{DOCUMENT_TITLE}}','基于立棍方法的项目实施文档').replaceAll('{{DOCUMENT_KIND}}','项目实施文档');
assert.equal(renderedBase.trim()+'\n\n'+modules.start.trim(),baseline.trim());
for(const word of ['Minecraft','玩家','玩法','2D','3D'])assert(!text.includes(word),word);
for(const marker of ['主棍：已明确 n/6 项','子棍：正在核对第 n 个模块，共 m 个（n/m）','同一个 Markdown 代码框','不默认一定要做网站、APP 或软件','完整文档交付后就停止'])assert(text.includes(marker),marker);
console.log('PASS generic base retains previous full content, domain isolation and original confirmation/document contract');
