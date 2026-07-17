import fs from "node:fs";
import path from "node:path";

import { buildIntelArtifact } from "./intelArtifact";
import type { VisualRadarArtifact } from "./visualRadarCollector";

export function readVisualRadarArtifact(filePath: string): VisualRadarArtifact {
  if (!fs.existsSync(filePath)) {
    return {
      ...buildIntelArtifact([]),
      failures: [],
    };
  }

  const payload = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Partial<
    VisualRadarArtifact
  >;

  return {
    generatedAt:
      typeof payload.generatedAt === "string"
        ? payload.generatedAt
        : new Date().toISOString(),
    items: Array.isArray(payload.items) ? payload.items : [],
    schemaVersion: "1",
    failures: Array.isArray(payload.failures) ? payload.failures : [],
  };
}

export function writeVisualRadarArtifact(
  filePath: string,
  artifact: VisualRadarArtifact
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
}
