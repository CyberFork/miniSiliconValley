#!/usr/bin/env node
// Update only the user-authorized r24 prompt-center overlay, never the locked deck.
import {resolve,join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {buildStudentWorkbook} from '../../../courseware/module-thinking-deck/scripts/prompt-packs.mjs';
const site=process.argv[2];if(!site)throw new Error('Usage: stage-student-workbook.mjs SITE_ROOT');
const repo=resolve(import.meta.dirname,'../../..');
const target=join(resolve(site),'courseware-maintenance/p1-workbook-r24');
const manifest=await buildStudentWorkbook(join(repo,'courseware/module-thinking-deck/ai-materials/workbook'),target);
manifest.revision=24;
manifest.reason='用户授权直接简化 r24 提示词中心：策划输入＋一次复制；AI 问答确认宏观主棍与微观子棍，交付开发文档，不开发游戏。';
await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
