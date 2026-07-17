# Visual Radar

Visual Radar 是一个独立的摄影、造型、服装搭配、时尚文化、展览、杂志、创作者和创作工具中文日报系统。

网页展示所有通过价值筛选并完成中文解读的内容；企业微信群只接收其中最多 10 条精选。当前交接数据包含 30 条成功解读和 2026-07-16 日报。

## 快速启动

要求：Node.js 22 或更高版本、pnpm 11。

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

- 网页：<http://localhost:3100>
- API：<http://localhost:3099>
- 往期：<http://localhost:3100/issues>

第一次使用管理区前，在 `.env.local` 设置随机的 `CRON_SECRET`，并在网页管理区输入同一个值。Codex Agent 模式不调用 OpenAI API，因此 `OPENAI_API_KEY` 可以保持为空。

## 当前半自动日报流程

1. 本地启动 Visual Radar，在管理区点击“采集最新”，检查采集结果。
2. 点击“Agent 解读”，生成 `data/visual_radar_agent_batch.json`。
3. 让 Codex 读取 Agent batch，并按 [Codex Agent 解读指南](docs/Codex-Agent解读指南.md) 将结果写入 `data/visual_radar_agent_output.json`。禁止直接修改 `data/visual_radar_analysis.json`。
4. 导入 Codex 输出：

   ```bash
   pnpm agent:import
   ```

5. 回到本地管理区点击“生成今日日报”，检查完整日报和顶部最多 10 条微信精选。
6. 发布前先验证：

   ```bash
   pnpm test
   pnpm check
   pnpm build
   pnpm build:pages
   ```

7. 检查 diff 和密钥扫描结果，只提交本期需要的 `data/visual_radar_analysis.json`、`data/visual_radar_issues.json` 及其他明确确认的改动，然后 push 到 `main`。
8. GitHub Actions 会自动构建并发布 GitHub Pages；等待 Actions 成功后，从手机打开公网详情页验证内容、图片和链接。
9. 运行 `pnpm wecom:preview -- 2026-07-16` 预览当期企业微信 Markdown。该命令固定使用单期 `dryRun=1`，不会发送；只有用户明确确认后，才能从本地管理区正式发送。

不要使用已删除的 daily workflow，也不要把 `pnpm daily` 作为当前 Codex + Pages 流程。Pages 只发布静态站点，不采集、不分析、不生成日报，也不发送企业微信。

## GitHub Pages

Pages 地址格式示例：

```text
https://YOUR-GITHUB-USER.github.io/visual-radar
```

必须把占位符替换为 GitHub Actions deployment 输出的实际 URL，并从手机验证后再写入本地 `.env.local`。未替换或未验证时不得发送企业微信。

GitHub Pages 工作流不需要 GitHub Actions Secrets。`OPENAI_API_KEY`、`WECOM_BOT_WEBHOOK` 和 `CRON_SECRET` 都不得加入 Pages workflow；Webhook 和管理密钥只保存在本地 `.env.local`。Public 仓库和 Pages JSON 会公开完整 issue 数据，不仅是页面显示字段。

## 可选 Express 构建

```bash
pnpm build
pnpm start
```

生产模式由一个 Express 服务同时提供网页和 API，默认地址为 <http://localhost:3099>。这适用于本地操作或未来单独部署 Express，不是 GitHub Pages 的前置条件。

## Docker

```bash
cp .env.example .env.local
docker compose up --build -d
```

打开 <http://localhost:3099>。`data/` 会作为可写数据目录挂载，升级容器时不会丢失日报。

## 配置

| 变量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | 可选 OpenAI API 平台密钥；Codex Agent 模式可留空 |
| `OPENAI_MODEL` | 默认 `gpt-5.4-mini`，仅 OpenAI API 模式使用 |
| `WECOM_BOT_WEBHOOK` | 企业微信群机器人 Webhook，只放在本地 `.env.local` |
| `VISUAL_RADAR_PUBLIC_URL` | 从 Actions deployment 输出复制的 Pages 项目地址，不带结尾斜杠 |
| `VISUAL_RADAR_AUTOMATION_URL` | 可选预览 API base；默认 `http://localhost:3099` |
| `CRON_SECRET` | 本地管理接口鉴权密钥，只放在 `.env.local` |
| `VISUAL_RADAR_DATA_DIR` | 持久化数据目录 |
| `PORT` | Express 服务端口，默认 3099 |

OpenAI 官方说明要求 API 密钥保存在服务端环境变量中，不应放入浏览器代码或 GitHub 仓库：[OpenAI API 快速开始](https://platform.openai.com/docs/quickstart)、[API 身份验证](https://platform.openai.com/docs/api-reference/authentication)。

## 文档

- [GitHub 上传指南](docs/GITHUB上传指南.md)
- [Codex Agent 解读指南](docs/Codex-Agent解读指南.md)
- [企业微信推送指南](docs/企业微信推送指南.md)
- [定时推送指南](docs/定时推送指南.md)
- [部署指南](docs/部署指南.md)
- [安全检查清单](docs/安全检查清单.md)

## 目录

```text
client/       Visual Radar 网页
server/       采集、AI 解读、日报、推送和 API
data/         当前采集、解读、Agent 批次和日报
scripts/      本地操作与 GitHub Pages 静态构建入口
docs/         中文交接文档
ops/          可选 macOS 定时任务模板
.github/      GitHub Pages 发布工作流
```
