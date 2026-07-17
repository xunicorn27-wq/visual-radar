import { describe, expect, it } from "vitest";

import {
  collectVisualRadarItems,
  DEFAULT_VISUAL_RADAR_FEEDS,
  parseVisualArticleMetadata,
  parseVisualHtmlItems,
  parseVisualFeedItems,
  parseVisualPageItem,
  parseVisualSitemapItems,
  parseWordPressVisualItems,
} from "./visualRadarCollector";

const rssSample = `<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <item>
    <title><![CDATA[Street style shapes a summer silhouette]]></title>
    <link>https://example.com/story?utm_source=test</link>
    <pubDate>Tue, 14 Jul 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[A concise visual culture summary.]]></description>
    <media:content url="https://images.example.com/street-style.jpg" medium="image" />
  </item>
</channel></rss>`;

const atomSample = `<?xml version="1.0"?>
<feed>
  <entry>
    <title>Dazed visual dispatch</title>
    <link href="https://example.com/dazed-entry" />
    <updated>2026-07-14T08:00:00Z</updated>
    <summary><![CDATA[<img src="https://images.example.com/dazed.jpg" />Fashion culture note from the feed.]]></summary>
  </entry>
</feed>`;

const htmlSample = `<!doctype html><html><body>
  <a href="/fashion-shows/designer/resort-2027">
    <img src="https://images.example.com/runway.jpg" />
    <span>Designer Resort 2027</span>
  </a>
  <a href="/fashion-shows/designers">Designers</a>
  <a href="/fashion-shows/designer/resort-2027">Designer Resort 2027</a>
</body></html>`;

describe("parseVisualFeedItems", () => {
  it("parses RSS items and normalizes text fields", () => {
    expect(parseVisualFeedItems(rssSample)).toEqual([
      {
        link: "https://example.com/story?utm_source=test",
        publishedAt: "Tue, 14 Jul 2026 10:00:00 GMT",
        summary: "A concise visual culture summary.",
        thumbnailUrl: "https://images.example.com/street-style.jpg",
        title: "Street style shapes a summer silhouette",
      },
    ]);
  });

  it("parses Atom entries with href links", () => {
    expect(parseVisualFeedItems(atomSample)).toEqual([
      {
        link: "https://example.com/dazed-entry",
        publishedAt: "2026-07-14T08:00:00Z",
        summary: "Fashion culture note from the feed.",
        thumbnailUrl: "https://images.example.com/dazed.jpg",
        title: "Dazed visual dispatch",
      },
    ]);
  });
});

describe("parseVisualHtmlItems", () => {
  it("extracts unique matching editorial links and images", () => {
    expect(
      parseVisualHtmlItems(htmlSample, {
        baseUrl: "https://www.vogue.com/fashion-shows",
        excludePathPrefixes: ["/fashion-shows/designers"],
        includePathPrefixes: ["/fashion-shows/"],
      })
    ).toEqual([
      {
        link: "https://www.vogue.com/fashion-shows/designer/resort-2027",
        publishedAt: "",
        summary: "Designer Resort 2027",
        thumbnailUrl: "https://images.example.com/runway.jpg",
        title: "Designer Resort 2027",
      },
    ]);
  });
});

describe("parseVisualArticleMetadata", () => {
  it("reads Open Graph image, description, title, and published time", () => {
    expect(
      parseVisualArticleMetadata(`
        <meta property="og:title" content="Full editorial title" />
        <meta property="og:description" content="Full editorial description" />
        <meta property="og:image" content="https://images.example.com/full.jpg" />
        <meta property="article:published_time" content="2026-07-16T04:00:00Z" />
      `)
    ).toEqual({
      publishedAt: "2026-07-16T04:00:00Z",
      summary: "Full editorial description",
      thumbnailUrl: "https://images.example.com/full.jpg",
      title: "Full editorial title",
    });
  });

  it("prefers M+ first_published_at over dates mentioned in article copy", () => {
    expect(
      parseVisualArticleMetadata(
        `first_published_at:"2026-07-10T16:58:38+08:00" on view through 30 August 2026`
      ).publishedAt
    ).toBe("2026-07-10T16:58:38+08:00");
  });

  it("skips malformed meta tags instead of scanning across the document", () => {
    const malformed = `<meta property="og:title" content="${"x".repeat(50_000)}`;
    const valid = `<meta content="Stable official title" property="og:title" />`;

    expect(parseVisualArticleMetadata(`${malformed}<main>content</main>${valid}`).title)
      .toBe("Stable official title");
  });
});

describe("parseVisualPageItem", () => {
  it("turns an official product update page into one traceable item", () => {
    expect(
      parseVisualPageItem(
        `<title>What's New in DaVinci Resolve 21</title>
         <meta property="og:description" content="The latest official editing update." />
         <meta property="og:image" content="https://images.example.com/resolve.jpg" />`,
        "https://www.blackmagicdesign.com/products/davinciresolve/whatsnew"
      )
    ).toEqual([
      {
        link: "https://www.blackmagicdesign.com/products/davinciresolve/whatsnew",
        publishedAt: "",
        summary: "The latest official editing update.",
        thumbnailUrl: "https://images.example.com/resolve.jpg",
        title: "What's New in DaVinci Resolve 21",
      },
    ]);
  });
});

describe("parseWordPressVisualItems", () => {
  it("converts official WordPress API posts to visual items", () => {
    expect(
      parseWordPressVisualItems(
        JSON.stringify([
          {
            date_gmt: "2026-07-14T20:18:38",
            excerpt: { rendered: "<p>A photography essay.</p>" },
            jetpack_featured_media_url: "https://images.example.com/aperture.jpg",
            link: "https://aperture.org/editorial/photo-essay/",
            title: { rendered: "Aperture Photo Essay" },
          },
        ])
      )
    ).toEqual([
      {
        link: "https://aperture.org/editorial/photo-essay/",
        publishedAt: "2026-07-14T20:18:38Z",
        summary: "A photography essay.",
        thumbnailUrl: "https://images.example.com/aperture.jpg",
        title: "Aperture Photo Essay",
      },
    ]);
  });
});

describe("parseVisualSitemapItems", () => {
  it("extracts matching detail URLs and excludes section indexes", () => {
    expect(
      parseVisualSitemapItems(
        `<urlset><url><loc>https://museum.example/en/exhibitions/show-one</loc></url><url><loc>https://museum.example/en/exhibitions/archive</loc></url></urlset>`,
        {
          excludePathPrefixes: ["/en/exhibitions/archive"],
          includePathPrefixes: ["/en/exhibitions/"],
        }
      )
    ).toEqual([
      {
        link: "https://museum.example/en/exhibitions/show-one",
        publishedAt: "",
        summary: "show one",
        thumbnailUrl: null,
        title: "show one",
      },
    ]);
  });
});

describe("collectVisualRadarItems", () => {
  it("configures verified official visual sources without the blocked Frame.io page", () => {
    expect(DEFAULT_VISUAL_RADAR_FEEDS.map((feed) => feed.sourceId)).toEqual([
      "dazed",
      "wallpaper",
      "bjp-1854",
      "fashionsnap",
      "ginza",
      "id-magazine",
      "another-magazine",
      "interview-magazine",
      "nowness",
      "its-nice-that",
      "lensculture",
      "vogue-singapore",
      "british-vogue",
      "vogue-japan",
      "vogue-korea",
      "w-korea",
      "w-magazine",
      "vogue-runway",
      "photovogue",
      "mplus",
      "aperture",
      "icp",
      "vam-fashion",
      "momu",
      "palais-galliera",
      "tokyo-photo-museum",
      "met-costume-institute",
      "adobe-news",
      "capture-one",
      "blackmagic-resolve",
      "runway",
      "topaz-labs",
      "aputure",
      "profoto",
    ]);
    expect(DEFAULT_VISUAL_RADAR_FEEDS.map((feed) => feed.sourceId)).not.toContain(
      "frame-io"
    );
  });

  it("collects live visual culture items from configured feeds", async () => {
    const artifact = await collectVisualRadarItems({
      fetchText: async () => rssSample,
      generatedAt: "2026-07-15T10:00:00.000Z",
      limitPerSource: 1,
      sources: [
        {
          feedUrl: "https://example.com/feed.xml",
          sourceId: "dazed",
        },
      ],
    });

    expect(artifact.schemaVersion).toBe("1");
    expect(artifact.items).toHaveLength(1);
    expect(artifact.items[0]).toMatchObject({
      capturedAt: "2026-07-15T10:00:00.000Z",
      lang: "en",
      market: "EU",
      provenance: {
        authenticity: "live",
        collector: "visual-radar-rss",
        evidenceUrl: "https://example.com/feed.xml",
        label: "真实采集",
      },
      signalType: "inspiration_signal",
      source: "website",
      sourceAccount: "Dazed",
      sourceType: "inspiration",
      sourceUrl: "https://example.com/story?utm_source=test",
      thumbnailUrl: "https://images.example.com/street-style.jpg",
      title: "Street style shapes a summer silhouette",
    });
    expect(artifact.items[0]?.dedupKey).toBe("example.com/story");
    expect(artifact.failures).toEqual([]);
  });

  it("collects independent sources concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const artifact = await collectVisualRadarItems({
      fetchText: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return rssSample;
      },
      sources: [
        { feedUrl: "https://example.com/dazed.xml", sourceId: "dazed" },
        { feedUrl: "https://example.com/wallpaper.xml", sourceId: "wallpaper" },
      ],
    });

    expect(maxActive).toBe(2);
    expect(artifact.failures).toEqual([]);
  });
});
