import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createIntelItem, emptyIntelMetrics } from "./intelItem";
import { extractArticleText, mplusArticleEndpoint, parseMplusArticle, prepareCandidateEvidence, readEvidenceSnapshot } from "./visualRadarEvidence";
import { verifiedDateCorrections } from "./visualRadarCorrectionDates";

const url = "https://www.mplus.org.hk/en/magazine/example";
const endpoint = "https://www.mplus.org.hk/api/v2/pages/11435/";
const shell = `<script>window.__NUXT__=(function(a){return {page:{name:"PagesMagazineArticle",data:{id:11435,meta:{detail_url:${JSON.stringify(endpoint)}}}}}})(null);</script>`;
const paragraph = "The institution connects moving image, architecture and design through exhibitions, screenings and original research. ";
const article = { id: 11435, meta: { type: "magazines.MagazineArticlePage", detail_url: endpoint, html_url: "/en/magazine/example/" }, body: [
  { type: "custom_paragraph", value: { paragraph: `<div><p>${paragraph}</p></div>` } },
  { type: "heading", value: "A programme of research" },
  { type: "paragraph", value: `<p>${paragraph}</p><ul><li>Screenings and public archives.</li></ul>` },
  { type: "additional_notes", value: "Subscribe to our newsletter." },
  { type: "related_stories", value: "Unrelated story." },
] };
const item = (sourceUrl = url) => createIntelItem({ id: "adapter-example", title: "Example", text: "Summary only", sourceUrl,
  sourceAccount: "M+", capturedAt: "2026-10-26T00:00:00Z", postedAt: null, source: "website", sourceType: "inspiration", market: "global",
  mediaUrls: [], metrics: emptyIntelMetrics(), signalType: "inspiration_signal", provenance: { authenticity: "live", label: "test" } });

describe("verified official body adapters", () => {
  it("clears inherited V&A event-as-publication dates and audits only matching verified candidates", async () => {
    const original = { ...item("https://www.vam.ac.uk/event/abc/example"), postedAt: "2026-10-17T16:00:00Z" };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-adapter-"));
    const html = `<script type="application/ld+json">{"@type":"Event","startDate":"2026-04-18","endDate":"2026-10-18"}</script><div class="introblock__description-container"><div class="trix-content"><div>${paragraph.repeat(2)}</div></div></div>`;
    const [candidate] = await prepareCandidateEvidence([original], dir, async () => html);
    expect(candidate.postedAt).toBeNull();
    expect(original.postedAt).toBe("2026-10-17T16:00:00Z");
    expect(verifiedDateCorrections(original, candidate)).toEqual([
      { field: "postedAt", previous: original.postedAt, corrected: null },
      { field: "eventStartsAt", previous: null, corrected: "2026-04-18" },
      { field: "eventEndsAt", previous: null, corrected: "2026-10-18" },
    ]);
    expect(() => verifiedDateCorrections(original, { ...candidate, id: "other" })).toThrow();
    expect(() => verifiedDateCorrections(original, { ...candidate, sourceEvidence: undefined })).toThrow();
    expect(verifiedDateCorrections(candidate, candidate)).toEqual([]);
    const [published] = await prepareCandidateEvidence([original], dir, async () => html + '<meta property="article:published_time" content="2026-04-01T12:00:00Z">');
    expect(published.postedAt).toBe("2026-04-01T12:00:00.000Z");
    const [failed] = await prepareCandidateEvidence([original], dir, async () => "<title>No body</title>");
    expect(failed.postedAt).toBe(original.postedAt);
  });
  it("reads only V&A's nested description, not related article promos or ticket details", () => {
    const html = `<main><p>Ticket information and opening times.</p><div class="introblock__description-container"><div class="introblock__headline--events"><div class="trix-content"><div>A photographic sculpture.<br><br></div><div>Assembled in the shape of a sound system.<script>Untrusted script text.</script></div></div></div></div><article><p>Membership and shop promotion.</p></article></main>`;
    expect(extractArticleText(html)).toBe("A photographic sculpture. Assembled in the shape of a sound system.");
    expect(extractArticleText('<div class="trix-content"><div>Unscoped rich text cannot count as article evidence.</div></div>')).toBe("");
  });
  it("only discovers an exact first-party article endpoint without executing page scripts", () => {
    expect(mplusArticleEndpoint(url, shell)).toBe(endpoint);
    expect(mplusArticleEndpoint(url, shell.replaceAll("/", "\\u002F"))).toBeNull(); // Broken script delimiters.
    const escaped = shell.replace(JSON.stringify(endpoint), JSON.stringify(endpoint).replaceAll("/", "\\u002F"));
    expect(mplusArticleEndpoint(url, escaped)).toBe(endpoint);
    for (const raw of ["https://evil.example/en/magazine/example", "http://www.mplus.org.hk/en/magazine/example", `${url}?preview=1`, "https://www.mplus.org.hk/en/magazine/"]) expect(mplusArticleEndpoint(raw, shell)).toBeNull();
    expect(mplusArticleEndpoint(url, shell.replace(endpoint, "https://evil.example/api/v2/pages/11435/"))).toBeNull();
    expect(mplusArticleEndpoint(url, '<script>globalThis.executed=true;</script>')).toBeNull();
  });
  it("keeps body blocks in order and excludes author bios, related links and newsletter notes", () => {
    const result = parseMplusArticle(JSON.stringify(article), url, endpoint);
    expect(result.retrievedFrom).toBe(endpoint);
    expect(result.text).toContain("A programme of research");
    expect(result.text).toContain("Screenings and public archives.");
    expect(result.text).not.toContain("Subscribe"); expect(result.text).not.toContain("Unrelated");
  });
  it("rejects a mismatching canonical URL, page identity or body schema", () => {
    for (const broken of [
      { ...article, id: 999 }, { ...article, body: null },
      { ...article, meta: { ...article.meta, type: "index.Page" } },
      { ...article, meta: { ...article.meta, html_url: "/en/magazine/other/" } },
      { ...article, meta: { ...article.meta, html_url: "https://evil.example/en/magazine/example/" } },
      { ...article, meta: { ...article.meta, detail_url: endpoint + "other" } },
    ]) expect(() => parseMplusArticle(JSON.stringify(broken), url, endpoint)).toThrow("身份不一致");
  });
  it("records the original identity and retrieval URL without publishing unrelated API fields", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-adapter-"));
    const candidate = item();
    const fetcher = vi.fn(async (requested: string) => requested === url ? shell : JSON.stringify(article));
    const [ready] = await prepareCandidateEvidence([candidate], dir, fetcher);
    expect(ready.sourceEvidence?.status).toBe("ready"); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(endpoint);
    expect(ready.contentHash).toBe(candidate.contentHash);
    const snapshot = readEvidenceSnapshot(dir, ready.sourceEvidence!.snapshotHash!);
    expect(snapshot.url).toBe(url); expect(snapshot.retrievedFrom).toBe(endpoint);
    expect(ready.postedAt).toBeNull(); // API access time is never publication time.
  });
  it("stops on API rejection and does not upgrade metadata-only or NOWNESS shells to evidence", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-adapter-"));
    const denied = vi.fn(async (requested: string) => { if (requested === url) return shell; throw new Error("原文 HTTP 403"); });
    const [failed] = await prepareCandidateEvidence([item()], dir, denied);
    expect(failed.sourceEvidence).toMatchObject({ status: "unavailable", reason: "原文 HTTP 403" });
    expect(denied).toHaveBeenCalledTimes(2);
    const [short] = await prepareCandidateEvidence([item()], dir, async requested => requested === url ? shell : JSON.stringify({ ...article, body: [] }));
    expect(short.sourceEvidence?.status).toBe("unavailable");
    const [dynamic] = await prepareCandidateEvidence([item("https://www.nowness.com/series/example/film")], dir, async () => '<title>NOWNESS</title><div data-ui-view><h1>LOADING</h1></div>');
    expect(dynamic.sourceEvidence?.reason).toContain("动态页面框架");
  });
});
