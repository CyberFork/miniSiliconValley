(() => {
  "use strict";
  const pageParams = new URLSearchParams(location.search);
  const capabilityParams = new URLSearchParams(location.hash.slice(1));
  const requested = pageParams.get("seat") || "";
  const hasClaimCapability = ["clientId", "lease"].every((key) => Boolean(capabilityParams.get(key)));
  const aliases = {W00: "mentor01", W01: "mentor02", W02: "mentor03", W03: "mentor04", W04: "learner01", W05: "learner02", W06: "learner03", W07: "learner04"};
  const seatId = aliases[requested] || requested;
  const app = document.getElementById("seatApp");
  const Preview = window.MsvCoursePreview;
  const CardView = window.MsvCardView;
  const EVIDENCE_BOUNDARY_GUIDE = "F 有来源｜R 课堂模拟｜G 我们猜的｜U 还不知道";
  if (!app) return;
  if (!Preview || !CardView) {
    document.title = "席位资源加载失败";
    app.innerHTML = '<article class="msv-seat-surface" data-preview="false"><section class="surface-card"><h2>席位资源加载失败</h2><p>页面资源没有完整到达。请刷新一次；如果仍失败，请返回 Alpha 席位台重新打开。</p></section></article>';
    return;
  }
  const cleanCardTitle = CardView.cleanCardTitle;

  function stateUrl() {
    return new URL(`api/state?${new URLSearchParams({seat: seatId})}`, new URL(".", location.href));
  }
  function stateHeaders() {
    return {"X-MSV-Client-ID": capabilityParams.get("clientId") || "", "X-MSV-Seat-Lease": capabilityParams.get("lease") || ""};
  }
  function render(data) {
    const model = Preview.runtimeSeatView(data, seatId);
    if (model.kind === "learner") model.boundaryGuide = EVIDENCE_BOUNDARY_GUIDE;
    if (model.kind === "learner") model.cards = (model.cards || []).map((card) => ({...card, title: cleanCardTitle(card.title)}));
    document.title = `${model.window} · ${model.title}`;
    app.innerHTML = Preview.renderSeatSurface(model, {editable: false});
  }
  function renderError(error) {
    const prefix = /领取|失效|LEASE/u.test(error.message) ? "请返回测试席位控制台重新领取：" : "1 秒后自动重连：";
    app.innerHTML = `<article class="msv-seat-surface" data-preview="false"><section class="surface-card"><h2>席位暂不可用</h2><p>${CardView.escapeHtml(prefix + error.message)}</p></section></article>`;
  }
  async function refresh() {
    try {
      if (!hasClaimCapability) throw new Error("领取凭证缺失或不完整。");
      const response = await fetch(stateUrl(), {cache: "no-store", headers: stateHeaders()});
      const envelope = await response.json();
      if (!response.ok || !envelope.ok) throw new Error(envelope.error?.message || String(response.status));
      render(envelope.data);
    } catch (error) {
      renderError(error);
    }
  }
  refresh();
  setInterval(refresh, 900);
})();
