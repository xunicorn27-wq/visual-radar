export type VisualCultureTopic =
  | "creator" | "exhibition" | "fashion_culture" | "magazine"
  | "outfit" | "photography" | "styling" | "tool";

export interface IntelItem {
  capturedAt: string;
  contentHash: string;
  dedupKey: string;
  hashtags?: string[];
  id: string;
  interpretation: unknown;
  keywords?: string[];
  lang?: string | null;
  market: "EU" | "global" | "HK" | "JP" | "SG" | "US";
  mediaUrls: string[];
  metrics: Record<string, number | boolean | null>;
  postedAt?: string | null;
  provenance: { authenticity: string; evidenceUrl?: string | null; label: string };
  schemaVersion: "1";
  signalType: string | null;
  source: string;
  sourceAccount?: string | null;
  sourceType: string;
  sourceUrl: string;
  text: string;
  thumbnailUrl?: string | null;
  tier: string | null;
  title: string;
  viviaScore: number | null;
}

export interface VisualRadarArtifact {
  failures: Array<{ error: string; feedUrl: string; sourceId: string }>;
  generatedAt: string;
  items: IntelItem[];
  schemaVersion: "1";
}

export interface VisualRadarAnalysis {
  analyzedAt: string;
  chineseSummary: string | null;
  chineseTitle: string | null;
  contentHash: string;
  itemId: string;
  model: string;
  primaryTopic: VisualCultureTopic;
  promptVersion: string;
  score: number;
  scoreBreakdown: Record<string, number>;
  selectionRationale: string | null;
  status: "success";
  trendKeywords: string[];
}

export interface VisualRadarAnalysisArtifact {
  analyses: VisualRadarAnalysis[];
  failures: Array<{ error: string; itemId: string }>;
  generatedAt: string;
  promptVersion: string;
}

export interface VisualRadarSelectedStory {
  analysis: VisualRadarAnalysis;
  item: IntelItem;
  window: "24h" | "72h";
}

export interface VisualRadarIssue {
  featuredStoryIds: string[];
  generatedAt: string;
  id: string;
  issueDate: string;
  metadata: { models: string[]; promptVersion: string };
  skipped: Array<{ itemId: string; reason: string }>;
  stats: {
    bySource: Record<string, number>;
    byTopic: Partial<Record<VisualCultureTopic, number>>;
    storyCount: number;
  };
  stories: VisualRadarSelectedStory[];
  title: string;
}

export interface VisualRadarIssueSummary {
  generatedAt: string;
  id: string;
  issueDate: string;
  storyCount: number;
  title: string;
  topStories: string[];
}

export interface VisualRadarIssueDetail {
  issue: VisualRadarIssue;
  navigation: { nextId: string | null; previousId: string | null };
}

export interface IntelSourceRegistrySnapshot {
  coverage: Record<string, Record<string, number>>;
  generatedAt: string;
  sources: Array<{ authenticity: string; id: string; label: string }>;
  summary: { live: number; planned: number; total: number };
}

export interface VisualRadarAgentBatch {
  candidates: IntelItem[];
  generatedAt: string;
  instructions: string[];
  stage: "value_screening";
  status: "prepared";
  summary: { cached: number; candidates: number; excluded: number; total: number };
}

export interface VisualRadarAnalyzeResponse {
  artifact: VisualRadarAnalysisArtifact;
  summary: { analyzed: number; cached: number; failed: number; totalEligible: number };
}

async function req<T>(url: string, options: RequestInit = {}, secret?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (secret) headers.set("x-cron-secret", secret);
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || `请求失败：${response.status}`);
  }
  return payload as T;
}

export const getVisualRadarSources = () => req<IntelSourceRegistrySnapshot>("/api/visual-radar/sources");
export const getVisualRadarItems = () => req<VisualRadarArtifact>("/api/visual-radar/items");
export const getVisualRadarAnalysis = () => req<VisualRadarAnalysisArtifact>("/api/visual-radar/analysis");
export const getVisualRadarIssues = () => req<VisualRadarIssueSummary[]>("/api/visual-radar/issues");
export const getVisualRadarIssue = (id: string) => req<VisualRadarIssueDetail>(`/api/visual-radar/issues/${encodeURIComponent(id)}`);
export const refreshVisualRadarItems = (secret: string) => req<VisualRadarArtifact>("/api/visual-radar/refresh", { method: "POST" }, secret);
export const analyzeVisualRadarItems = (secret: string) => req<VisualRadarAnalyzeResponse>("/api/visual-radar/analyze", { method: "POST" }, secret);
export const prepareVisualRadarAgentBatch = (secret: string) => req<VisualRadarAgentBatch>("/api/visual-radar/agent/prepare", { method: "POST" }, secret);
export const generateVisualRadarIssue = (secret: string) => req<VisualRadarIssue>("/api/visual-radar/issues/generate", { method: "POST" }, secret);
export const sendVisualRadarIssue = (id: string, secret: string) => req<{ markdown: string; sent: boolean }>(`/api/visual-radar/issues/${encodeURIComponent(id)}/send-wecom`, { method: "POST" }, secret);
