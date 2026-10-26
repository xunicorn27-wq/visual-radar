import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { IntelItem } from "./intelItem";
import type { EditorialEvidence, SourceEvidence } from "../shared/visualRadarQuality";
import { QUALITY_VERSION, VISUAL_METHODS } from "../shared/visualRadarQuality";
import { parseVisualArticleMetadata } from "./visualRadarCollector";

export interface EvidenceSnapshot { url: string; itemId: string; contentHash: string; text: string; fetchedAt: string; hash: string }
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
  const entry = /<div\s[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>/i.exec(stripped);
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
      if (next.protocol !== "https:" || next.port || next.username || next.password || next.hostname.replace(/^www\./, "") !== original.hostname.replace(/^www\./, "")) throw new Error("原文跨站跳转，需人工核验");
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

export async function prepareCandidateEvidence(candidates: readonly IntelItem[], directory: string, fetchHtml = fetchEvidenceHtml, now = new Date().toISOString()) {
  fs.mkdirSync(directory, { recursive: true });
  const result = structuredClone(candidates) as IntelItem[];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, result.length) }, async () => {
    while (next < result.length) {
      const item = result[next++];
      try {
        const html = await fetchHtml(item.sourceUrl);
        const text = extractArticleText(html);
        if (text.length < 160) throw new Error("正文不足，不能以标题或摘要代替正文");
        const hash = evidenceHash(item.sourceUrl, text);
        const snapshot: EvidenceSnapshot = { url: item.sourceUrl, itemId: item.id, contentHash: item.contentHash, text, fetchedAt: now, hash };
        fs.writeFileSync(path.join(directory, `${hash}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
        item.sourceEvidence = { status: "ready", url: item.sourceUrl, fetchedAt: now, snapshotHash: hash, characters: text.length };
        const metadata = parseVisualArticleMetadata(html);
        if (isGenericImage(item.thumbnailUrl) && metadata.thumbnailUrl && !isGenericImage(metadata.thumbnailUrl)) item.thumbnailUrl = metadata.thumbnailUrl;
        if (metadata.publishedAt && Number.isFinite(Date.parse(metadata.publishedAt))) item.postedAt = new Date(metadata.publishedAt).toISOString();
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
  // Explicit projection keeps unrecognized fields and full source text out of public artifacts.
  return { version: QUALITY_VERSION, status: e.status, sourceUrl: e.sourceUrl, snapshotHash: e.snapshotHash, facts: e.facts.map((f) => ({ statement: f.statement.trim(), quote: f.quote.trim() })), visualMethod: e.visualMethod.trim(), application: e.application.trim(), visualTags: [...new Set(e.visualTags)], limitation: e.limitation.trim() };
}
