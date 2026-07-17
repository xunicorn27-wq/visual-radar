import { buildIntelArtifact, type IntelArtifact } from "./intelArtifact";
import {
  createIntelItem,
  emptyIntelMetrics,
  type IntelItem,
} from "./intelItem";
import { VISUAL_CULTURE_SOURCES } from "./visualCultureSourceCatalog";
import type { VisualCultureSource } from "./visualCultureSources";

export interface VisualRadarFeedConfig {
  excludePathPrefixes?: readonly string[];
  feedUrl: string;
  format?: "feed" | "html" | "met-api" | "page" | "sitemap" | "wordpress";
  includePathPrefixes?: readonly string[];
  sourceId: VisualCultureSource["id"];
}

export interface VisualFeedItem {
  link: string;
  publishedAt: string;
  summary: string;
  thumbnailUrl: string | null;
  title: string;
}

export interface VisualRadarCollectionFailure {
  error: string;
  feedUrl: string;
  sourceId: string;
}

export interface VisualRadarArtifact extends IntelArtifact {
  failures: VisualRadarCollectionFailure[];
}

export interface CollectVisualRadarItemsInput {
  fetchText?: (url: string) => Promise<string>;
  generatedAt?: string;
  limitPerSource?: number;
  sourceConcurrency?: number;
  sources?: readonly VisualRadarFeedConfig[];
}

export const DEFAULT_VISUAL_RADAR_FEEDS: readonly VisualRadarFeedConfig[] =
  Object.freeze([
    Object.freeze({
      feedUrl: "https://www.dazeddigital.com/rss",
      sourceId: "dazed",
    }),
    Object.freeze({
      feedUrl: "https://www.wallpaper.com/rss",
      sourceId: "wallpaper",
    }),
    Object.freeze({
      feedUrl: "https://www.1854.photography/feed/",
      sourceId: "bjp-1854",
    }),
    Object.freeze({
      feedUrl: "https://www.fashionsnap.com/rss.xml",
      sourceId: "fashionsnap",
    }),
    Object.freeze({
      feedUrl: "https://magazineworld.jp/ginza/feed/",
      sourceId: "ginza",
    }),
    Object.freeze({
      feedUrl: "https://i-d.co/feed/",
      sourceId: "id-magazine",
    }),
    Object.freeze({
      feedUrl: "https://www.anothermag.com/feed",
      sourceId: "another-magazine",
    }),
    Object.freeze({
      feedUrl: "https://www.interviewmagazine.com/feed/",
      sourceId: "interview-magazine",
    }),
    Object.freeze({
      feedUrl: "https://www.nowness.com/rss",
      sourceId: "nowness",
    }),
    Object.freeze({
      feedUrl: "https://feeds2.feedburner.com/itsnicethat/SlXC",
      sourceId: "its-nice-that",
    }),
    Object.freeze({
      feedUrl: "https://www.lensculture.com/feeds/flipboard.rss",
      sourceId: "lensculture",
    }),
    Object.freeze({
      feedUrl: "https://vogue.sg/feed/",
      sourceId: "vogue-singapore",
    }),
    Object.freeze({
      feedUrl: "https://www.vogue.co.uk/feed/rss",
      sourceId: "british-vogue",
    }),
    Object.freeze({
      feedUrl: "https://www.vogue.co.jp/feed/rss",
      sourceId: "vogue-japan",
    }),
    Object.freeze({
      feedUrl: "https://www.vogue.co.kr/feed/",
      sourceId: "vogue-korea",
    }),
    Object.freeze({
      feedUrl: "https://www.wkorea.com/feed/",
      sourceId: "w-korea",
    }),
    Object.freeze({
      feedUrl: "https://www.wmagazine.com/rss",
      sourceId: "w-magazine",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze([
        "/fashion-shows/designers",
        "/fashion-shows/featured",
        "/fashion-shows/image-archive",
        "/fashion-shows/latest-shows",
        "/fashion-shows/seasons",
        "/fashion-shows/schedule",
      ]),
      feedUrl: "https://www.vogue.com/fashion-shows/latest-shows",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/fashion-shows/"]),
      sourceId: "vogue-runway",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze(["/article/best-wedding-dresses"]),
      feedUrl: "https://www.vogue.com/contributor/photovogue",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/article/"]),
      sourceId: "photovogue",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze([
        "/en/magazine/classification/",
        "/en/magazine/type/",
      ]),
      feedUrl: "https://www.mplus.org.hk/en/magazine/",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/en/magazine/"]),
      sourceId: "mplus",
    }),
    Object.freeze({
      feedUrl: "https://aperture.org/wp-json/wp/v2/posts?per_page=24&_embed=1",
      format: "wordpress" as const,
      sourceId: "aperture",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze([
        "/exhibitions/education-and-community-exhibitions",
        "/exhibitions/mana-exhibitions",
        "/exhibitions/past-exhibitions",
        "/exhibitions/traveling-exhibitions",
      ]),
      feedUrl: "https://www.icp.org/exhibitions",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/exhibitions/"]),
      sourceId: "icp",
    }),
    Object.freeze({
      feedUrl: "https://www.vam.ac.uk/whatson?type=exhibition",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/event/"]),
      sourceId: "vam-fashion",
    }),
    Object.freeze({
      feedUrl: "https://www.momu.be/en/exhibitions/",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/en/exhibitions/"]),
      sourceId: "momu",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze([
        "/en/exhibitions/expositions-en-cours",
        "/en/exhibitions/expositions-passees",
        "/en/exhibitions/expositions-venir",
        "/en/exhibitions/international-exhibitions",
        "/en/exhibitions/publications",
      ]),
      feedUrl: "https://www.palaisgalliera.paris.fr/sitemap.xml",
      format: "sitemap" as const,
      includePathPrefixes: Object.freeze(["/en/exhibitions/"]),
      sourceId: "palais-galliera",
    }),
    Object.freeze({
      feedUrl: "https://topmuseum.jp/?lang=en",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/exhibition/"]),
      sourceId: "tokyo-photo-museum",
    }),
    Object.freeze({
      feedUrl:
        "https://collectionapi.metmuseum.org/public/collection/v1/search?departmentId=8&hasImages=true&q=*",
      format: "met-api" as const,
      sourceId: "met-costume-institute",
    }),
    Object.freeze({
      feedUrl: "https://news.adobe.com/",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/news/"]),
      sourceId: "adobe-news",
    }),
    Object.freeze({
      feedUrl: "https://learn.captureone.com/feed/",
      sourceId: "capture-one",
    }),
    Object.freeze({
      feedUrl: "https://www.blackmagicdesign.com/products/davinciresolve/whatsnew",
      format: "page" as const,
      sourceId: "blackmagic-resolve",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze(["/research/publications"]),
      feedUrl: "https://runwayml.com/news/research",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/research/"]),
      sourceId: "runway",
    }),
    Object.freeze({
      feedUrl: "https://www.topazlabs.com/news",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/news/"]),
      sourceId: "topaz-labs",
    }),
    Object.freeze({
      feedUrl: "https://aputure.com/en-US/pages/blog",
      format: "html" as const,
      includePathPrefixes: Object.freeze(["/en-US/articles/"]),
      sourceId: "aputure",
    }),
    Object.freeze({
      excludePathPrefixes: Object.freeze([
        "/gb/en/still-photography/profoto-stories/2018/",
        "/gb/en/still-photography/profoto-stories/2019/",
        "/gb/en/still-photography/profoto-stories/2020/",
        "/gb/en/still-photography/profoto-stories/2021/",
        "/gb/en/still-photography/profoto-stories/2022/",
        "/gb/en/still-photography/profoto-stories/2023/",
        "/gb/en/still-photography/profoto-stories/2024/",
      ]),
      feedUrl: "https://www.profoto.com/gb/sitemap.xml",
      format: "sitemap" as const,
      includePathPrefixes: Object.freeze([
        "/gb/en/still-photography/profoto-stories/",
      ]),
      sourceId: "profoto",
    }),
  ]);

const VISUAL_SOURCE_BY_ID = new Map(
  VISUAL_CULTURE_SOURCES.map((source) => [source.id, source])
);

export async function collectVisualRadarItems({
  fetchText = fetchUrlText,
  generatedAt = new Date().toISOString(),
  limitPerSource = 8,
  sourceConcurrency = 4,
  sources = DEFAULT_VISUAL_RADAR_FEEDS,
}: CollectVisualRadarItemsInput = {}): Promise<VisualRadarArtifact> {
  const results = await mapWithConcurrency(
    sources,
    sourceConcurrency,
    async (feedConfig) => {
    const source = VISUAL_SOURCE_BY_ID.get(feedConfig.sourceId);
    if (!source) {
      return {
        failure: {
          error: "Unknown visual culture source",
          feedUrl: feedConfig.feedUrl,
          sourceId: feedConfig.sourceId,
        },
        items: [] as IntelItem[],
      };
    }

    try {
      const payload = await fetchText(feedConfig.feedUrl);
      let feedItems = parseConfiguredVisualItems(payload, feedConfig, limitPerSource);
      if (feedConfig.format === "html" || feedConfig.format === "sitemap") {
        feedItems = await Promise.all(
          feedItems.map((item) => enrichVisualHtmlItem(item, fetchText))
        );
        feedItems = feedItems
          .toSorted((left, right) =>
            dateSortValue(right.publishedAt) - dateSortValue(left.publishedAt)
          )
          .slice(0, limitPerSource);
      }
      if (feedConfig.format === "met-api") {
        feedItems = await collectMetCostumeItems(payload, fetchText, limitPerSource);
      }
      return {
        failure: null,
        items: feedItems.map((item) =>
          buildVisualRadarItem({
            capturedAt: generatedAt,
            collectionFormat: feedConfig.format || "feed",
            feedUrl: feedConfig.feedUrl,
            item,
            source,
          })
        ),
      };
    } catch (error) {
      return {
        failure: {
          error: error instanceof Error ? error.message : String(error),
          feedUrl: feedConfig.feedUrl,
          sourceId: feedConfig.sourceId,
        },
        items: [] as IntelItem[],
      };
    }
  });
  const items = results.flatMap((result) => result.items);
  const failures = results.flatMap((result) =>
    result.failure ? [result.failure] : []
  );

  return {
    ...buildIntelArtifact(dedupeItems(items), { generatedAt }),
    failures,
  };
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), values.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await task(values[index]);
      }
    })
  );
  return results;
}

export function parseVisualFeedItems(xml: string): VisualFeedItem[] {
  const rssItems = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map(
    (match) => {
      const block = match[0];
      const rawSummary = readTag(block, "description");
      const rawContent = readTag(block, "content:encoded");
      return {
        link: decodeXml(readTag(block, "link")),
        publishedAt: decodeXml(readTag(block, "pubDate")),
        summary: decodeXml(rawSummary),
        thumbnailUrl: readFeedImageUrl(block, `${rawSummary} ${rawContent}`),
        title: decodeXml(readTag(block, "title")),
      };
    }
  );

  const atomItems = Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map(
    (match) => {
      const block = match[0];
      const rawSummary = readTag(block, "summary") || readTag(block, "content");
      return {
        link: decodeXml(readAtomLink(block)),
        publishedAt: decodeXml(readTag(block, "updated") || readTag(block, "published")),
        summary: decodeXml(rawSummary),
        thumbnailUrl: readFeedImageUrl(block, rawSummary),
        title: decodeXml(readTag(block, "title")),
      };
    }
  );

  return [...rssItems, ...atomItems].filter((item) => item.title && item.link);
}

function parseConfiguredVisualItems(
  payload: string,
  config: VisualRadarFeedConfig,
  limitPerSource: number
) {
  const expandedLimit = Math.max(limitPerSource * 3, limitPerSource);
  if (config.format === "html") {
    return parseVisualHtmlItems(payload, {
      baseUrl: config.feedUrl,
      excludePathPrefixes: config.excludePathPrefixes,
      includePathPrefixes: config.includePathPrefixes || [],
    }).slice(0, expandedLimit);
  }
  if (config.format === "sitemap") {
    return parseVisualSitemapItems(payload, {
      excludePathPrefixes: config.excludePathPrefixes,
      includePathPrefixes: config.includePathPrefixes || [],
    }).slice(-expandedLimit);
  }
  if (config.format === "wordpress") {
    return parseWordPressVisualItems(payload).slice(0, limitPerSource);
  }
  if (config.format === "page") {
    return parseVisualPageItem(payload, config.feedUrl);
  }
  if (config.format === "met-api") return [];
  return parseVisualFeedItems(payload).slice(0, limitPerSource);
}

export function parseVisualHtmlItems(
  html: string,
  options: {
    baseUrl: string;
    excludePathPrefixes?: readonly string[];
    includePathPrefixes: readonly string[];
  }
): VisualFeedItem[] {
  const seen = new Set<string>();
  const items: VisualFeedItem[] = [];

  for (const match of Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))) {
    const href = readAttribute(match[1] || "", "href");
    const link = resolveHttpUrl(href, options.baseUrl);
    if (!link) continue;

    const pathname = new URL(link).pathname;
    if (!options.includePathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      continue;
    }
    if (options.excludePathPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
      continue;
    }

    const normalizedLink = link.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(normalizedLink)) continue;

    const body = match[2] || "";
    const imageAlt = readAttribute(body.match(/<img\b([^>]*)>/i)?.[1] || "", "alt");
    const title = decodeXml(body) || decodeXml(imageAlt);
    if (title.length < 8) continue;

    const imageAttrs = body.match(/<img\b([^>]*)>/i)?.[1] || "";
    const rawImage =
      readAttribute(imageAttrs, "src") ||
      readAttribute(imageAttrs, "data-src") ||
      readAttribute(imageAttrs, "data-lazy-src") ||
      readFirstSrcsetUrl(readAttribute(imageAttrs, "srcset"));

    seen.add(normalizedLink);
    items.push({
      link: normalizedLink,
      publishedAt: "",
      summary: title,
      thumbnailUrl: resolveImageUrl(rawImage, options.baseUrl),
      title,
    });
  }

  return items;
}

export function parseVisualArticleMetadata(html: string) {
  return {
    publishedAt:
      readMetaContent(html, "article:published_time") ||
      readMetaContent(html, "datePublished") ||
      readEmbeddedFirstPublishedAt(html) ||
      readVisiblePublishedDate(html),
    summary:
      decodeXml(readMetaContent(html, "og:description")) ||
      decodeXml(readMetaContent(html, "description")),
    thumbnailUrl: normalizeImageUrl(readMetaContent(html, "og:image")),
    title: decodeXml(readMetaContent(html, "og:title") || readHtmlTitle(html)),
  };
}

export function parseVisualPageItem(html: string, pageUrl: string): VisualFeedItem[] {
  const metadata = parseVisualArticleMetadata(html);
  if (!metadata.title) return [];
  return [{
    link: pageUrl,
    publishedAt: metadata.publishedAt,
    summary: metadata.summary || metadata.title,
    thumbnailUrl: metadata.thumbnailUrl,
    title: metadata.title,
  }];
}

export function parseWordPressVisualItems(payload: string): VisualFeedItem[] {
  const posts = JSON.parse(payload) as Array<{
    date_gmt?: string;
    excerpt?: { rendered?: string };
    jetpack_featured_media_url?: string;
    link?: string;
    title?: { rendered?: string };
    _embedded?: { "wp:featuredmedia"?: Array<{ source_url?: string }> };
  }>;
  if (!Array.isArray(posts)) return [];

  return posts.flatMap((post) => {
    const link = post.link?.trim();
    const title = decodeXml(post.title?.rendered || "");
    if (!link || !title) return [];
    const embeddedImage = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    return [{
      link,
      publishedAt: post.date_gmt ? `${post.date_gmt.replace(/Z$/, "")}Z` : "",
      summary: decodeXml(post.excerpt?.rendered || ""),
      thumbnailUrl: normalizeImageUrl(post.jetpack_featured_media_url || embeddedImage || ""),
      title,
    }];
  });
}

export function parseVisualSitemapItems(
  xml: string,
  options: {
    excludePathPrefixes?: readonly string[];
    includePathPrefixes: readonly string[];
  }
): VisualFeedItem[] {
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)).flatMap((match) => {
    const link = decodeXml(match[1] || "");
    if (!link) return [];
    const pathname = new URL(link).pathname;
    if (!options.includePathPrefixes.some((prefix) => pathname.startsWith(prefix))) return [];
    if (options.excludePathPrefixes?.some((prefix) => pathname.startsWith(prefix))) return [];
    const title = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) || "")
      .replace(/[-_]+/g, " ")
      .trim();
    return [{ link, publishedAt: "", summary: title, thumbnailUrl: null, title }];
  });
}

function buildVisualRadarItem({
  capturedAt,
  collectionFormat,
  feedUrl,
  item,
  source,
}: {
  capturedAt: string;
  collectionFormat: NonNullable<VisualRadarFeedConfig["format"]>;
  feedUrl: string;
  item: VisualFeedItem;
  source: VisualCultureSource;
}) {
  return createIntelItem({
    capturedAt,
    hashtags: [],
    id: `visual-${source.id}-${stableId(item.link)}`,
    keywords: [...source.topics],
    lang: source.language,
    market: source.market,
    mediaUrls: [],
    metrics: emptyIntelMetrics(),
    postedAt: normalizeDate(item.publishedAt),
    provenance: {
      authenticity: "live",
      collector:
        collectionFormat === "feed"
          ? "visual-radar-rss"
          : `visual-radar-${collectionFormat}`,
      evidenceUrl: feedUrl,
      fetchedAt: capturedAt,
      label: "真实采集",
      notes: "来自 Visual Radar 官方 Feed 或公开栏目页采集器。",
      snapshotId: null,
      sourceRecordId: item.link,
    },
    signalType: "inspiration_signal",
    source: "website",
    sourceAccount: source.label,
    sourceType: "inspiration",
    sourceUrl: item.link,
    text: item.summary || item.title,
    thumbnailUrl: item.thumbnailUrl,
    title: item.title,
  });
}

async function fetchUrlText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "user-agent": "Mozilla/5.0 VisualRadarBot/0.1",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  return response.text();
}

function readTag(block: string, tagName: string) {
  const match = block.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
  );
  return match?.[1]?.trim() || "";
}

function readAtomLink(block: string) {
  const alternate = Array.from(block.matchAll(/<link\b([^>]*)>/gi))
    .map((match) => match[1] || "")
    .find((attrs) => {
      const rel = readAttribute(attrs, "rel");
      return !rel || rel === "alternate";
    });

  return alternate ? readAttribute(alternate, "href") : "";
}

function readAttribute(attrs: string, name: string) {
  const match = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i")
  );
  return match?.[2]?.trim() || "";
}

function readMetaContent(html: string, key: string) {
  const normalizedKey = key.toLowerCase();
  for (const match of Array.from(html.matchAll(/<meta\b[^>]*>/gi))) {
    const tag = match[0];
    const metaKey = (readAttribute(tag, "property") || readAttribute(tag, "name"))
      .toLowerCase();
    if (metaKey !== normalizedKey) continue;
    const content = readAttribute(tag, "content");
    if (content) return decodeXml(content);
  }
  return "";
}

function readHtmlTitle(html: string) {
  return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
}

function readFeedImageUrl(block: string, rawSummary: string) {
  const mediaUrl = Array.from(
    block.matchAll(/<media:(?:content|thumbnail)\b([^>]*)>/gi)
  )
    .map((match) => readAttribute(match[1] || "", "url"))
    .find(Boolean);
  if (mediaUrl) return normalizeImageUrl(mediaUrl);

  const enclosureUrl = Array.from(block.matchAll(/<enclosure\b([^>]*)>/gi))
    .map((match) => match[1] || "")
    .find((attrs) => readAttribute(attrs, "type").toLowerCase().startsWith("image/"));
  if (enclosureUrl) {
    const normalized = normalizeImageUrl(readAttribute(enclosureUrl, "url"));
    if (normalized) return normalized;
  }

  const htmlImage = rawSummary.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
  return normalizeImageUrl(htmlImage || "");
}

function normalizeImageUrl(value: string): string | null {
  const decoded = value.replace(/&amp;/g, "&").trim();
  if (!decoded) return null;

  try {
    const url = new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function resolveHttpUrl(value: string, baseUrl: string) {
  if (!value || value.startsWith("#") || value.startsWith("javascript:")) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function resolveImageUrl(value: string, baseUrl: string) {
  const url = resolveHttpUrl(value, baseUrl);
  return url ? normalizeImageUrl(url) : null;
}

function readFirstSrcsetUrl(value: string) {
  return value.split(",")[0]?.trim().split(/\s+/)[0] || "";
}

function readVisiblePublishedDate(html: string) {
  return (
    html.match(
      /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\b/i
    )?.[0] || ""
  );
}

function readEmbeddedFirstPublishedAt(html: string) {
  return html.match(/\bfirst_published_at:["']([^"']+)["']/i)?.[1] || "";
}

function dateSortValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function enrichVisualHtmlItem(
  item: VisualFeedItem,
  fetchText: (url: string) => Promise<string>
) {
  try {
    const metadata = parseVisualArticleMetadata(await fetchText(item.link));
    return {
      ...item,
      publishedAt: metadata.publishedAt || item.publishedAt,
      summary: metadata.summary || item.summary,
      thumbnailUrl: metadata.thumbnailUrl || item.thumbnailUrl,
      title: metadata.title || item.title,
    };
  } catch {
    return item;
  }
}

async function collectMetCostumeItems(
  payload: string,
  fetchText: (url: string) => Promise<string>,
  limit: number
): Promise<VisualFeedItem[]> {
  const search = JSON.parse(payload) as { objectIDs?: number[] | null };
  const ids = Array.isArray(search.objectIDs)
    ? [...search.objectIDs].toSorted((left, right) => right - left).slice(0, limit * 4)
    : [];
  const items: VisualFeedItem[] = [];

  for (const id of ids) {
    if (items.length >= limit) break;
    try {
      const object = JSON.parse(
        await fetchText(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
        )
      ) as {
        artistDisplayName?: string;
        department?: string;
        objectDate?: string;
        objectName?: string;
        objectURL?: string;
        primaryImage?: string;
        primaryImageSmall?: string;
        title?: string;
      };
      if (object.department !== "The Costume Institute" || !object.objectURL) continue;
      const title = decodeXml(object.title || object.objectName || "Costume Institute object");
      items.push({
        link: object.objectURL,
        publishedAt: "",
        summary: [object.artistDisplayName, object.objectDate, object.objectName]
          .filter(Boolean)
          .join(" · "),
        thumbnailUrl: normalizeImageUrl(object.primaryImage || object.primaryImageSmall || ""),
        title,
      });
    } catch {
      // Skip incomplete public collection records and continue with the next object.
    }
  }

  return items;
}

function normalizeDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function dedupeItems(items: IntelItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.dedupKey)) return false;
    seen.add(item.dedupKey);
    return true;
  });
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
