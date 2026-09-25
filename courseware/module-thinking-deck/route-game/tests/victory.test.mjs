import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('victory pauses once, can dismiss locally, and re-arms for a new game',()=>{
 const dialog={open:false,shows:0,showModal(){this.open=true;this.shows++;},close(){this.open=false;}},restart={},canvas={focus(){}};let stopped=0;
 const context=vm.createContext({game:{won:false},victoryAcknowledged:false,owner:true,ready:true,active:true,$:id=>({'victory':dialog,'victory-restart':restart,'canvas':canvas}[id]),stop:()=>stopped++});
 vm.runInContext(source.slice(source.indexOf('function renderVictory(){'),source.indexOf('function renderGame(){')),context);
 vm.runInContext(source.slice(source.indexOf('function dismissVictory(){'),source.indexOf("$('victory-continue').onclick")),context);
 context.renderVictory();assert(!dialog.open);context.game.won=true;context.renderVictory();assert(dialog.open);assert.equal(stopped,1);context.renderVictory();assert.equal(dialog.shows,1);
 context.dismissVictory();assert(!dialog.open);context.renderVictory();assert(!dialog.open,'do not reopen on each snapshot');context.game.won=false;context.renderVictory();context.game.won=true;context.owner=false;context.renderVictory();assert(dialog.open);assert(!restart.disabled,'audience can request control and restart');
 assert.match(source,/!\$\('victory'\)\.open/);assert.match(html,/<dialog id="victory" aria-labelledby="victory-title"/);assert.match(html,/继续自由试驾/);assert.match(html,/id="victory-restart"/);
});
