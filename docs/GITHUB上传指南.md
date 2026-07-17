# GitHub 上传指南

## 1. 创建 Public 空仓库

1. 登录 GitHub，点击 `New repository`。
2. 仓库名填写 `visual-radar`。
3. 选择 **Public**。GitHub Pages 公网访问和本指南都以 Public 仓库为准。
4. 不要勾选自动创建 README、`.gitignore` 或许可证，保持仓库为空。

Public 仓库会公开所有已提交内容。`data/visual_radar_issues.json` 和 Pages 的 `public-data/issues/*.json` 包含完整 issue 数据，包括来源 URL、原始 text、content hash、分析总分与 score breakdown、selection rationale、trend keywords，以及 skipped item IDs/原因，不只是页面当前显示的字段。上传前必须逐项确认这些数据适合公开。

## 2. 上传前检查

先执行 [安全检查清单](安全检查清单.md) 中完整的 `.env*` 查找和 secret pattern 扫描，再检查 Git 状态与 diff：

```bash
git status --ignored
git diff --check
```

扫描是辅助检查，不是绝对证明。所有命中和暂存内容都要人工确认；任何真实秘密都必须先删除并轮换，不能上传后再处理。

## 3. 首次 push

在 Visual Radar 目录执行：

```bash
git init
git branch -M main
git add .
git commit -m "Initial standalone Visual Radar"
git remote add origin https://github.com/YOUR-GITHUB-USER/visual-radar.git
git push -u origin main
```

如果已经安装并登录 GitHub CLI，也可以执行：

```bash
git init
git add .
git commit -m "Initial standalone Visual Radar"
gh repo create visual-radar --public --source=. --remote=origin --push
```

## 4. 启用 GitHub Pages

1. 打开仓库 `Settings` -> `Pages`。
2. 在 `Build and deployment` 中，将 `Source` 设为 **GitHub Actions**。
3. 打开仓库 `Actions`，等待 `Deploy Visual Radar Pages` 成功。
4. 从 Actions 部署结果或 `Settings` -> `Pages` 打开 Pages URL。

Pages 地址格式示例：

```text
https://YOUR-GITHUB-USER.github.io/visual-radar/
```

必须替换所有占位符，并以 GitHub Actions deployment 输出的 URL 为准。Actions 成功后还要实际打开首页和当期详情页，例如：

```text
https://YOUR-GITHUB-USER.github.io/visual-radar/issues/2026-07-16
```

未从 Actions 获得实际 URL、未替换占位符或未从手机验证时，不得发送企业微信。

## 5. GitHub Actions Secrets

当前 **不需要任何 GitHub Actions Secrets**。Pages workflow 只测试、构建并发布仓库中已经生成的静态内容，不运行采集、OpenAI 分析、daily automation 或企业微信发送。

不要添加 `DEPLOYED_URL`、`CRON_SECRET`、`OPENAI_API_KEY` 或 `WECOM_BOT_WEBHOOK`。Pages 发布本身不需要这些值。

## 6. 后续日报发布

本地完成 Codex 分析、`pnpm agent:import`、日报生成和检查后，先运行：

```bash
pnpm test
pnpm check
pnpm build
pnpm build:pages
```

然后检查并提交本期需要的 data 分析和 issues 文件：

```bash
git diff --check
git add data/visual_radar_analysis.json data/visual_radar_issues.json
git commit -m "Publish Visual Radar daily"
git push origin main
```

每次 push 到 `main` 都会触发 Pages 部署。等待 Actions 成功并验证公网详情页后，才能进入企业微信 dry-run 和人工确认发送步骤。
