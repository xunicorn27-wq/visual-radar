// Dedicated Playwright CLI session only; synthetic notes, no personal browser data.
async (page) => {
  const base = "http://127.0.0.1:3210/visual-radar/";
  const key = "visual-radar:library:v1";
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const writes = [];
  const onRequest = (request) => { if (request.method() !== "GET") writes.push(request.url()); };
  page.on("pageerror", onError); page.on("request", onRequest);
  try {
    await page.goto(base + "issues");
    await page.getByRole("combobox", { name: "视觉方法" }).waitFor();
    const archive = await page.evaluate(async (url) => (await fetch(url)).json(), base + "public-data/archive.json");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("combobox", { name: "视觉方法" }).selectOption("工艺");
    await page.getByRole("checkbox", { name: "只看有原文证据" }).check();
    await page.getByRole("checkbox", { name: "只看精选" }).check();
    const expected = archive.stories.filter(s => s.verified && s.featured && s.visualMethods.includes("工艺"));
    await page.getByRole("status").filter({ hasText: `找到 ${expected.length} 条内容` }).waitFor();
    assert(await page.locator(".vr-creative-hint").count() > 0, "卡片缺少创作提示");
    const filterUrl = page.url();
    await page.reload();
    assert(await page.getByRole("combobox", { name: "视觉方法" }).inputValue() === "工艺", "刷新丢失方法筛选");
    await page.locator(".vr-archive-card-link").first().click();
    await page.getByRole("link", { name: "返回浏览结果" }).click();
    assert(page.url() === filterUrl, "阅读返回丢失组合筛选");
    await page.screenshot({ path: "output/playwright/library-filters-desktop.png" });

    const target = expected[0];
    const second = archive.stories.find(s => s.id !== target.id);
    const date = "2026-07-01T00:00:00.000Z";
    const seed = [
      { story: { ...target, title: "测试旧摘要", summary: "测试旧版本", revisionAt: date, verified: false }, saved: true, savedAt: date, updatedAt: date, note: "自动验收：本机备注" },
      { story: second, saved: false, savedAt: date, updatedAt: date, note: "自动验收：未收藏但保留的备注" },
    ];
    await page.evaluate(({ key, entries }) => {
      const old = JSON.parse(localStorage.getItem(key) || '{"entries":[]}');
      if (old.entries.some(e => !e.note.startsWith("自动验收："))) throw new Error("测试会话含非测试收藏，拒绝覆盖");
      localStorage.setItem(key, JSON.stringify({ version: 1, entries }));
    }, { key, entries: seed });
    await page.goto(base + "saved");
    await page.getByRole("heading", { name: target.title, exact: true }).waitFor();
    await page.getByText("文章信息已更新 · 个人备注保留").waitFor();
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    let stored = await read();
    const entry = stored.entries.find(e => e.story.id === target.id);
    assert(entry.savedAt === date && entry.updatedAt === date && entry.note === seed[0].note, "勘误修改了个人记录");
    await page.getByRole("searchbox", { name: "搜索收藏与备注" }).fill("不会命中的搜索");
    await page.getByRole("heading", { name: "暂时没有匹配内容" }).waitFor();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "备份全部收藏与备注", exact: true }).click();
    const download = await downloading;
    await download.saveAs("output/playwright/library-backup.json");
    await page.getByRole("button", { name: "清除筛选", exact: true }).first().click();
    await page.locator('input[type="file"]').setInputFiles("output/playwright/library-backup.json");
    const dialog = page.locator("dialog[open]");
    await dialog.getByText("新增 0 条 · 合并 2 条 · 备注冲突 0 条").waitFor();
    await dialog.getByRole("button", { name: "取消恢复" }).click();
    assert((await read()).entries.length === 2, "预览或取消修改了收藏");

    const backup = { format: "visual-radar-library", version: 1, entries: [
      { ...seed[0], note: "自动验收：来自备份的冲突备注" },
      { ...seed[1], story: { ...second, id: "qa-extra" }, saved: true, note: "自动验收：新增备注" },
    ] };
    const upload = () => page.locator('input[type="file"]').setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await upload();
    await dialog.getByText("新增 1 条 · 合并 1 条 · 备注冲突 1 条").waitFor();
    await dialog.getByRole("button", { name: "确认合并恢复" }).click();
    await dialog.waitFor({ state: "hidden" });
    stored = await read();
    assert(stored.entries.length === 3, "合并丢失或重复记录");
    assert(stored.entries.find(e => e.story.id === target.id).note === seed[0].note, "默认覆盖本机备注");
    assert(stored.entries.find(e => e.story.id === target.id).story.title === target.title, "旧备份回退了勘误");
    await upload();
    await dialog.getByText("新增 0 条 · 合并 2 条 · 备注冲突 1 条").waitFor();
    await dialog.getByRole("combobox", { name: "备注冲突处理" }).selectOption("backup");
    await dialog.getByRole("button", { name: "确认合并恢复" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert((await read()).entries.find(e => e.story.id === target.id).note === backup.entries[0].note, "显式恢复备注未生效");

    await page.locator('input[type="file"]').setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("broken") });
    await page.getByRole("alert").filter({ hasText: "文件不是有效 JSON" }).waitFor();
    assert((await read()).entries.length === 3, "坏文件损坏本机记录");
    await page.screenshot({ path: "output/playwright/library-saved-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    backup.entries[0].note = "自动验收：手机冲突备注，保留原本创作思路。\n".repeat(40);
    await upload();
    await dialog.waitFor();
    await dialog.locator("summary").first().click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "手机页面横向溢出");
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), "恢复弹窗横向溢出");
    await page.screenshot({ path: "output/playwright/library-restore-mobile.png" });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.screenshot({ path: "output/playwright/library-saved-mobile.png" });

    const archivePattern = "**/public-data/archive.json";
    await page.route(archivePattern, route => route.abort());
    await page.reload();
    await page.getByText("暂时无法检查文章更新，仍可查看本机收藏和导出备份。", { exact: false }).waitFor();
    await page.getByRole("heading", { name: target.title, exact: true }).waitFor();
    assert((await read()).entries.length === 3, "离线读取丢失收藏");
    await page.unroute(archivePattern);
    await page.getByRole("button", { name: "重试检查" }).click();
    await page.getByText("已检查文章更新；个人备注和收藏时间保留。").waitFor();
    assert(errors.length === 0, errors.join("\n"));
    assert(writes.length === 0, "验收产生了非只读网络请求");
    return { passed: true, checks: ["组合筛选与返回", "创作提示", "勘误保留个人数据", "全量备份不受筛选影响", "预览取消", "重复合并", "备注冲突两种策略", "旧版本防回退", "坏文件保护", "手机恢复弹窗", "离线收藏与重试"], screenshots: "output/playwright/" };
  } finally { page.off("pageerror", onError); page.off("request", onRequest); }
}
