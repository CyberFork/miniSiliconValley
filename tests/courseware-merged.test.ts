import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {isCoursewareLibraryVisible,isCoursewareCatalogListed,defaultCoursewareRefs,type CoursewareSummary} from '../app/lib/courseware-store';
const base={ownerProfileId:'system-courseware',contentKind:'static-bundle' as const,availability:'playable' as const,releasedRevision:20,releasedDigest:'digest'};
test('merged development course has one visible library entry without deleting historical P2',()=>{
 assert(isCoursewareLibraryVisible({...base,packageId:'cw-development-mentor-module-thinking'}));
 assert(!isCoursewareCatalogListed({...base,packageId:'cw-development-mentor-ligun'}));
 assert(isCoursewareLibraryVisible({...base,packageId:'cw-development-mentor-ligun'}),'historical authorization is unchanged');
 const items=[['P','product-mentor-foundations'],['D','development-mentor-ligun'],['D','development-mentor-module-thinking'],['M','market-mentor-user-system'],['O','operations']].map(([mentorRole,slug])=>({...base,packageId:'cw-'+slug,mentorRole,slug})) as CoursewareSummary[];
 assert.equal(defaultCoursewareRefs(items).find(x=>x.mentorRole==='D')?.slug,'development-mentor-module-thinking');
});
test('old fixed P2 entry lands at AI stage of combined course, not an invalid old slide',async()=>{
 let target='';const code=readFileSync('deploy/minisv/site/courseware-current.js','utf8');
 const context={URLSearchParams,location:{pathname:'/courseware/latest/p2/',search:'?session=class1&slideId=ligun-18&slide=17&step=2',replace:(url:string)=>target=url},fetch:async()=>({ok:true,json:async()=>({p2:{teacher:'/courseware/development-mentor-module-thinking/r23/teacher/presenter.html',merged:true,startSlide:'ai-01'}})})};
 vm.runInNewContext(code,context);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(target,'/courseware/development-mentor-module-thinking/r23/teacher/presenter.html?session=class1&slideId=ai-01');
});

test('permanent workbook entry resolves latest audience workbook and keeps template selection only',async()=>{
 let target='';
 const context={URLSearchParams,location:{pathname:'/courseware/latest/p1/workbook/',search:'?template=car-all-in-one&session=ignored',replace:(url:string)=>target=url},fetch:async()=>({ok:true,json:async()=>({p1:{teacher:'/courseware/development-mentor-module-thinking/r23/teacher/presenter.html'}})})};
 vm.runInNewContext(readFileSync('deploy/minisv/site/courseware-current.js','utf8'),context);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(target,'/courseware/development-mentor-module-thinking/r23/audience/ai-materials/workbook/index.html?template=car-all-in-one');
});
