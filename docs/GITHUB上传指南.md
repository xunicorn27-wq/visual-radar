# GitHub 上传指南

## 1. 上传前检查

确认项目中只有 `.env.example`，没有 `.env` 或 `.env.local`：

```bash
git status --ignored
find . -maxdepth 2 -name '.env*' -print
```

建议新仓库先设置为 **Private**。数据中包含编辑后的日报和来源信息，确认适合公开后再调整可见性。

## 2. 使用 GitHub 网页创建仓库

1. 登录 GitHub。
2. 点击 `New repository`。
3. 仓库名填写 `visual-radar`。
4. 选择 `Private`。
5. 不要勾选自动创建 README、`.gitignore` 或许可证，因为项目已经包含这些文件。

## 3. 本机首次上传

在 Visual Radar 目录执行：

```bash
git init
git branch -M main
git add .
git commit -m "Initial standalone Visual Radar"
git remote add origin https://github.com/你的账号/visual-radar.git
git push -u origin main
```

如果已经安装并登录 GitHub CLI，也可以执行：

```bash
git init
git add .
git commit -m "Initial standalone Visual Radar"
gh repo create visual-radar --private --source=. --remote=origin --push
```

## 4. GitHub Actions Secrets（当前不需要）

当前采用 Pages-only/Codex 模式。GitHub Actions 只测试、构建并发布仓库中的静态内容，不调用公网 Express 服务，也不运行 daily automation。

因此，当前 **不需要任何 GitHub Actions Secrets**。不要添加：

- `DEPLOYED_URL`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `WECOM_BOT_WEBHOOK`

只有未来恢复公网 Express daily automation，并完成新的安全评审、权限设计和 contract test 后，触发工作流才可能需要 `DEPLOYED_URL` 和 `CRON_SECRET`。OpenAI API Key 和企业微信 Webhook 仍应只保存在 Express 部署平台，不应交给 Pages 工作流。

GitHub 官方参考：[GitHub Actions Secrets](https://docs.github.com/en/actions/reference/security/secrets)、[安全使用 Actions](https://docs.github.com/en/actions/reference/security/secure-use)。

## 5. 后续更新

```bash
git add .
git commit -m "描述本次修改"
git push
```

上传前始终运行：

```bash
pnpm test
pnpm check
pnpm build:pages
```
