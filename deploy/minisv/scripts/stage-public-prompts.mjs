#!/usr/bin/env node
// Run on a COPY of the current site before the existing bundle/deploy workflow.
// No database, application build, historical deck bytes or saved text are changed.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildPromptCenter} from '../../../prompts/build.mjs';
const [siteArg,release,sourceCommit]=process.argv.slice(2);
if(!siteArg||!release||!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw Error('Usage: stage-public-prompts.mjs COPIED_SITE RELEASE SOURCE_COMMIT');
const site=resolve(siteArg),repo=resolve(import.meta.dirname,'../../..');
const manifest=await buildPromptCenter(join(site,'prompts'));
const portal=join(repo,'deploy/minisv/site');
let home=await readFile(join(site,'index.html'),'utf8');
if(!home.includes('href="/prompts/"')){
 const marker='<a href="/parents/">家长入口</a>';
 if(!home.includes(marker))throw Error('Homepage changed: review navigation before staging');
 home=home.replace(marker,marker+'\n        <a href="/prompts/">提示词中心</a>');
}
home=home.replace(/\/ui-theme\.js\?v=[A-Za-z0-9._-]+/g,'/ui-theme.js?v=20260929-prompts-1');
await writeFile(join(site,'index.html'),home);
for(const file of ['ui-theme.js','courseware-current.js'])await writeFile(join(site,file),await readFile(join(portal,file)));
const chrome=await readFile(join(site,'courseware-current.js'));
await writeFile(join(site,'courseware-current-'+createHash('sha256').update(chrome).digest('hex').slice(0,16)+'.js'),chrome);
const sitemap=JSON.parse(await readFile(join(site,'sitemap.json'),'utf8'));
for(const route of ['/prompts/','/prompts/general/'])if(!sitemap.routes.includes(route))sitemap.routes.push(route);
await writeFile(join(site,'sitemap.json'),JSON.stringify(sitemap,null,2)+'\n');
let xml=await readFile(join(site,'sitemap.xml'),'utf8');
for(const route of ['/prompts/','/prompts/general/'])if(!xml.includes('https://minisv.vip'+route+'</loc>'))xml=xml.replace('</urlset>','  <url><loc>https://minisv.vip'+route+'</loc></url>\n</urlset>');
await writeFile(join(site,'sitemap.xml'),xml);
const metadata=JSON.parse(await readFile(join(site,'release.json'),'utf8'));
metadata.publicPromptCenter={...manifest,previousRelease:metadata.release,sourceCommit};
metadata.release=release;
metadata.builtAt=new Date().toISOString();
await writeFile(join(site,'release.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata.publicPromptCenter));
