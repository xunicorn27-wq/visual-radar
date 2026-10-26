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
- 收藏：<http://localhost:3100/saved>

## 浏览、收藏与备注

- 往期页支持按期／按内容浏览，组合关键词、分类、日报月份筛选和日期排序；搜索条件保存在网址中。
- 日报与档案文章卡片均可收藏、写备注；保存备注会自动收藏。取消收藏只隐藏收藏条目，保留备注，再次收藏后可找回。
- “我的收藏”可以检索个人备注、按收藏时间或日报日期排序，并导出当前筛选结果为 Markdown（含备注和日报链接）。
- 收藏与备注只写入浏览器本地存储，不调用服务器、不随 GitHub Pages 发布，不跨设备同步。本地预览和正式网站的记录相互独立；清理网站数据会清除记录，请用导出功能留存重要笔记。
- “分享本期”和“复制文章链接”生成不含个人搜索条件的日报链接；浏览器不允许复制时提供可手动复制的地址。
- 从档案或收藏进入文章后可返回原浏览结果，保留筛选、已展开数量和卡片位置；这些返回信息仅存于当前标签页的浏览历史。
- 阅读页显示当前页面位置进度并提供回到顶部；进度不代表已读记录，不上传阅读行为。
- 键盘用户可通过“跳到主要内容”直接聚焦正文；手机使用底部导航在日报、档案与收藏间切换，底部预留安全区，弹窗打开时收起导航。

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
9. 运行 `pnpm wecom:preview -- 2026-07-16`，直接从本地 issue 离线生成当期企业微信 Markdown。该命令不启动 Express、不读取 `CRON_SECRET` 或 Webhook、没有网络路径，因此不会发送；只有用户明确确认后，才能从本地管理区或明确的正式接口发送。

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
