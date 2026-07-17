import fs from "node:fs";
import path from "node:path";

import type { IntelItem } from "./intelItem";
import type { VisualRadarAnalysisArtifact } from "./visualRadarAnalysis";
import type { VisualRadarArtifact } from "./visualRadarCollector";

export interface VisualRadarAgentBatch {
  candidates: IntelItem[];
  generatedAt: string;
  instructions: string[];
  stage: "value_screening";
  status: "prepared";
  summary: {
    cached: number;
    candidates: number;
    excluded: number;
    total: number;
  };
}

export function prepareVisualRadarAgentBatch({
  analysisArtifact,
  itemsArtifact,
  maxCandidates = 80,
  now = new Date().toISOString(),
}: {
  analysisArtifact: VisualRadarAnalysisArtifact;
  itemsArtifact: VisualRadarArtifact;
  maxCandidates?: number;
  now?: string;
}): VisualRadarAgentBatch {
  const cachedHashes = new Set(
    analysisArtifact.analyses.map((analysis) => analysis.contentHash)
  );
  const seenHashes = new Set<string>();
  let cached = 0;
  let excluded = 0;

  const candidates = itemsArtifact.items
    .toSorted((left, right) => itemTime(right) - itemTime(left))
    .filter((item) => {
      if (item.provenance.authenticity !== "live" || ageHours(item, now) > 72) {
        excluded += 1;
        return false;
      }
      if (cachedHashes.has(item.contentHash)) {
        cached += 1;
        return false;
      }
      if (seenHashes.has(item.contentHash)) {
        excluded += 1;
        return false;
      }
      seenHashes.add(item.contentHash);
      return true;
    })
    .slice(0, maxCandidates);

  excluded += Math.max(
    0,
    itemsArtifact.items.length - cached - excluded - candidates.length
  );

  return {
    candidates,
    generatedAt: now,
    instructions: [
      "第一阶段只做内容价值评分与淘汰，不进行完整中文翻译。",
      "第二阶段仅对高价值候选生成中文标题、摘要、关键词和编辑观察。",
      "将标准化结果写入 data/visual_radar_agent_output.json。",
      "禁止直接修改 data/visual_radar_analysis.json。",
      "完成 output 文件后运行 pnpm agent:import 导入分析结果。",
    ],
    stage: "value_screening",
    status: "prepared",
    summary: {
      cached,
      candidates: candidates.length,
      excluded,
      total: itemsArtifact.items.length,
    },
  };
}

export function writeVisualRadarAgentBatch(
  filePath: string,
  batch: VisualRadarAgentBatch
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(batch, null, 2)}\n`, "utf-8");
}

function ageHours(item: IntelItem, now: string) {
  const timestamp = itemTime(item);
  const nowTimestamp = new Date(now).getTime();
  if (!timestamp || Number.isNaN(nowTimestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowTimestamp - timestamp) / 3_600_000);
}

function itemTime(item: IntelItem) {
  const timestamp = new Date(item.postedAt || item.capturedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
