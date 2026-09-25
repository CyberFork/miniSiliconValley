// Isolated teaching animation: never changes the playable game's inventory.
export function sampleBagComparison(mode,elapsedMs){
 const wrong=mode==='wrong',t=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0);
 const ease=x=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
 const progress=wrong?ease((t-2000)/2000):0;
 const phase=t<1500?'approach':t<2000?'contact':t<4000?'decision':'result';
 return {carX:-3+2.5*ease(t/1500),keyProgress:progress,coinProgress:progress,phase,
  bag:wrong&&t>=4000?['key','tool']:['coin','tool'],
  message:t<2000?'背包已经是 🪙 金币＋🔧 工具；小车正在碰到 🔑 钥匙。':wrong?(t<4000?'故意错误：没有先检查空格，钥匙挤进来，金币被覆盖。':'错误结果：🔑 钥匙＋🔧 工具。🪙 金币不见了！正式游戏不会这样做。'):'正确结果：提示“背包已满”。🪙 金币＋🔧 工具不变，🔑 钥匙留在地上。'};
}
