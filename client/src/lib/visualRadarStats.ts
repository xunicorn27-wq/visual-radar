import type { IntelSourceRegistrySnapshot } from "./api";

type SourceSummary = Pick<
  IntelSourceRegistrySnapshot["summary"],
  "live" | "planned"
>;

export function buildVisualRadarSourceStats(
  summary?: SourceSummary | null
): { candidate: number; connected: number } {
  return {
    candidate: summary?.planned ?? 0,
    connected: summary?.live ?? 0,
  };
}
