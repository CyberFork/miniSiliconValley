export const MAP=Object.freeze({width:6,height:6,start:{x:0,y:0},exit:{x:5,y:5},walls:[{x:2,y:1},{x:2,y:2},{x:2,y:3}],clues:[{id:'A',x:1,y:0},{id:'B',x:4,y:2},{id:'C',x:3,y:5}]});
export function createGame({broken=false}={}){
 let position={...MAP.start},ids=[],message='从入口出发，寻找 A、B、C 三条不同线索。';
 const same=(a,b)=>a.x===b.x&&a.y===b.y;
 function canEnter(p){if(!Number.isInteger(p?.x)||!Number.isInteger(p?.y))return {ok:false,reason:'坐标无效'};if(p.x<0||p.y<0||p.x>=MAP.width||p.y>=MAP.height)return {ok:false,reason:'不能走出地图'};if(MAP.walls.some(wall=>same(wall,p)))return {ok:false,reason:'前面是墙'};return {ok:true,reason:'可以通过'};}
 function outcome(){const enough=broken?ids.length>=3:['A','B','C'].every(id=>ids.includes(id));return {won:same(position,MAP.exit)&&enough,reason:!same(position,MAP.exit)?'还没到出口':enough?'集齐线索，到达出口！':'线索还不够，请继续探索'};}
 function bagResult(ok){return {ok,reason:message,collectedIds:[...ids],count:ids.length};}
 function collect(id){if(!['A','B','C'].includes(id)){message='线索编号无效，背包未改变';return bagResult(false);}if(!broken&&ids.includes(id)){message='已经拥有 '+id+'，不能重复算';return bagResult(false);}ids.push(id);message='收下线索 '+id;return bagResult(true);}
 function move(direction){const delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];if(!delta)return {ok:false,position:{...position},reason:'方向无效'};const next={x:position.x+delta[0],y:position.y+delta[1]};const check=canEnter(next);if(!check.ok){message=check.reason;return {...check,position:{...position}};}position=next;message='现在位置 '+position.x+','+position.y;const clue=MAP.clues.find(c=>same(c,position));if(clue)collect(clue.id);if(same(position,MAP.exit))message=outcome().reason;return {ok:true,position:{...position},reason:message};}
 function reset(){position={...MAP.start};ids=[];message='已重置，从入口重新开始';}
 return {move,collect,canEnter,reset,snapshot:()=>({position:{...position},collectedIds:[...ids],count:ids.length,message,...outcome()})};
}
export function runChecks(broken){
 const g=createGame({broken});const results=[];
 g.move('right');results.push({name:'正常：到 A 后背包数量是 1',pass:g.snapshot().count===1});
 g.collect('A');g.collect('A');results.push({name:'重复 A：仍只有一条不同线索',pass:g.snapshot().count===1});
 const before=g.snapshot().count;g.collect('');results.push({name:'缺编号：拒绝且不改变背包',pass:g.snapshot().count===before});
 results.push({name:'墙、越界与缺坐标被拒绝',pass:!g.canEnter({x:2,y:1}).ok&&!g.canEnter({x:-1,y:0}).ok&&!g.canEnter({x:0}).ok});
 g.reset();g.collect('A');g.collect('A');g.collect('A');for(let i=0;i<5;i++)g.move('down');for(let i=0;i<5;i++)g.move('right');results.push({name:'重复线索不能凑数赢得游戏',pass:!g.snapshot().won});
 g.reset();['right','right','right','right','down','down','down','down','down','left','right','right'].forEach(d=>g.move(d));results.push({name:'完整路径：集齐 A/B/C 并到出口获胜',pass:g.snapshot().won});
 g.reset();results.push({name:'重置后位置、背包、胜利状态清空',pass:g.snapshot().position.x===0&&g.snapshot().count===0&&!g.snapshot().won});
 return results;
}
