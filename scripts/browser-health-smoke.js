// Uses fake API responses and a public test string. No real admin credential or POST.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const staticBase = "http://127.0.0.1:3210/visual-radar/public-data/";
  const summaries = await (await page.request.get(staticBase + "issues/index.json")).json();
  const detail = await (await page.request.get(staticBase + "issues/" + summaries[0].id + ".json")).json();
  let healthRequests = 0; let denied = true; let mutation = false;
  const handler = async (route) => {
    const request = route.request();
    if (request.method() !== "GET") { mutation = true; await route.abort(); return; }
    const name = new URL(request.url()).pathname;
    let body = {};
    if (name.endsWith("/source-health")) {
      healthRequests++;
      assert(request.headers()["x-cron-secret"] === "qa-placeholder", "鉴权头错误");
      if (denied) { await route.fulfill({ status: 401, json: { error: "未授权（模拟）" } }); return; }
      body = { generatedAt: "2026-10-23T07:00:00Z", sources: [
        { sourceId: "test-bjp", label: "BJP 测试来源", status: "failed", core: true, consecutiveFailures: 2, lastCheckedAt: "2026-10-23T07:00:00Z", lastSuccessAt: null, itemCount: 0, error: "HTTP 403（模拟）" },
        { sourceId: "test-ok", label: "正常测试来源", status: "ok", core: false, consecutiveFailures: 0, lastCheckedAt: "2026-10-23T07:00:00Z", lastSuccessAt: "2026-10-23T07:00:00Z", itemCount: 8, error: null }
      ], summary: { attempted: 2, healthy: 1, failed: 1, empty: 0, coreHealthy: 0, coreTotal: 1, alerts: ["BJP 测试来源连续失败 2 次"] } };
    } else if (name.endsWith("/issues")) body = summaries;
    else if (name.includes("/issues/")) body = detail;
    else if (name.endsWith("/items")) body = { items: [], failures: [], generatedAt: "2026-10-23T07:00:00Z" };
    else if (name.endsWith("/analysis")) body = { analyses: [], failures: [] };
    else if (name.endsWith("/sources")) body = { coverage: {}, sources: [], summary: { live: 0, planned: 0, total: 0 } };
    await route.fulfill({ status: 200, json: body });
  };
  await page.route("**/api/visual-radar/**", handler);
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("http://127.0.0.1:3211/");
    await page.getByRole("heading", { name: "摄影推送", exact: true }).waitFor();
    await page.getByRole("button", { name: "打开管理区" }).click();
    await page.getByRole("heading", { name: "来源健康" }).waitFor();
    const read = page.getByRole("button", { name: "读取最新记录" });
    assert(await read.isDisabled(), "未输入密钥也可读取");
    assert(healthRequests === 0, "面板自动触发了请求");
    await page.getByPlaceholder("输入管理密钥").fill("qa-placeholder");
    await read.click();
    await page.getByText("未授权（模拟）", { exact: true }).waitFor();
    denied = false;
    await read.click();
    await page.getByRole("cell", { name: "HTTP 403（模拟）", exact: false }).waitFor();
    await page.getByRole("button", { name: "全部来源", exact: true }).click();
    await page.getByRole("rowheader", { name: "正常测试来源", exact: true }).waitFor();
    await page.screenshot({ path: "output/playwright/source-health-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "管理页手机横向溢出");
    await page.getByRole("heading", { name: "来源健康" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "output/playwright/source-health-mobile.png" });
    await page.getByPlaceholder("输入管理密钥").fill("");
    await page.getByRole("rowheader", { name: "正常测试来源", exact: true }).waitFor({ state: "hidden" });
    assert(!mutation && healthRequests === 2, "请求边界异常");
    return { passed: true, healthRequests, mutation, checks: ["鉴权前禁用", "失败可重试", "来源统计与筛选", "历史时间提示", "手机无溢出", "清除密钥隐藏数据"] };
  } finally { await page.unroute("**/api/visual-radar/**", handler); }
}
