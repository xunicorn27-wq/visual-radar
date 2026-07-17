# Visual Radar Codex 分析与 GitHub Pages 发布设计

日期：2026-07-17

## 目标

在没有 OpenAI API Key 的条件下，由 Codex 完成 Visual Radar 候选内容的价值筛选与中文分析，并将最终日报发布为公开的 GitHub Pages 静态网站。现有 Express 服务继续用于本地采集、管理、预览和企业微信发送。

本阶段采用半自动工作流：用户或 Codex 定时任务启动分析与发布；GitHub Actions 不调用模型，只构建和部署已经写入仓库的日报数据。企业微信正式发送始终需要用户明确确认。

## 已确认决策

- 使用现有 Visual Radar 仓库，仓库设为 Public。
- 使用 GitHub Pages 提供公开、只读的日报网站。
- 使用当前 Codex 登录能力分析，不配置 `OPENAI_API_KEY`。
- 保留现有 OpenAI API Provider，未来获得 API Key 后仍可切换到全自动模式。
- 不删除或覆盖已有日报；同一天重新生成时继续使用现有项目的合并和版本规则。
- 不在 GitHub Actions 中保存企业微信 Webhook、OpenAI Key 或本地管理密钥。

## 总体架构

Visual Radar 分为四个边界清晰的部分：

1. 本地采集与管理：Express 负责采集信息源、准备 Agent 候选批次、生成日报以及企业微信 dry-run/发送。
2. Codex 分析：Codex 读取 `data/visual_radar_agent_batch.json`，产出经过结构校验的分析结果，并合并到 `data/visual_radar_analysis.json`。
3. 静态快照：构建前将 `data/visual_radar_issues.json` 转换为 Pages 可读取的公开 JSON，包括日报索引和每期详情。
4. GitHub Pages 发布：GitHub Actions 执行测试、类型检查、静态构建与 Pages 部署，不执行采集、模型分析或群消息发送。

数据流：

```text
公开信息源
  -> 本地采集
  -> Agent 候选批次
  -> Codex 分析
  -> analysis.json
  -> issues.json
  -> Pages 静态 JSON
  -> GitHub Actions
  -> GitHub Pages
```

## Codex 分析流程

现有 `visual_radar_agent_batch.json` 继续作为 Codex 的输入边界。新增一个可验证的 Agent 输出文件和导入命令，避免 Codex 直接对大型历史分析文件进行不受约束的字符串编辑。

建议流程：

1. 本地运行采集并准备候选批次。
2. Codex 按现有 Prompt 版本完成两阶段处理：先价值筛选，再为高价值候选生成中文标题、摘要、主题、关键词、评分和编辑观察。
3. Codex 将本次结果写入独立输出文件。
4. 导入命令校验字段、候选 ID、内容哈希、评分范围和 Prompt 版本。
5. 校验通过后，复用现有 analysis store 合并逻辑写入历史分析文件。
6. 调用现有日报选择和生成逻辑，保留来源去重、最低评分、主题多样性和往期排除规则。

Agent 输出中的 `model` 使用明确的 Codex 标识，例如 `codex-agent`，不冒充 OpenAI API 模型名称。

## 静态站点模式

现有 React 页面保留同一套视觉组件，同时支持两种数据源：

- 本地/服务端模式：继续请求 `/api/visual-radar/...`。
- Pages 模式：读取构建生成的静态 JSON。

静态快照至少包括：

```text
public-data/issues/index.json
public-data/issues/<issue-id>.json
```

公开快照只包含网页展示需要的日报索引、日报详情和相邻期导航，不包含管理密钥、Webhook、Agent 工作文件或后台状态。

GitHub Pages 项目站点使用仓库子路径，例如 `/visual-radar/`。Vite 构建需设置正确的 `base`。为支持企业微信中的直达链接，构建过程为 `/issues/` 和每个 `/issues/<issue-id>/` 生成入口 HTML，使用户直接打开或刷新日报详情时不会落到 GitHub Pages 404 页面。

以下示例中，`owner` 表示 GitHub 仓库所有者账号。预期地址：

```text
https://owner.github.io/visual-radar/
https://owner.github.io/visual-radar/issues/
https://owner.github.io/visual-radar/issues/2026-07-17/
```

如果以后配置自定义域名，只需调整 Pages URL 和 `VISUAL_RADAR_PUBLIC_URL`，不改变日报数据结构。

## GitHub Actions

新增独立 Pages 工作流，在推送到 `main` 或手动触发时运行：

1. Checkout。
2. 安装 Node 与 pnpm。
3. 安装锁定依赖。
4. 运行测试和类型检查。
5. 生成静态快照。
6. 以 Pages 模式构建 Vite 前端。
7. 上传 Pages artifact。
8. 使用 GitHub Pages 官方部署 Action 发布。

工作流权限限制为 `contents: read`、`pages: write` 和 `id-token: write`。Pages 工作流不读取 `WECOM_BOT_WEBHOOK`、`CRON_SECRET` 或 `OPENAI_API_KEY`。

现有 `daily.yml` 依赖公网 Express 服务和 API Key，不适合当前无 Key 架构。实施时将其改为仅手动触发或停用定时触发，防止每天调用一个无法完成分析的服务。它不会被改造成 Pages 发布工作流。

## 企业微信链路

`VISUAL_RADAR_PUBLIC_URL` 设置为 GitHub Pages 项目首页，例如：

```dotenv
VISUAL_RADAR_PUBLIC_URL=https://owner.github.io/visual-radar
```

现有企业微信 Markdown 仍只选取 `featuredStoryIds` 中最多 10 条，每条链接指向对应静态日报详情页。正式发送继续从本机或受控服务执行：

1. 先生成日报并推送 GitHub。
2. 等待 Pages 部署成功。
3. 在手机或浏览器验证详情页可访问。
4. 执行 `dryRun=1` 检查群消息 Markdown 和链接。
5. 仅在用户明确确认后执行正式发送。

Pages 部署失败、链接不可访问或日报数据校验失败时，不允许进入正式发送步骤。

## 错误处理

- Agent 输出格式错误：导入失败并保留原 analysis 和 issues 数据不变。
- 候选 ID 或内容哈希不匹配：拒绝对应结果，防止将分析写到错误内容。
- 没有合格新内容：不生成空日报，也不覆盖已有日报。
- 静态快照生成失败：GitHub Actions 失败，不发布半成品。
- 页面图片源失效：显示现有文本内容和图片回退样式，不阻塞整期日报。
- Pages 部署未完成：企业微信只允许 dry-run。
- 仓库公开：默认视为 `data/` 中已提交的采集、分析和日报内容可公开；环境变量文件和所有真实密钥继续被忽略。

## 测试与验收

新增测试覆盖：

- Agent 输出校验与安全合并。
- 静态日报索引、详情和导航生成。
- 本地 API 模式与 Pages 静态模式的数据读取。
- 仓库子路径下的资源和路由地址。
- Pages 直达详情页和刷新行为。
- 企业微信 Markdown 使用 Pages URL 且只包含最多 10 条精选。
- 无 API Key 时，Pages 构建和部署不依赖 OpenAI Provider。

完成标准：

- `pnpm test`、`pnpm check` 和 Pages 构建全部通过。
- 本地模拟 Pages 子路径时，首页、往期页和日报详情页可访问。
- 2026-07-16 历史日报仍完整存在且可展示。
- GitHub Pages 公网链接可从手机打开。
- dry-run 返回正确 Markdown 和公网链接，但不产生真实群消息。

## 实施顺序

1. 增加 Agent 输出格式、校验和导入命令。
2. 增加静态快照生成器及测试。
3. 让前端支持 API/静态双数据源。
4. 配置 Vite Pages 子路径和直达页面入口。
5. 增加 Pages GitHub Actions 工作流。
6. 调整旧 daily workflow，避免无 API Key 时误触发。
7. 更新 README、GitHub 上传和企业微信文档。
8. 完整测试并执行本地 Pages 视觉验证。
9. 上传 Public GitHub 仓库并启用 Pages。
10. Pages 可访问后执行企业微信 dry-run；正式发送等待用户确认。
