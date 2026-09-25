import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('KSP resource stays teacher-only, explicitly opens externally, never auto-embeds',async()=>{
 const teacher=await readFile(new URL('teacher/presenter.html',root),'utf8');
 const audience=await readFile(new URL('audience/index.html',root),'utf8');
 const links=[...teacher.matchAll(/<a\b[^>]*href="https:\/\/www\.youtube\.com\/watch\?v=IQiFRmZ4mN4"[^>]*>/g)].map(m=>m[0]);
 assert.equal(links.length,2);
 for(const link of links){assert.match(link,/target="_blank"/);assert.match(link,/rel="noopener noreferrer"/);}
 assert.match(teacher,/id="ksp-video"/);assert.match(teacher,/② 装小车.*③ 试驾/);
 assert.match(teacher,/视频不自动同步/);assert.match(teacher,/课前试播/);
 assert.doesNotMatch(teacher,/<iframe|<video|<script[^>]+src="https:\/\//);
 assert.doesNotMatch(audience,/IQiFRmZ4mN4|video-reference|ksp-video/);
});

test('Minecraft reference is placed before the hands-on script and also stays external',async()=>{
 const teacher=await readFile(new URL('teacher/presenter.html',root),'utf8');
 const audience=await readFile(new URL('audience/index.html',root),'utf8');
 const links=[...teacher.matchAll(/<a\b[^>]*href="https:\/\/www\.youtube\.com\/shorts\/NpJXhHFVtOY"[^>]*>/g)].map(m=>m[0]);
 assert.equal(links.length,2);
 for(const link of links){assert.match(link,/target="_blank"/);assert.match(link,/rel="noopener noreferrer"/);}
 assert.ok(teacher.indexOf('id="mc-video-title"')<teacher.indexOf('<ol>'));
 assert.match(teacher,/「① 搭方块」前/);assert.match(teacher,/PPT 内不嵌入、不自动播放/);
 assert.doesNotMatch(audience,/NpJXhHFVtOY/);
});
