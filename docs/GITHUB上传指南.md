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

## 4. 配置 GitHub Actions Secrets

进入仓库：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`。

只需要添加：

| 名称 | 值 |
| --- | --- |
| `DEPLOYED_URL` | 已部署的公网地址，不要带结尾斜杠 |
| `CRON_SECRET` | 与部署服务环境变量完全一致的随机长字符串 |

OpenAI API Key 和企业微信 Webhook 建议只放在部署平台环境变量里，不必交给 GitHub Actions。GitHub 官方建议敏感值使用 Secrets，并使用最小权限：[GitHub Actions Secrets](https://docs.github.com/en/actions/reference/security/secrets)、[安全使用 Actions](https://docs.github.com/en/actions/reference/security/secure-use)。

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
pnpm build
```
