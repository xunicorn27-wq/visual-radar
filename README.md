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

第一次使用管理区前，在 `.env.local` 设置一个随机的 `CRON_SECRET`，然后在网页管理区输入同一个值。

## 日常流程

1. 点击“采集最新”。
2. 有 OpenAI API 平台密钥时点击“AI 解读”；没有密钥时点击“Agent 解读”并交给 Codex 处理任务文件。
3. 点击“生成今日日报”。
4. 检查网页全部内容和顶部微信精选 10 条。
5. 点击“推送企业微信”。

自动执行：

```bash
pnpm daily -- --dry-run
pnpm daily
```

`--dry-run` 会完成采集、分析和日报生成，但不会发送企业微信。

## 生产构建

```bash
pnpm test
pnpm check
pnpm build
pnpm start
```

生产模式由一个 Express 服务同时提供网页和 API，默认地址为 <http://localhost:3099>。

## Docker

```bash
cp .env.example .env.local
docker compose up --build -d
```

打开 <http://localhost:3099>。`data/` 会作为可写数据目录挂载，升级容器时不会丢失日报。

## 配置

| 变量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API 平台密钥，不是 ChatGPT 登录密码 |
| `OPENAI_MODEL` | 默认 `gpt-5.4-mini`，可按账号权限更换 |
| `WECOM_BOT_WEBHOOK` | 企业微信群机器人 Webhook |
| `VISUAL_RADAR_PUBLIC_URL` | 用户点击“阅读全文”时访问的公网地址 |
| `CRON_SECRET` | 管理操作和定时接口鉴权密钥 |
| `VISUAL_RADAR_DATA_DIR` | 持久化数据目录 |
| `PORT` | 生产服务端口，默认 3099 |

OpenAI 官方说明要求 API 密钥保存在服务端环境变量中，不应放入浏览器代码或 GitHub 仓库：[OpenAI API 快速开始](https://platform.openai.com/docs/quickstart)、[API 身份验证](https://platform.openai.com/docs/api-reference/authentication)。

## 文档

- [GitHub 上传指南](docs/GITHUB上传指南.md)
- [企业微信推送指南](docs/企业微信推送指南.md)
- [定时推送指南](docs/定时推送指南.md)
- [部署指南](docs/部署指南.md)
- [安全检查清单](docs/安全检查清单.md)

## 目录

```text
client/       Visual Radar 网页
server/       采集、AI 解读、日报、推送和 API
data/         当前采集、解读、Agent 批次和日报
scripts/      开发启动与每日自动化入口
docs/         中文交接文档
ops/          macOS 定时任务模板
.github/      GitHub Actions 定时工作流
```
