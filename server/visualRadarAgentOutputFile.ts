import fs from "node:fs";
import path from "node:path";
import { readEvidenceSnapshot } from "./visualRadarEvidence";
import { QUALITY_VERSION } from "../shared/visualRadarQuality";

import { importVisualRadarAgentOutput } from "./visualRadarAgentOutput";
import {
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifactAtomic,
} from "./visualRadarAnalysisStore";

export function importVisualRadarAgentOutputFiles(files: {
  analysis: string;
  batch: string;
  output: string;
  evidence?: string;
}) {
  const batch: unknown = JSON.parse(fs.readFileSync(files.batch, "utf-8"));
  if ((batch as { qualityPolicy?: string })?.qualityPolicy !== QUALITY_VERSION) throw new Error("请重新 prepare：文件导入必须使用 evidence-v1 质量批次");
  const output: unknown = JSON.parse(fs.readFileSync(files.output, "utf-8"));
  const result = importVisualRadarAgentOutput({
    batch,
    current: readVisualRadarAnalysisArtifact(files.analysis),
    output,
    loadSnapshot: (hash) => readEvidenceSnapshot(files.evidence || path.join(path.dirname(files.batch), "evidence"), hash),
  });

  writeVisualRadarAnalysisArtifactAtomic(files.analysis, result.artifact);
  return result;
}
