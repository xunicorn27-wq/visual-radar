import fs from "node:fs";

import { importVisualRadarAgentOutput } from "./visualRadarAgentOutput";
import {
  readVisualRadarAnalysisArtifact,
  writeVisualRadarAnalysisArtifactAtomic,
} from "./visualRadarAnalysisStore";

export function importVisualRadarAgentOutputFiles(files: {
  analysis: string;
  batch: string;
  output: string;
}) {
  const batch: unknown = JSON.parse(fs.readFileSync(files.batch, "utf-8"));
  const output: unknown = JSON.parse(fs.readFileSync(files.output, "utf-8"));
  const result = importVisualRadarAgentOutput({
    batch,
    current: readVisualRadarAnalysisArtifact(files.analysis),
    output,
  });

  writeVisualRadarAnalysisArtifactAtomic(files.analysis, result.artifact);
  return result;
}
