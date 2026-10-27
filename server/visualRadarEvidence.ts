import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { IntelItem } from "./intelItem";
import type { EditorialEvidence, SourceEvidence } from "../shared/visualRadarQuality";
import { QUALITY_VERSION, VISUAL_METHODS, CONTENT_KINDS, type EditorialAssessment, type EditorialEvent } from "../shared/visualRadarQuality";
import { parseVisualArticleMetadata } from "./visualRadarCollector";

export interface EvidenceSnapshot { url: string; itemId: string; contentHash: string; text: string; fetchedAt: string; hash: string; retrievedFrom?: string }
export function normalizeEvidenceText(text: string) { return text.normalize("NFKC").replace(/\s+/g, " ").trim(); }
export function evidenceHash(url: string, text: string) {
  return createHash("sha256").update(`${url}\n${normalizeEvidenceText(text)}`).digest("hex");
}
export function isGenericImage(url?: string | null) {
  if (!url) return true;
  try { return /\/(social|default|placeholder|logo)(?:[-_.\/]|$)/i.test(new URL(url).pathname); } catch { return true; }
}
function clean(html: string) {
  return normalizeEvidenceText(html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff))));
}
function divContents(html: string, className: string) {
  const entry = [...html.matchAll(/<div\b[^>]*\bclass=["']([^"']*)["'][^>]*>/gi)]
    .find((m) => m[1].split(/\s+/).includes(className));
  if (!entry) return "";
  const start = entry.index! + entry[0].length;
  let depth = 1;
  const tags = /<\/?div(?:\s[^>]*)?>/gi; tags.lastIndex = start;
  let tag: RegExpExecArray | null;
  while ((tag = tags.exec(html))) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (!depth) return html.slice(start, tag.index);
  }
  return "";
}
export function extractArticleText(html: string) {
  const bodies: string[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if ([node["@type"]].flat().some((t) => typeof t === "string" && /Article|BlogPosting/.test(t)) && typeof node.articleBody === "string") bodies.push(clean(node.articleBody));
    if (node["@graph"]) visit(node["@graph"]);
    if (node.mainEntity) visit(node.mainEntity);
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Not article data. */ }
  }
  if (bodies.length) return bodies.sort((a, b) => b.length - a.length)[0].slice(0, 60000);
  const stripped = html.replace(/<(script|style|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // V&A events use nested divs, not paragraphs. Restrict to the event description,
  // excluding ticket details, related promos, membership and shop copy.
  const eventDescription = divContents(stripped, "introblock__description-container");
  if (eventDescription) {
    const richText = divContents(eventDescription, "trix-content");
    if (richText) return clean(richText).slice(0, 60000);
  }
  // Known body containers only: WordPress article text and TOP Museum exhibition description.
  const entry = /<div\s[^>]*class=["'][^"']*\b(?:entry-content|exhibition_box5)\b[^"']*["'][^>]*>/i.exec(stripped);
  let entryBody = "";
  if (entry) {
    const start = entry.index + entry[0].length;
    let depth = 1;
    const tags = /<\/?div(?:\s[^>]*)?>/gi; tags.lastIndex = start;
    let tag: RegExpExecArray | null;
    while ((tag = tags.exec(stripped))) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (!depth) { entryBody = stripped.slice(start, tag.index); break; }
    }
  }
  const region = entryBody || stripped.match(/<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/i)?.[1]
    || stripped.match(/<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i)?.[1];
  if (!region) return ""; // A headline or meta description alone is not a body snapshot.
  return normalizeEvidenceText([...region.matchAll(/<(p|h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => clean(m[2])).filter((t) => t.length > 8).join(" ")).slice(0, 60000);
}

export function mplusArticleEndpoint(rawUrl: string, html: string) {
  const url = new URL(rawUrl);
  if (url.origin !== "https://www.mplus.org.hk" || !/^\/en\/magazine\/[^/]+\/?$/.test(url.pathname) || url.search || url.username || url.password) return null;
  // Read only the literal page identity from the site's Nuxt payload; never eval it.
  const payload = html.match(/<script\b[^>]*>\s*window\.__NUXT__=([\s\S]*?)<\/script>/)?.[1];
  const id = payload?.match(/page:\{name:"PagesMagazineArticle",data:\{id:(\d+),meta:\{/)?.[1];
  if (!id) return null;
  const endpoint = `https://www.mplus.org.hk/api/v2/pages/${id}/`;
  const detail = payload?.match(/detail_url:("(?:[^"\\]|\\.)*")/)?.[1];
  try { return detail && JSON.parse(detail) === endpoint ? endpoint : null; } catch { return null; }
}

export function parseMplusArticle(raw: string, originalUrl: string, endpoint: string) {
  const value = JSON.parse(raw);
  const original = new URL(originalUrl);
  const canonical = new URL(value.meta?.html_url || "", original.origin);
  if (value.meta?.type !== "magazines.MagazineArticlePage" || value.meta.detail_url !== endpoint
    || endpoint !== `https://www.mplus.org.hk/api/v2/pages/${value.id}/`
    || canonical.origin !== original.origin || canonical.pathname.replace(/\/$/, "") !== original.pathname.replace(/\/$/, "")
    || canonical.search || !Array.isArray(value.body)) throw new Error("M+ 正文接口与原文身份不一致");
  const parts: string[] = [];
  for (const block of value.body) {
    const html = block?.type === "paragraph" || block?.type === "heading" ? block.value
      : block?.type === "custom_paragraph" ? block.value?.paragraph : null;
    if (typeof html === "string") parts.push(clean(html.replace(/<(script|style|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")));
  }
  return { text: normalizeEvidenceText(parts.join(" ")).slice(0, 60000), retrievedFrom: endpoint };
}

export async function fetchEvidenceHtml(rawUrl: string) {
  const original = new URL(rawUrl);
  if (original.protocol !== "https:" || original.username || original.password || original.port
    || !original.hostname.includes(".") || /^[\d.]+$/.test(original.hostname) || original.hostname.includes(":")
    || /\.(local|localhost|internal)$/.test(original.hostname)) throw new Error("不支持的原文地址");
  let url = original;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0 VisualRadarBot/0.2", accept: "text/html" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("原文跳转缺少地址");
      const next = new URL(location, url);
      if (!isAllowedEvidenceRedirect(original, next)) throw new Error("原文跨站跳转，需人工核验");
      url = next; continue;
    }
    if (!response.ok) throw new Error(`原文 HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("原文为空");
    let bytes = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > 4_000_000) { await reader.cancel(); throw new Error("原文超过大小限制"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("原文跳转过多");
}

export function isAllowedEvidenceRedirect(original: URL, next: URL) {
  if (next.protocol !== "https:" || next.port || next.username || next.password) return false;
  if (next.hostname.replace(/^www\./, "") === original.hostname.replace(/^www\./, "")) return true;
  // Confirmed first-party migration: original Runway URL returns 308 to this exact host/path.
  return original.hostname === "runwayml.com" && next.hostname === "runway.com" && next.pathname === original.pathname && next.search === original.search;
}

export async function prepareCandidateEvidence(candidates: readonly IntelItem[], directory: string, fetchHtml = fetchEvidenceHtml, now = new Date().toISOString()) {
  fs.mkdirSync(directory, { recursive: true });
  const result = structuredClone(candidates) as IntelItem[];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, result.length) }, async () => {
    while (next < result.length) {
      const item = result[next++];
      try {
        const html = await fetchHtml(item.sourceUrl);
        let text = extractArticleText(html);
        let retrievedFrom: string | undefined;
        if (text.length < 160) {
          const endpoint = mplusArticleEndpoint(item.sourceUrl, html);
          if (endpoint) {
            const article = parseMplusArticle(await fetchHtml(endpoint), item.sourceUrl, endpoint);
            text = article.text; retrievedFrom = article.retrievedFrom;
          }
        }
        if (text.length < 160 && new URL(item.sourceUrl).hostname.replace(/^www\./, "") === "nowness.com" && html.includes("data-ui-view")) {
          throw new Error("原文仅返回动态页面框架，未取得文章正文；不能以 RSS 摘要替代");
        }
        if (text.length < 160) throw new Error("正文不足，不能以标题或摘要代替正文");
        const hash = evidenceHash(item.sourceUrl, text);
        const snapshot: EvidenceSnapshot = { url: item.sourceUrl, itemId: item.id, contentHash: item.contentHash, text, fetchedAt: now, hash, ...(retrievedFrom ? { retrievedFrom } : {}) };
        fs.writeFileSync(path.join(directory, `${hash}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
        item.sourceEvidence = { status: "ready", url: item.sourceUrl, fetchedAt: now, snapshotHash: hash, characters: text.length };
        const metadata = parseVisualArticleMetadata(html);
        if (isGenericImage(item.thumbnailUrl) && metadata.thumbnailUrl && !isGenericImage(metadata.thumbnailUrl)) item.thumbnailUrl = metadata.thumbnailUrl;
        if (metadata.publishedAt && Number.isFinite(Date.parse(metadata.publishedAt))) item.postedAt = new Date(metadata.publishedAt).toISOString();
        else if (new URL(item.sourceUrl).hostname === "www.vam.ac.uk" && new URL(item.sourceUrl).pathname.startsWith("/event/") && metadata.eventStartsAt) {
          // Old V&A imports treated event dates as publication. An event page with
          // no publication metadata cannot substantiate that inherited date.
          item.postedAt = null;
        }
        if (metadata.eventStartsAt) item.eventStartsAt = metadata.eventStartsAt;
        if (metadata.eventEndsAt) item.eventEndsAt = metadata.eventEndsAt;
      } catch (error) {
        item.sourceEvidence = { status: "unavailable", url: item.sourceUrl, fetchedAt: now, reason: error instanceof Error ? error.message : "正文抓取失败" };
      }
    }
  }));
  return result;
}

export function readEvidenceSnapshot(directory: string, hash: string): EvidenceSnapshot {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("无效证据哈希");
  const snapshot = JSON.parse(fs.readFileSync(path.join(directory, `${hash}.json`), "utf8")) as EvidenceSnapshot;
  if (snapshot.hash !== hash || evidenceHash(snapshot.url, snapshot.text) !== hash) throw new Error("正文快照已变化");
  return snapshot;
}

export function validateEditorial(value: unknown, candidate: { id: string; contentHash: string; sourceUrl?: string; sourceEvidence?: SourceEvidence }, loadSnapshot?: (hash: string) => EvidenceSnapshot): EditorialEvidence {
  if (!value || typeof value !== "object") throw new Error("缺少原文证据与创作参考");
  const e = value as EditorialEvidence;
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (e.version !== QUALITY_VERSION || !["verified", "insufficient"].includes(e.status)
    || e.sourceUrl !== candidate.sourceUrl || !Array.isArray(e.facts) || !Array.isArray(e.visualTags)
    || e.visualTags.some((tag) => !VISUAL_METHODS.includes(tag)) || typeof e.limitation !== "string"
    || typeof e.visualMethod !== "string" || typeof e.application !== "string") throw new Error("证据结构不符合契约");
  if (e.status === "insufficient") {
    if (!text(e.limitation) || e.facts.length || e.snapshotHash !== null || e.visualTags.length || e.visualMethod || e.application) throw new Error("证据不足时必须说明限制，不得补写事实与创作结论");
  } else {
    if (candidate.sourceEvidence?.status !== "ready" || !e.snapshotHash || candidate.sourceEvidence.snapshotHash !== e.snapshotHash || !loadSnapshot) throw new Error("缺少可核对的本地正文快照");
    const snapshot = loadSnapshot(e.snapshotHash);
    if (snapshot.itemId !== candidate.id || snapshot.contentHash !== candidate.contentHash || snapshot.url !== e.sourceUrl || snapshot.hash !== evidenceHash(snapshot.url, snapshot.text)) throw new Error("证据与候选身份不一致");
    if (e.facts.length < 1 || e.facts.length > 3 || !text(e.visualMethod) || !text(e.application) || e.visualTags.length < 1) throw new Error("已核验条目必须包含事实、视觉方法和应用建议");
    const body = normalizeEvidenceText(snapshot.text);
    for (const fact of e.facts) if (!text(fact.statement) || !text(fact.quote) || fact.quote.length < 8 || !body.includes(normalizeEvidenceText(fact.quote))) throw new Error("证据摘录不在原文正文中");
    const quotes = e.facts.map((f) => f.quote).join(" ");
    if (quotes.split(/\s+/).length > 25 || quotes.length > 350 || (quotes.match(/[\u3040-\u9fff]/g)?.length || 0) > 100) throw new Error("原文摘录过长，请保留最短证据");
  }
  const assessment = validateAssessment(e.assessment);
  const event = validateEvent(e.event, e.facts.length);
  if (e.status === "insufficient" && (assessment || event)) throw new Error("正文不足不能附带推荐判断或事件归并");
  // Explicit projection keeps unrecognized fields and full source text out of public artifacts.
  return { version: QUALITY_VERSION, status: e.status, sourceUrl: e.sourceUrl, snapshotHash: e.snapshotHash, facts: e.facts.map((f) => ({ statement: f.statement.trim(), quote: f.quote.trim() })), visualMethod: e.visualMethod.trim(), application: e.application.trim(), visualTags: [...new Set(e.visualTags)], limitation: e.limitation.trim(), ...(assessment ? { assessment } : {}), ...(event ? { event } : {}) };
}

export function validateAssessment(value: unknown): EditorialAssessment | undefined {
  if (value === undefined) return undefined;
  const a = value as EditorialAssessment;
  if (!a || !CONTENT_KINDS.includes(a.contentKind) || !["specific", "general", "none"].includes(a.methodEvidence)
    || typeof a.rationale !== "string" || a.rationale.trim().length < 8 || a.rationale.length > 1000) throw new Error("推荐判断必须说明内容类型、具体方法证据及理由");
  return { contentKind: a.contentKind, methodEvidence: a.methodEvidence, rationale: a.rationale.trim() };
}

export function validateEvent(value: unknown, factCount: number): EditorialEvent | undefined {
  if (value === undefined) return undefined;
  const e = value as EditorialEvent;
  if (!e || typeof e.key !== "string" || !/^[a-z0-9][a-z0-9-]{7,119}$/.test(e.key)
    || typeof e.label !== "string" || !e.label.trim() || e.label.length > 160) throw new Error("事件需要稳定的英文编号与简短名称");
  const result: EditorialEvent = { key: e.key, label: e.label.trim() };
  if (e.development !== undefined) {
    const d = e.development;
    if (!d || typeof d.summary !== "string" || d.summary.trim().length < 8 || d.summary.length > 1000
      || !Array.isArray(d.factIndexes) || d.factIndexes.length < 1 || d.factIndexes.length > 3
      || d.factIndexes.some((i) => !Number.isInteger(i) || i < 0 || i >= factCount)
      || new Set(d.factIndexes).size !== d.factIndexes.length) throw new Error("新增进展必须说明变化并引用本条已核验事实序号");
    result.development = { summary: d.summary.trim(), factIndexes: [...d.factIndexes] };
  }
  return result;
}
