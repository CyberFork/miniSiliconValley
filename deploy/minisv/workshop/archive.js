(() => {
  "use strict";

  const LEGACY_KEYS = [
    "msv.curriculumWorkshop.v1",
    "msv.curriculumWorkshop.v2",
    "msv.curriculumWorkshop.backup.v2",
    "msv.curriculumWorkshop.checkpoint.v2",
    "msv.workshop.confirmed-baseline.v1",
    "msv.workshop.confirmed-baseline.backup.v1",
    "msv.workshop.baseline.proposals.v1",
    "msv.workshop.baseline.decisions.v1",
    "msv.workshop.baseline.audit.v1",
    "msv.workshop.baseline.actor.v1",
  ];
  const grid = document.querySelector("[data-baseline-grid]");
  const baselineStatus = document.querySelector("[data-baseline-status]");
  const integrity = document.querySelector("[data-baseline-integrity]");
  const recordList = document.querySelector("[data-record-list]");
  const recordSummary = document.querySelector("[data-record-summary]");
  const exportButton = document.querySelector("[data-export-records]");

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const renderIntegrity = (rows) => {
    if (!integrity) return;
    integrity.replaceChildren();
    for (const [label, value] of rows) {
      const row = element("div");
      row.append(element("dt", "", label), element("dd", "", String(value)));
      integrity.append(row);
    }
  };

  async function loadBaseline() {
    if (!grid || !baselineStatus) return;
    try {
      const response = await fetch("confirmed-baseline.json", { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`baseline ${response.status}`);
      const snapshot = await response.json();
      if (snapshot?.snapshotVersion !== 1 || snapshot?.scope !== "public-redacted-summary" || snapshot?.source?.channel !== "released" || !Array.isArray(snapshot.courses)) {
        throw new Error("baseline schema mismatch");
      }
      grid.replaceChildren();
      for (const course of snapshot.courses) {
        const card = element("article", "baseline-card");
        card.append(element("small", "", `${course.status.toUpperCase()} · ${course.courseId}`));
        card.append(element("h3", "", course.title || course.courseId));
        card.append(element("code", "", `r${course.revision} · ${course.digest}`));
        card.append(element("p", "", `${course.blocks.length} 个 Block · ${course.deckSummary.length} 组卡牌摘要 · 不含私密运行数据`));
        const steps = element("div", "baseline-steps");
        for (const step of course.macroSteps) steps.append(element("span", "", step.name || step.id));
        card.append(steps);
        grid.append(card);
      }
      grid.setAttribute("aria-busy", "false");
      baselineStatus.textContent = `${snapshot.courses.length} 门 Released · 完整性通过`;
      renderIntegrity([
        ["快照版本", `v${snapshot.snapshotVersion}`],
        ["数据范围", snapshot.scope],
        ["来源通道", snapshot.source.channel],
        ["课程数量", snapshot.source.courseCount],
        ["聚合摘要", snapshot.source.aggregateDigest],
        ["快照摘要", snapshot.integrity?.digest || "未提供"],
      ]);
    } catch {
      grid.setAttribute("aria-busy", "false");
      grid.replaceChildren(element("p", "", "基线暂时无法读取。系统不会用旧浏览器记录冒充 Released 课程真值。"));
      baselineStatus.textContent = "读取失败 · 请稍后重试";
      renderIntegrity([["状态", "未通过读取与结构校验"]]);
    }
  }

  function readLegacyRecords() {
    const records = LEGACY_KEYS.map((key) => {
      try {
        const value = window.localStorage.getItem(key);
        return { key, present: value !== null, value, bytes: value === null ? 0 : new TextEncoder().encode(value).byteLength };
      } catch (error) {
        return { key, present: false, value: null, bytes: 0, error: error instanceof Error ? error.message : "浏览器拒绝读取" };
      }
    });
    if (recordList) {
      recordList.replaceChildren();
      for (const record of records) {
        const details = element("details", "record-item");
        const summary = element("summary");
        summary.append(element("b", "", record.key), element("span", "", record.error ? "无法读取" : record.present ? `${record.bytes.toLocaleString("zh-CN")} Bytes` : "本浏览器没有记录"));
        details.append(summary);
        if (record.error) details.append(element("p", "", record.error));
        else if (record.present) {
          const preview = record.value.length > 120000 ? `${record.value.slice(0, 120000)}\n\n……屏幕预览到此为止；导出文件仍包含完整原始值。` : record.value;
          details.append(element("pre", "", preview));
        } else details.append(element("p", "", "没有发现这个键。它可能保存在另一台设备、另一浏览器或已经被用户清理。"));
        recordList.append(details);
      }
    }
    const found = records.filter((record) => record.present).length;
    const bytes = records.reduce((total, record) => total + record.bytes, 0);
    if (recordSummary) {
      recordSummary.dataset.empty = String(found === 0);
      recordSummary.textContent = found
        ? `找到 ${found} / ${LEGACY_KEYS.length} 个键，共 ${bytes.toLocaleString("zh-CN")} Bytes。页面只读，刷新前后不会改写这些值。`
        : `当前浏览器没有找到旧 Workshop 记录。请到曾经实际使用工作坊的每个浏览器分别打开本页检查。`;
    }
    if (exportButton instanceof HTMLButtonElement) {
      exportButton.disabled = found === 0;
      exportButton.addEventListener("click", () => exportRecords(records));
    }
    return records;
  }

  function exportRecords(records) {
    const payload = {
      schemaVersion: 1,
      exportType: "minisv-workshop-browser-archive",
      exportedAt: new Date().toISOString(),
      origin: window.location.origin,
      readOnly: true,
      records: records.filter((record) => record.present).map((record) => ({ key: record.key, rawValue: record.value, bytes: record.bytes })),
      missingKeys: records.filter((record) => !record.present).map((record) => record.key),
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `minisv-workshop-browser-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  window.__MSV_WORKSHOP_ARCHIVE__ = Object.freeze({ mode: "read-only", keyCount: LEGACY_KEYS.length });
  void loadBaseline();
  readLegacyRecords();
})();
