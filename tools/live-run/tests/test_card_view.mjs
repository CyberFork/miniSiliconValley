import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox = { globalThis: {}, module: undefined };
vm.runInNewContext(fs.readFileSync(new URL('../static/card-view.js', import.meta.url), 'utf8'), sandbox);
const view = sandbox.globalThis.MsvCardView;

test('shared card renderer normalizes labels and escapes HTML', () => {
  const html = view.renderLearnerCard({
    id: 'e08-c-05', boundary: 'F', title: 'C-05 · <创始成员>',
    body: '历史事实：<script>alert(1)</script>', sharePrompt: '说 & “事实”', sourceIds: ['src-eleme-sjtu-youth-origin']
  });
  assert.match(html, />&lt;创始成员&gt;<\/b>/);
  assert.doesNotMatch(html, /C-05/);
  assert.match(html, /来源编号：src-eleme-sjtu-youth-origin/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('R card is visibly simulation, not history', () => {
  const html = view.renderLearnerCard({ id: 'e08-r-04', boundary: 'R', title: 'R-04 · 多张订单', body: '课堂模拟：不是史实', sharePrompt: '继续' });
  assert.match(html, /R 课堂模拟/);
  assert.match(html, /不是史实/);
  assert.match(html, /data-boundary="R"/);
});
