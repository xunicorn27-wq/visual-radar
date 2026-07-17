# Codex Agent 解读指南

## 文件边界

1. 在本地管理区点击“Agent 解读”，生成 `data/visual_radar_agent_batch.json`。
2. Codex 只读取 batch 中的 `candidates`，将结果写入 `data/visual_radar_agent_output.json`。
3. Codex 禁止直接修改 `data/visual_radar_analysis.json`。
4. output 写完后运行 `pnpm agent:import`。导入器会验证 candidate ID、content hash、版本和时间，再合并 analysis。

## Output JSON 契约

顶层字段：

- `schemaVersion`：固定为 `"1"`。
- `model`：固定为 `"codex-agent"`。
- `promptVersion`：固定为 `"visual-daily-v1"`。
- `generatedAt`：带时区的 ISO 8601 时间，例如 `2026-07-17T08:30:00.000Z`。
- `analyses`：分析数组；每项必须对应 batch 中一个 candidate。

每个 analysis 必须包含：

- `itemId`、`contentHash`：原样复制 candidate 的身份字段。
- `chineseTitle`、`chineseSummary`：中文标题和摘要。
- `primaryTopic`：`creator`、`exhibition`、`fashion_culture`、`magazine`、`outfit`、`photography`、`styling` 或 `tool`。
- `scoreBreakdown`：六项分数，满分依次为 15、20、20、10、5、30。
- `selectionRationale`：编辑选择理由。
- `trendKeywords`：中文趋势关键词数组。

完整示例：

```json
{
  "schemaVersion": "1",
  "model": "codex-agent",
  "promptVersion": "visual-daily-v1",
  "generatedAt": "2026-07-17T08:30:00.000Z",
  "analyses": [
    {
      "itemId": "COPY-CANDIDATE-ID-HERE",
      "contentHash": "COPY-CANDIDATE-CONTENT-HASH-HERE",
      "chineseTitle": "独立摄影出版中的新叙事方法",
      "chineseSummary": "该项目通过档案、现场摄影与编辑设计建立可复用的视觉叙事参考。",
      "primaryTopic": "photography",
      "scoreBreakdown": {
        "informationSpecificity": 12,
        "novelty": 16,
        "professionalRelevance": 17,
        "sourceQuality": 8,
        "timeliness": 4,
        "visualInspiration": 25
      },
      "selectionRationale": "包含明确项目背景、视觉方法和可追溯来源，适合专业读者参考。",
      "trendKeywords": ["摄影出版", "档案叙事", "编辑设计"]
    }
  ]
}
```

不要编造或改写 `itemId`、`contentHash`。不要在 output 中加入 API Key、Cookie、Webhook、登录状态或未出现在 batch 中的 candidate。

## 导入

```bash
pnpm agent:import
```

导入成功后检查命令输出和 `data/visual_radar_analysis.json` diff，再从本地管理区生成日报。
