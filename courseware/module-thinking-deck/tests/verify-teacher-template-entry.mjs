import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const presenter = fs.readFileSync(path.join(root, 'presenter.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'p1-scenes.css'), 'utf8');

const resources = presenter.match(/<section\b[^>]*class=["']teaching-resources["'][^>]*>[\s\S]*?<\/section>/i)?.[0];
assert.ok(resources, 'presenter.html must contain the teaching-resources section');

const template = resources.match(/<a\b[^>]*data-prompt-workbook-link[^>]*>[\s\S]*?<\/a>/i)?.[0];
assert.ok(template, 'template link must be inside .teaching-resources');
assert.match(template, /href=["']\.\.\/audience\/ai-materials\/workbook\/index\.html["']/i);
assert.match(template, /target=["']_blank["']/i);
assert.match(template, /rel=["'][^"']*\bnoopener\b[^"']*["']/i);
assert.match(template, /提示词/);
assert.match(template, /三合一/);

for (const href of [
  './workshop/teacher/presenter.html',
  'https://www.youtube.com/shorts/NpJXhHFVtOY',
  'https://www.youtube.com/watch?v=IQiFRmZ4mN4',
]) {
  assert.match(resources, new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), `existing entry missing: ${href}`);
}

const titleRule = css.match(/\.presenter-shell\s+\.teaching-resources\s*>\s*b\s*\{([^}]*)\}/i)?.[1];
assert.ok(titleRule, 'p1-scenes.css must style .presenter-shell .teaching-resources > b');
const color = titleRule.match(/(?:^|;)\s*color\s*:\s*([^;]+)\s*(?:;|$)/i)?.[1].trim();
assert.ok(color, 'teaching-resources title must declare an explicit foreground color');
assert.notEqual(color.toLowerCase(), '#fff');
assert.notEqual(color.toLowerCase(), '#ffffff');
assert.notEqual(color.toLowerCase(), 'white');

console.log('Teacher template entry contract: PASS');

// Published r22/r23 HTML lacks the entry: maintenance runtime must add it once.
const {default:vm}=await import('node:vm');
const runtime=fs.readFileSync(path.join(root,'presenter-runtime.js'),'utf8');
const install=runtime.slice(runtime.indexOf('  const teachingResources ='),runtime.indexOf('  const params ='));
for(const [page,audience,expected] of [
 ['https://minisv.vip/courseware/development-mentor-module-thinking/r23/teacher/presenter.html','../audience/index.html','https://minisv.vip/courseware/development-mentor-module-thinking/r23/audience/ai-materials/workbook/index.html'],
 ['http://localhost:18135/presenter.html','./index.html','http://localhost:18135/ai-materials/workbook/index.html']
]){
 let added=0,link;
 const section={querySelector:selector=>selector.startsWith('[data-')?link:null,insertBefore:node=>{added++;link=node;}};
 const sandbox={URL,location:{href:page},document:{querySelector:()=>section,documentElement:{dataset:{audienceUrl:audience}},createElement:()=>({dataset:{}})}};
 vm.runInNewContext(install,sandbox);vm.runInNewContext(install,{...sandbox});
 assert.equal(added,1);assert.equal(link.href,expected);assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener');
}
console.log('Published HTML fallback, duplicate prevention and local/deployed paths: PASS');
