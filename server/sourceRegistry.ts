import { VISUAL_CULTURE_SOURCES } from "./visualCultureSourceCatalog";
import type { VisualRadarArtifact } from "./visualRadarCollector";
import { DEFAULT_VISUAL_RADAR_FEEDS } from "./visualRadarCollector";
import type {
  VisualCultureLanguage,
  VisualCultureRegion,
  VisualCultureTopic,
} from "./visualCultureSources";

export interface VisualRadarSourceRegistryEntry {
  authenticity: "live" | "planned";
  collectionMode: string;
  currentItemCount: number;
  evidenceUrl: string | null;
  id: string;
  label: string;
  language: VisualCultureLanguage;
  market: string;
  priority: number;
  region: VisualCultureRegion;
  role: string;
  sourceUrl: string;
  topics: readonly VisualCultureTopic[];
}

export interface VisualRadarSourceRegistrySnapshot {
  coverage: {
    byLanguage: Partial<Record<VisualCultureLanguage, number>>;
    byRegion: Partial<Record<VisualCultureRegion, number>>;
    byTopic: Partial<Record<VisualCultureTopic, number>>;
  };
  generatedAt: string;
  sources: VisualRadarSourceRegistryEntry[];
  summary: { live: number; planned: number; total: number };
}

export function buildVisualRadarSourceRegistry(
  artifact: VisualRadarArtifact
): VisualRadarSourceRegistrySnapshot {
  const itemCounts = new Map<string, number>();
  for (const item of artifact.items) {
    const label = item.sourceAccount?.trim();
    if (label) itemCounts.set(label, (itemCounts.get(label) || 0) + 1);
  }
  const feedById = new Map(DEFAULT_VISUAL_RADAR_FEEDS.map((feed) => [feed.sourceId, feed.feedUrl]));
  const sources = VISUAL_CULTURE_SOURCES.map((source) => {
    const currentItemCount = itemCounts.get(source.label) || 0;
    return {
      authenticity: currentItemCount > 0 ? "live" as const : "planned" as const,
      collectionMode: source.collectionMode,
      currentItemCount,
      evidenceUrl: feedById.get(source.id) || null,
      id: source.id,
      label: source.label,
      language: source.language,
      market: source.market,
      priority: source.priority,
      region: source.region,
      role: source.role,
      sourceUrl: source.sourceUrl,
      topics: source.topics,
    };
  });

  const coverage: VisualRadarSourceRegistrySnapshot["coverage"] = {
    byLanguage: {}, byRegion: {}, byTopic: {},
  };
  for (const source of sources) {
    coverage.byLanguage[source.language] = (coverage.byLanguage[source.language] || 0) + 1;
    coverage.byRegion[source.region] = (coverage.byRegion[source.region] || 0) + 1;
    for (const topic of source.topics) {
      coverage.byTopic[topic] = (coverage.byTopic[topic] || 0) + 1;
    }
  }
  const live = sources.filter((source) => source.authenticity === "live").length;
  return {
    coverage,
    generatedAt: new Date().toISOString(),
    sources,
    summary: { live, planned: sources.length - live, total: sources.length },
  };
}
