import { createHash } from "node:crypto";

export const INTEL_ITEM_SCHEMA_VERSION = "1" as const;

export type IntelSource =
  | "google_trends"
  | "ig"
  | "news_rss"
  | "pinterest"
  | "shopify"
  | "tiktok_cc"
  | "website"
  | "wear"
  | "xhs"
  | "zozo";

export type IntelSourceType = "competitor" | "inspiration" | "trend";

export type IntelSignalType =
  | "baseline_catalog"
  | "catalog_item"
  | "inspiration_signal"
  | "new_product"
  | "price_change"
  | "removed"
  | "trend_signal";

export type IntelMarket = "EU" | "global" | "HK" | "JP" | "SG" | "US";

export type IntelTier = "A" | "B" | "S";

export type IntelSourceAuthenticity = "demo" | "live" | "manual" | "planned" | "unverified";

export interface IntelProvenance {
  authenticity: IntelSourceAuthenticity;
  collector?: string | null;
  evidenceUrl?: string | null;
  fetchedAt?: string | null;
  label: string;
  notes?: string | null;
  snapshotId?: string | null;
  sourceRecordId?: string | null;
}

export interface IntelMetrics {
  comments: number | null;
  growthPct: number | null;
  inStock: boolean | null;
  isNew: boolean | null;
  likes: number | null;
  postCount: number | null;
  previousPrice: number | null;
  price: number | null;
  rankChange: number | null;
  saves: number | null;
  searchIndex: number | null;
  shares: number | null;
}

export interface IntelInterpretation {
  confidence?: string | null;
  mode: "dry_run" | "llm";
  rationale?: string | null;
  relatedSku?: string | null;
  shouldShoot?: string | null;
  shootAngle?: string | null;
  urgency?: string | null;
  vivaiaMeaning?: string | null;
}

export interface IntelItem {
  brand?: string | null;
  capturedAt: string;
  contentHash: string;
  dedupKey: string;
  hashtags?: string[];
  id: string;
  interpretation: IntelInterpretation | null;
  keywords?: string[];
  lang?: string | null;
  market: IntelMarket;
  mediaUrls: string[];
  metrics: IntelMetrics;
  postedAt?: string | null;
  productType?: string | null;
  provenance: IntelProvenance;
  schemaVersion: typeof INTEL_ITEM_SCHEMA_VERSION;
  signalType: IntelSignalType | null;
  source: IntelSource;
  sourceAccount?: string | null;
  sourceType: IntelSourceType;
  sourceUrl: string;
  text: string;
  thumbnailUrl?: string | null;
  tier: IntelTier | null;
  title: string;
  viviaScore: number | null;
}

export type CreateIntelItemInput = Omit<
  IntelItem,
  | "contentHash"
  | "dedupKey"
  | "interpretation"
  | "provenance"
  | "schemaVersion"
  | "tier"
  | "viviaScore"
> & {
  contentHash?: string;
  dedupKey?: string;
  interpretation?: IntelInterpretation | null;
  provenance?: IntelProvenance;
  signalType?: IntelSignalType | null;
  tier?: IntelTier | null;
  viviaScore?: number | null;
};

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeDedupUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return trimmed;
    }
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
        url.searchParams.delete(key);
      }
    }

    const pathname =
      url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    const search = url.searchParams.toString();
    return `${url.hostname.toLowerCase()}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return trimmed;
  }
}

export function buildContentHash(title: string, text: string) {
  const normalized = `${normalizeText(title)}\n${normalizeText(text)}`;
  return `sha1:${createHash("sha1").update(normalized).digest("hex")}`;
}

export function createIntelItem(input: CreateIntelItemInput): IntelItem {
  return {
    ...input,
    contentHash: input.contentHash || buildContentHash(input.title, input.text),
    dedupKey: input.dedupKey || normalizeDedupUrl(input.sourceUrl),
    interpretation: input.interpretation ?? null,
    mediaUrls: input.mediaUrls || [],
    provenance: input.provenance || {
      authenticity: "unverified",
      collector: null,
      evidenceUrl: null,
      fetchedAt: null,
      label: "未标注来源",
      notes: null,
      snapshotId: null,
      sourceRecordId: null,
    },
    schemaVersion: INTEL_ITEM_SCHEMA_VERSION,
    signalType: input.signalType ?? null,
    tier: input.tier ?? null,
    viviaScore: input.viviaScore ?? null,
  };
}

export function emptyIntelMetrics(overrides: Partial<IntelMetrics> = {}): IntelMetrics {
  return {
    comments: null,
    growthPct: null,
    inStock: null,
    isNew: null,
    likes: null,
    postCount: null,
    previousPrice: null,
    price: null,
    rankChange: null,
    saves: null,
    searchIndex: null,
    shares: null,
    ...overrides,
  };
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
