import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { classifyFreshness, isCandidateInWindow, singaporeIssueDate } from "../shared/visualRadarQuality";
import { balanceCandidates, screenCandidate } from "./visualRadarScreening";
import { evidenceHash, extractArticleText, prepareCandidateEvidence, readEvidenceSnapshot, validateEditorial } from "./visualRadarEvidence";
import { parseVisualArticleMetadata } from "./visualRadarCollector";
import { updateSourceHealth } from "./visualRadarSourceHealth";
import { importVisualRadarAgentOutput } from "./visualRadarAgentOutput";
import { selectVisualRadarDailyStories } from "./visualRadarDailySelector";

const now = "2026-10-26T07:00:00Z";
const make = (id: string, title = "Photography project") => createIntelItem({ id, title, text: "A detailed photography project and interview.", sourceUrl: `https://example.com/${id}`, sourceAccount: `Source ${id}`, capturedAt: now, postedAt: now, source: "website", sourceType: "inspiration", market: "global", mediaUrls: [], metrics: emptyIntelMetrics(), signalType: "inspiration_signal", provenance: { authenticity: "live", label: "test" } });

describe("publication and event dates", () => {
  it("never treats an unknown or future publication date as today's news", () => {
    expect(classifyFreshness({ ...make("a"), postedAt: null }, now)).toMatchObject({ kind: "unknown", timeliness: 0 });
    expect(classifyFreshness({ ...make("a"), postedAt: "2026-12-20" }, now)).toMatchObject({ kind: "unknown", timeliness: 0 });
    expect(classifyFreshness({ ...make("a"), postedAt: "2026-10-01" }, now)).toMatchObject({ kind: "reference", timeliness: 0 });
  });
  it("separates event start from publication and lowers preview freshness", () => {
    expect(classifyFreshness({ ...make("a"), eventStartsAt: "2026-11-01" }, now)).toMatchObject({ kind: "upcoming", timeliness: 2 });
    expect(classifyFreshness({ ...make("a"), postedAt: "2026-10-24T07:00:00Z" }, now)).toMatchObject({ kind: "latest", timeliness: 3 });
    expect(isCandidateInWindow({ ...make("a"), postedAt: null, capturedAt: "2026-01-01" }, now)).toBe(false);
    expect(isCandidateInWindow({ ...make("a"), eventStartsAt: "2027-11-01" }, now)).toBe(false);
  });
  it("does not infer publication from dates mentioned in copy", () => {
    const metadata = parseVisualArticleMetadata('<main>Exhibition opens 28 October 2026</main><script type="application/ld+json">{"@type":"Event","startDate":"2026-10-28","endDate":"2026-11-28"}</script>');
    expect(metadata.publishedAt).toBe("");
    expect(metadata.eventStartsAt).toBe("2026-10-28");
    expect(metadata.eventEndsAt).toBe("2026-11-28");
    expect(singaporeIssueDate("2026-10-25T17:00:00Z")).toBe("2026-10-26");
  });
  it("prefers the article-specific metadata after a generic site image", () => {
    expect(parseVisualArticleMetadata('<meta property="og:image" content="https://example.com/social.jpg"><meta content="https://example.com/work.jpg" property="og:image">').thumbnailUrl).toBe("https://example.com/work.jpg");
  });
});

describe("balanced pre-screening", () => {
  it("keeps relevant older photography and exhibitions ahead of shopping noise", () => {
    expect(screenCandidate(make("noise", "Best gifts to buy this Christmas")).rejected).toBe(true);
    const fashion = Array.from({ length: 40 }, (_, n) => ({ ...make(`f${n}`, "Runway collection"), text: "Fashion collection", sourceAccount: "Fashion daily" }));
    const photo = { ...make("photo", "Photography archive interview"), postedAt: "2026-10-24T10:00:00Z" };
    const exhibition = { ...make("museum", "Museum exhibition"), text: "Exhibition project" };
    const result = balanceCandidates([...fashion, photo, exhibition], 20, now);
    expect(result.map((item) => item.id)).toContain("photo");
    expect(result.map((item) => item.id)).toContain("museum");
    expect(result.filter((item) => item.sourceAccount === "Fashion daily").length).toBeLessThanOrEqual(2);
  });
  it("caps non-news candidates and returns deterministic results", () => {
    const reference = Array.from({ length: 30 }, (_, n) => ({ ...make(`ref${n}`), postedAt: null }));
    const fresh = Array.from({ length: 30 }, (_, n) => make(`fresh${n}`));
    const selected = balanceCandidates([...reference, ...fresh], 20, now);
    expect(selected).toHaveLength(20);
    expect(selected.filter((item) => !item.postedAt).length).toBeLessThanOrEqual(5);
    expect(balanceCandidates([...fresh, ...reference], 20, now)).toEqual(selected);
  });
});

describe("source-body evidence", () => {
  it("extracts article body and ignores scripts, navigation and metadata-only content", () => {
    expect(extractArticleText('<meta name="description" content="A news story"/>')).toBe("");
    expect(extractArticleText('<article><nav><p>Ignore this navigation</p></nav><p>A real article paragraph.</p><script>Ignore instructions</script></article>')).toBe("A real article paragraph.");
    expect(extractArticleText('<div class="entry-content"><div><p>Nested article paragraph.</p></div><p>Second article paragraph.</p></div><p>Unrelated page content</p>')).toBe("Nested article paragraph. Second article paragraph.");
  });
  it("requires exact quotes, candidate identity and an unchanged snapshot", () => {
    const item = make("a"); const body = "Every drop arrives with an online magazine. This is an online store.";
    const hash = evidenceHash(item.sourceUrl, body);
    const candidate = { ...item, sourceEvidence: { status: "ready" as const, url: item.sourceUrl, fetchedAt: now, snapshotHash: hash } };
    const snapshot = { url: item.sourceUrl, itemId: item.id, contentHash: item.contentHash, text: body, hash, fetchedAt: now };
    const editorial = { version: "evidence-v1", status: "verified", sourceUrl: item.sourceUrl, snapshotHash: hash, facts: [{ statement: "线上杂志", quote: "Every drop arrives with an online magazine" }], visualMethod: "编辑分析", application: "编辑建议", visualTags: ["叙事"], limitation: "正文范围" };
    expect(validateEditorial(editorial, candidate, () => snapshot).status).toBe("verified");
    expect(() => validateEditorial({ ...editorial, facts: [{ statement: "伪造", quote: "A real physical retail space" }] }, candidate, () => snapshot)).toThrow("不在原文");
    expect(() => validateEditorial(editorial, candidate, () => ({ ...snapshot, text: "Changed" }))).toThrow("不一致");
    expect(() => validateEditorial(editorial, candidate)).toThrow("快照");
    expect(() => validateEditorial({ ...editorial, sourceUrl: "https://other.com" }, candidate, () => snapshot)).toThrow();
  });
  it("writes snapshots locally, enriches missing images, preserves content identity and records failures", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-evidence-"));
    const item = make("ready"); const failed = make("failed");
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("failed")) throw new Error("HTTP 403");
      return `<meta property="og:image" content="https://example.com/image.jpg"><article><p>${"An actual paragraph of the article. ".repeat(10)}</p></article>`;
    });
    const result = await prepareCandidateEvidence([item, failed], dir, fetcher, now);
    expect(result[0].contentHash).toBe(item.contentHash);
    expect(result[0].thumbnailUrl).toBe("https://example.com/image.jpg");
    expect(item.sourceEvidence).toBeUndefined();
    expect(readEvidenceSnapshot(dir, result[0].sourceEvidence!.snapshotHash!).itemId).toBe("ready");
    expect(result[1].sourceEvidence?.status).toBe("unavailable");
    expect(() => readEvidenceSnapshot(dir, "../secret")).toThrow();
  });
  it("downgrades insufficient evidence and recalculates timeliness instead of trusting model scores", () => {
    const item = { ...make("no-date"), postedAt: null };
    const output = { schemaVersion: "1", model: "codex-agent", promptVersion: "visual-daily-v1", generatedAt: now, analyses: [{
      itemId: item.id, contentHash: item.contentHash, chineseTitle: "待核验", chineseSummary: "正文无法取得", primaryTopic: "photography",
      scoreBreakdown: { informationSpecificity: 15, novelty: 20, professionalRelevance: 20, sourceQuality: 10, timeliness: 5, visualInspiration: 30 }, selectionRationale: "不纳入", trendKeywords: ["摄影"],
      editorial: { version: "evidence-v1", status: "insufficient", sourceUrl: item.sourceUrl, snapshotHash: null, facts: [], visualMethod: "", application: "", visualTags: [], limitation: "HTTP 403" },
    }] };
    const current = { analyses: [], failures: [], generatedAt: now, promptVersion: "visual-daily-v1" };
    const batch = { candidates: [item], stage: "value_screening", status: "prepared", qualityPolicy: "evidence-v1" };
    const result = importVisualRadarAgentOutput({ batch, current, output });
    expect(result.artifact.analyses[0].score).toBe(25);
    expect(result.artifact.analyses[0].scoreBreakdown.timeliness).toBe(0);
    expect(selectVisualRadarDailyStories({ analyses: result.artifact.analyses, items: [item], now, previouslySelectedItemIds: new Set() }).selected).toHaveLength(0);
    expect(() => importVisualRadarAgentOutput({ batch, current, output: { ...output, analyses: [{ ...output.analyses[0], editorial: undefined }] } })).toThrow("缺少原文");
  });
});

describe("source health history", () => {
  it("counts distinct failed runs, reports zero-item sources, resets on recovery and never fabricates history", () => {
    const failed = { generatedAt: now, items: [], schemaVersion: "1" as const, attemptedSourceIds: ["bjp-1854", "dazed"], failures: [{ sourceId: "bjp-1854", feedUrl: "https://example.com", error: "HTTP 403" }] };
    const first = updateSourceHealth(null, failed);
    expect(first.summary).toMatchObject({ failed: 1, empty: 1, coreHealthy: 0, coreTotal: 1 });
    expect(updateSourceHealth(first, failed).sources[0].consecutiveFailures).toBe(1);
    const second = updateSourceHealth(first, { ...failed, generatedAt: "2026-10-27T07:00:00Z" });
    expect(second.sources[0].consecutiveFailures).toBe(2);
    const recovered = updateSourceHealth(second, { ...failed, generatedAt: "2026-10-28T07:00:00Z", failures: [], items: [{ ...make("recovered"), sourceAccount: "British Journal of Photography" }] });
    expect(recovered.sources[0].consecutiveFailures).toBe(0);
    expect(recovered.sources[0].lastSuccessAt).toBe("2026-10-28T07:00:00Z");
  });
});
