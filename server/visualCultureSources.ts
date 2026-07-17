import type { IntelMarket } from "./intelItem";

export type VisualCultureTopic =
  | "creator"
  | "exhibition"
  | "fashion_culture"
  | "magazine"
  | "outfit"
  | "photography"
  | "styling"
  | "tool";

export type VisualCultureRegion =
  | "europe_america"
  | "hk_sg"
  | "japan_korea"
  | "other_global";

export type VisualCultureLanguage =
  | "de"
  | "en"
  | "fr"
  | "it"
  | "ja"
  | "ko"
  | "zh";

export type VisualCultureSourceRole =
  | "editorial"
  | "institution"
  | "photography"
  | "tool_vendor";

export type VisualCultureCollectionMode =
  | "html_list"
  | "manual_review"
  | "official_page";

export interface VisualCultureSource {
  readonly collectionMode: VisualCultureCollectionMode;
  readonly id: string;
  readonly label: string;
  readonly language: VisualCultureLanguage;
  readonly market: IntelMarket;
  readonly priority: 1 | 2 | 3;
  readonly region: VisualCultureRegion;
  readonly role: VisualCultureSourceRole;
  readonly sourceUrl: string;
  readonly topics: readonly VisualCultureTopic[];
}

export interface VisualCultureSourceSummary {
  byLanguage: Partial<Record<VisualCultureLanguage, number>>;
  byRegion: Partial<Record<VisualCultureRegion, number>>;
  byTopic: Partial<Record<VisualCultureTopic, number>>;
  planned: number;
  total: number;
}

export function validateVisualCultureSourceCatalog(
  sources: readonly VisualCultureSource[]
): string[] {
  const errors: string[] = [];
  const sourceIds = new Set<string>();

  for (const source of sources) {
    if (sourceIds.has(source.id)) {
      errors.push(`duplicate source id: ${source.id}`);
    } else {
      sourceIds.add(source.id);
    }

    if (source.language === "zh") {
      errors.push(`Chinese-language source is not allowed: ${source.id}`);
    }

    if (!usesHttps(source.sourceUrl)) {
      errors.push(`source URL must use HTTPS: ${source.id}`);
    }

    if (source.topics.length === 0) {
      errors.push(`source topics are required: ${source.id}`);
    }
  }

  return errors;
}

export function summarizeVisualCultureSources(
  sources: readonly VisualCultureSource[]
): VisualCultureSourceSummary {
  const byLanguage: VisualCultureSourceSummary["byLanguage"] = {};
  const byRegion: VisualCultureSourceSummary["byRegion"] = {};
  const byTopic: VisualCultureSourceSummary["byTopic"] = {};

  for (const source of sources) {
    incrementCount(byLanguage, source.language);
    incrementCount(byRegion, source.region);

    for (const topic of source.topics) {
      incrementCount(byTopic, topic);
    }
  }

  return {
    byLanguage,
    byRegion,
    byTopic,
    planned: sources.length,
    total: sources.length,
  };
}

function usesHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function incrementCount<Key extends string>(
  counts: Partial<Record<Key, number>>,
  key: Key
): void {
  counts[key] = (counts[key] || 0) + 1;
}
