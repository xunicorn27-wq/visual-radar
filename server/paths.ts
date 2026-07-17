import path from "node:path";

export function resolveProjectPaths(projectRoot: string) {
  const configured = process.env.VISUAL_RADAR_DATA_DIR?.trim();
  const dataDir = configured
    ? path.resolve(projectRoot, configured)
    : path.join(projectRoot, "data");
  return {
    agentBatch: path.join(dataDir, "visual_radar_agent_batch.json"),
    agentOutput: path.join(dataDir, "visual_radar_agent_output.json"),
    analysis: path.join(dataDir, "visual_radar_analysis.json"),
    dataDir,
    issues: path.join(dataDir, "visual_radar_issues.json"),
    items: path.join(dataDir, "visual_radar_items.json"),
  };
}
