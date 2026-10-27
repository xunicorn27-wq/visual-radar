// Isolated CLI browser, mocked read-only API. Never use a real admin secret here.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const staticBase = "http://127.0.0.1:3210/visual-radar/public-data/";
  const summaries = await (await page.request.get(staticBase + "issues/index.json")).json();
  const detail = await (await page.request.get(staticBase + `issues/${summaries[0].id}.json`)).json();
  const main = detail.issue.stories[0];
  detail.issue.metadata.selectionPolicy = "editorial-v2";
  detail.issue.featuredStoryIds = [main.item.id];
  main.relatedSources = [{ itemId: "related-example", title: "同事件的另一篇原文（测试）", sourceUrl: "https://example.com/related", source: "测试来源", issueId: "2026-10-21" }];
  const report = {
    issueId: detail.issue.id, canPublish: false,
    blockers: [{ code: "previous_event", message: "历史事件没有新增事实（模拟）", count: 1 }],
    warnings: [{ code: "missing_image", message: "部分条目缺图（模拟）", count: 2 }],
    evidence: { verified: 3, total: 4 }, missingImages: 2,
    scoreDistribution: { reference60to74: 1, candidate75to84: 2, high85plus: 0, below60: 1 },
    duplicates: [{ itemId: "current-test", otherItemId: "previous-test", otherIssueId: "2026-10-21", confidence: "possible" }],
    recommendations: [{ itemId: "current-test", title: "厂商案例（测试）", band: "普通参考", score: 74, storedScore: 96, reasons: ["方法证据笼统（模拟）"] }],
    sourceCoverage: { checkedAt: "2026-10-23T07:00:00Z", healthy: 2, attempted: 3, coreHealthy: 1, coreTotal: 2, appliesToIssue: false, scope: "仅本次实际检查来源，不代表全部配置来源" },
  };
  let denied = true, qualityReads = 0, mutations = 0;
  const errors = []; const onError = e => errors.push(e.message); page.on("pageerror", onError);
  const handler = async route => {
    const request = route.request();
    if (request.method() !== "GET") { mutations++; await route.abort(); return; }
    const name = new URL(request.url()).pathname;
    let body = {};
    if (name.endsWith("/quality")) {
      qualityReads++; assert(request.headers()["x-cron-secret"] === "qa-placeholder", "质量接口缺少测试鉴权");
      if (denied) { await route.fulfill({ status: 401, json: { error: "未授权（模拟）" } }); return; }
      body = report;
    } else if (name.endsWith("/issues")) body = summaries;
    else if (name.includes("/issues/")) body = detail;
    else if (name.endsWith("/items")) body = { items: [], failures: [], generatedAt: "2026-10-23T07:00:00Z" };
    else if (name.endsWith("/analysis")) body = { analyses: [], failures: [] };
    else if (name.endsWith("/sources")) body = { coverage: {}, sources: [], summary: { live: 0, planned: 0, total: 0 } };
    await route.fulfill({ status: 200, json: body });
  };
  await page.route("**/api/visual-radar/**", handler);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:3211/");
    await page.getByRole("heading", { name: "摄影推送", exact: true }).waitFor();
    await page.getByRole("button", { name: "打开管理区" }).click();
    const panel = page.getByRole("region", { name: "发布前质量清单" });
    const read = panel.getByRole("button", { name: "检查本期质量" });
    assert(await read.isDisabled() && qualityReads === 0, "无权限时触发了读取");
    await page.getByPlaceholder("输入管理密钥").fill("qa-placeholder");
    await read.click(); await panel.getByRole("alert").waitFor();
    denied = false; await read.click();
    await panel.getByText("历史事件没有新增事实（模拟）", { exact: false }).waitFor();
    await panel.getByText("部分条目缺图（模拟）", { exact: false }).waitFor();
    await panel.getByText("查看重复关系", { exact: true }).click();
    await panel.getByText("查看推荐分层与原因", { exact: true }).click();
    await panel.getByText("方法证据笼统（模拟）", { exact: false }).waitFor();
    await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: "output/playwright/quality-desktop.png" });
    assert(await page.locator(".vr-featured-label").count() === 1, "前端自动补满了新策略精选");
    await page.getByText("同一事件的其他原文（1）", { exact: true }).click();
    assert(await page.getByRole("link", { name: "同事件的另一篇原文（测试）", exact: false }).getAttribute("href") === "https://example.com/related", "相关原文未保留");
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "手机布局溢出");
    await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: "output/playwright/quality-mobile.png" });
    await page.getByPlaceholder("输入管理密钥").fill("");
    await panel.getByText("历史事件没有新增事实（模拟）", { exact: false }).waitFor({ state: "hidden" });
    assert(await read.isDisabled(), "清除权限后仍可读取");
    assert(qualityReads === 2 && mutations === 0 && errors.length === 0, "请求边界或脚本异常");
    return { passed: true, qualityReads, mutations, checks: ["鉴权", "失败重试", "阻塞和提醒", "评分原因", "原文链接", "不补满精选", "手机布局", "清除密钥隐藏报告"] };
  } finally { await page.unroute("**/api/visual-radar/**", handler); page.off("pageerror", onError); }
}
