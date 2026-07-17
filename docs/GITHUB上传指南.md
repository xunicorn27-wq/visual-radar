# GitHub 上传指南

## 1. 创建 Public 空仓库

1. 登录 GitHub，点击 `New repository`。
2. 仓库名填写 `visual-radar`。
3. 选择 **Public**。GitHub Pages 公网访问和本指南都以 Public 仓库为准。
4. 不要勾选自动创建 README、`.gitignore` 或许可证，保持仓库为空。

Public 仓库会公开所有已提交内容，包括 `data/` 中的来源、分析和日报。上传前必须确认数据适合公开。

## 2. 上传前检查

确认项目中没有 `.env`、`.env.local`、API Key、企业微信 Webhook、真实 `CRON_SECRET`、Cookie 或会话文件：

```bash
git status --ignored
find . -maxdepth 2 \( -name '.env' -o -name '.env.local' \) -print
rg -n "OPENAI_API_KEY=.+|WECOM_BOT_WEBHOOK=.+|CRON_SECRET=.+" . \
  -g '!node_modules/**' -g '!dist/**' -g '!.env.example'
git diff --check
```

密钥扫描出现示例占位文本时要逐条人工确认；任何真实秘密都必须先删除并轮换，不能上传后再处理。

## 3. 首次 push

在 Visual Radar 目录执行：

```bash
git init
git branch -M main
git add .
git commit -m "Initial standalone Visual Radar"
git remote add origin https://github.com/visual-radar-owner/visual-radar.git
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

当前示例地址：

```text
https://visual-radar-owner.github.io/visual-radar/
```

Actions 成功后还要实际打开首页和当期详情页，例如：

```text
https://visual-radar-owner.github.io/visual-radar/issues/2026-07-16
```

## 5. GitHub Actions Secrets

当前 **不需要任何 GitHub Actions Secrets**。Pages workflow 只测试、构建并发布仓库中已经生成的静态内容，不运行采集、OpenAI 分析、daily automation 或企业微信发送。

不要添加 `DEPLOYED_URL`、`CRON_SECRET`、`OPENAI_API_KEY` 或 `WECOM_BOT_WEBHOOK`。Pages 发布本身不需要这些值。

## 6. 后续日报发布

本地完成 Codex 分析、`npm run agent:import`、日报生成和检查后，先运行：

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
