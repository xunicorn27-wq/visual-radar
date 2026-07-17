import { describe, expect, it } from "vitest";

import { VISUAL_CULTURE_SOURCES } from "./visualCultureSourceCatalog";
import type { VisualCultureSource } from "./visualCultureSources";
import {
  summarizeVisualCultureSources,
  validateVisualCultureSourceCatalog,
} from "./visualCultureSources";

function source(
  overrides: Partial<VisualCultureSource> = {}
): VisualCultureSource {
  return {
    collectionMode: "official_page",
    id: "example-source",
    label: "Example Source",
    language: "en",
    market: "global",
    priority: 1,
    region: "europe_america",
    role: "editorial",
    sourceUrl: "https://example.com",
    topics: ["creator"],
    ...overrides,
  };
}

describe("validateVisualCultureSourceCatalog", () => {
  it("accepts a valid unique non-Chinese HTTPS catalog", () => {
    const sources = [
      source(),
      source({
        id: "second-source",
        language: "ja",
        market: "JP",
        region: "japan_korea",
        sourceUrl: "https://example.jp",
        topics: ["magazine", "photography"],
      }),
    ];

    expect(validateVisualCultureSourceCatalog(sources)).toEqual([]);
  });

  it("reports duplicate ids, Chinese language, and non-HTTPS URLs", () => {
    const sources = [
      source(),
      source({
        id: "example-source",
        language: "zh",
        sourceUrl: "http://example.cn",
      }),
    ];

    expect(validateVisualCultureSourceCatalog(sources)).toEqual([
      "duplicate source id: example-source",
      "Chinese-language source is not allowed: example-source",
      "source URL must use HTTPS: example-source",
    ]);
  });

  it("requires at least one topic", () => {
    expect(
      validateVisualCultureSourceCatalog([source({ topics: [] })])
    ).toEqual(["source topics are required: example-source"]);
  });
});

describe("summarizeVisualCultureSources", () => {
  it("counts languages, regions, topics, planned sources, and total sources", () => {
    const sources = [
      source({ topics: ["creator", "fashion_culture"] }),
      source({
        id: "styling-source",
        topics: ["fashion_culture", "styling"],
      }),
    ];

    expect(summarizeVisualCultureSources(sources)).toEqual({
      byLanguage: { en: 2 },
      byRegion: { europe_america: 2 },
      byTopic: { creator: 1, fashion_culture: 2, styling: 1 },
      planned: 2,
      total: 2,
    });
  });
});

describe("VISUAL_CULTURE_SOURCES", () => {
  it("contains exactly 41 approved sources", () => {
    expect(VISUAL_CULTURE_SOURCES).toHaveLength(41);
  });

  it("contains exactly the approved source ids", () => {
    expect(VISUAL_CULTURE_SOURCES.map(source => source.id).sort()).toEqual([
      "032c",
      "adobe-news",
      "another-magazine",
      "aperture",
      "aputure",
      "bjp-1854",
      "blackmagic-resolve",
      "british-vogue",
      "capture-one",
      "dazed",
      "document-journal",
      "fashionsnap",
      "frame-io",
      "gentlewoman",
      "ginza",
      "icp",
      "id-magazine",
      "interview-magazine",
      "its-nice-that",
      "lensculture",
      "met-costume-institute",
      "momu",
      "mplus",
      "nowness",
      "palais-galliera",
      "photovogue",
      "profoto",
      "purple",
      "runway",
      "singapore-art-museum",
      "the-face",
      "tokyo-photo-museum",
      "topaz-labs",
      "vam-fashion",
      "vogue-japan",
      "vogue-korea",
      "vogue-runway",
      "vogue-singapore",
      "w-korea",
      "w-magazine",
      "wallpaper",
    ]);
  });

  it("freezes the catalog, every source, and every topics array", () => {
    expect(Object.isFrozen(VISUAL_CULTURE_SOURCES)).toBe(true);
    expect(
      VISUAL_CULTURE_SOURCES.every(source => Object.isFrozen(source))
    ).toBe(true);
    expect(
      VISUAL_CULTURE_SOURCES.every(source => Object.isFrozen(source.topics))
    ).toBe(true);
  });

  it("passes catalog validation", () => {
    expect(validateVisualCultureSourceCatalog(VISUAL_CULTURE_SOURCES)).toEqual(
      []
    );
  });

  it("keeps at least 65 percent of sources in Europe and America", () => {
    const europeAmericaSources = VISUAL_CULTURE_SOURCES.filter(
      source => source.region === "europe_america"
    );

    expect(
      europeAmericaSources.length / VISUAL_CULTURE_SOURCES.length
    ).toBeGreaterThanOrEqual(0.65);
  });

  it("covers exactly the approved topic set", () => {
    const topics = new Set(
      VISUAL_CULTURE_SOURCES.flatMap(source => source.topics)
    );

    expect(topics).toEqual(
      new Set([
        "creator",
        "exhibition",
        "fashion_culture",
        "magazine",
        "outfit",
        "photography",
        "styling",
        "tool",
      ])
    );
  });

  it("uses unique source ids", () => {
    const ids = VISUAL_CULTURE_SOURCES.map(source => source.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("third-batch tool source addresses", () => {
  it("uses the current official Aputure and Profoto pages", () => {
    const byId = new Map(VISUAL_CULTURE_SOURCES.map((source) => [source.id, source]));

    expect(byId.get("aputure")?.sourceUrl).toBe(
      "https://aputure.com/en-US/pages/blog"
    );
    expect(byId.get("profoto")?.sourceUrl).toBe(
      "https://www.profoto.com/gb/en/still-photography/profoto-stories/"
    );
  });
});
