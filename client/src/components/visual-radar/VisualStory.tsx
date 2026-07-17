import { ArrowUpRight } from "lucide-react";

import type { VisualRadarSelectedStory } from "../../lib/api";

export function VisualStory({
  story,
  variant = "grid",
}: {
  story: VisualRadarSelectedStory;
  variant?: "grid" | "lead";
}) {
  const title = story.analysis.chineseTitle || story.item.title;
  const summary = story.analysis.chineseSummary || story.item.text;

  return (
    <article className={`vr-story vr-story-${variant}`}>
      {story.item.thumbnailUrl ? (
        <a
          className="vr-story-media"
          href={story.item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`打开原文：${title}`}
        >
          <img src={story.item.thumbnailUrl} alt="" loading="eager" decoding="async" />
        </a>
      ) : null}
      <div className="vr-story-copy">
        <div className="vr-story-meta">
          <span>{story.item.sourceAccount || "VISUAL RADAR"}</span>
          <span>{formatDate(story.item.postedAt || story.item.capturedAt)}</span>
          <strong>{story.analysis.score}</strong>
        </div>
        <h2>{title}</h2>
        <p>{summary}</p>
        <div className="vr-story-footer">
          <div className="vr-keywords">
            {story.analysis.trendKeywords.slice(0, 3).map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
          <a
            className="vr-source-link"
            href={story.item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`在新窗口打开 ${title}`}
          >
            原文
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        {story.analysis.selectionRationale ? (
          <p className="vr-rationale">
            <strong>编辑观察</strong>
            {story.analysis.selectionRationale}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}
