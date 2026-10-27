import { ArrowUpRight, Expand, X } from "lucide-react";
import { useRef, useState } from "react";

import type { VisualRadarSelectedStory } from "../../lib/api";
import { Link } from "wouter";
import { archiveStoryFromSelection, creativeHint } from "../../lib/visualRadarArchive";
import { StoryActions } from "./StoryActions";
import { classifyFreshness } from "../../../../shared/visualRadarQuality";
import { EventSources } from "./EventSources";

export function visualStoryAnchor(id: string) {
  return `story-${encodeURIComponent(id)}`;
}

export function VisualStory({
  story,
  variant = "grid",
  featured = false,
  issueId,
  issueGeneratedAt,
}: {
  story: VisualRadarSelectedStory;
  variant?: "grid" | "lead";
  featured?: boolean;
  issueId?: string;
  issueGeneratedAt?: string;
}) {
  const title = story.analysis.chineseTitle || story.item.title;
  const summary = story.analysis.chineseSummary || story.item.text;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const image = story.item.thumbnailUrl;
  const hasImage = Boolean(image && failedImage !== image);
  const isLead = variant === "lead";
  const freshness = classifyFreshness(story.item, issueGeneratedAt || story.analysis.analyzedAt);
  const evidence = story.analysis.editorial;

  return (
    <article id={visualStoryAnchor(story.item.id)} tabIndex={-1} className={`vr-story vr-story-${variant}${hasImage ? "" : " vr-story-text"}`}>
      {hasImage ? (
        <button
          type="button"
          className="vr-story-media"
          onClick={() => dialog.current?.showModal()}
          aria-label={`查看完整图片：${title}`}
        >
          <img src={image!} alt={title} loading={isLead ? "eager" : "lazy"} decoding="async"
            fetchPriority={isLead ? "high" : "auto"} onError={() => setFailedImage(image!)} />
          <span className="vr-image-expand"><Expand aria-hidden="true" /> 查看全图</span>
        </button>
      ) : <div className="vr-text-marker"><span>VISUAL NOTE</span><span>{story.analysis.trendKeywords[0] || "视觉观察"}</span></div>}
      <div className="vr-story-copy">
        <div className="vr-story-meta">
          <span>{story.item.sourceAccount || "VISUAL RADAR"}</span>
          <span>{freshness.label}{freshness.kind === "latest" || freshness.kind === "reference" ? ` · ${formatDate(story.item.postedAt!)}` : freshness.kind === "upcoming" ? ` · ${formatDate(story.item.eventStartsAt!)}` : ""}</span>
          <span className="vr-quality-label">{evidence?.status === "verified" ? "有原文证据" : "解读待核验"}</span>
          {featured && <span className="vr-featured-label">编辑精选</span>}
        </div>
        {isLead ? <h2>{title}</h2> : <h3>{title}</h3>}
        <p className={isLead ? "vr-story-summary" : "vr-story-teaser"}>{isLead ? summary : (story.analysis.selectionRationale || summary)}</p>
        {!isLead && <details className="vr-story-details">
          <summary><span className="vr-details-closed">展开解读</span><span className="vr-details-open">收起解读</span></summary>
          <p>{summary}</p>
        </details>}
        {evidence?.status === "verified" && evidence.application && <div className="vr-creative-hint"><strong>可以借鉴 · 编辑建议</strong><p>{creativeHint(evidence.application)}</p></div>}
        {evidence?.status === "verified" && <details className="vr-evidence-details">
          <summary>原文事实与创作参考</summary>
          <h4>原文事实</h4>
          <ul>{evidence.facts.map((fact, index) => <li key={index}><p>{fact.statement}</p><blockquote>{fact.quote}</blockquote></li>)}</ul>
          <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">核对原文 ↗</a>
          <p className="vr-evidence-limit">核验记录：{formatDate(story.analysis.analyzedAt)}。证据可追溯不等于编辑判断已被自动验证。</p>
          <h4>视觉方法 · 编辑分析</h4><p>{evidence.visualMethod}</p>
          <h4>可以尝试 · 编辑建议</h4><p>{evidence.application}</p>
          {evidence.limitation && <p className="vr-evidence-limit">核验范围：{evidence.limitation}</p>}
        </details>}
        <div className="vr-story-footer">
          <div className="vr-keywords">
            {[...new Set([...(evidence?.visualTags || []), ...story.analysis.trendKeywords])].slice(0, 5).map((keyword) => (
              <Link href={`/issues?q=${encodeURIComponent(keyword)}&view=stories`} key={keyword}>{keyword}</Link>
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
        {isLead && story.analysis.selectionRationale ? (
          <p className="vr-rationale">
            <strong>编辑观察</strong>
            {story.analysis.selectionRationale}
          </p>
        ) : null}
        {issueId && <StoryActions story={archiveStoryFromSelection(story, issueId, featured)} />}
        {story.relatedSources && story.relatedSources.length > 0 && <details className="vr-evidence-details"><summary>同一事件的其他原文（{story.relatedSources.length}）</summary><EventSources sources={story.relatedSources} /></details>}
      </div>
      {hasImage && <dialog ref={dialog} className="vr-image-dialog" aria-label={`完整图片：${title}`}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="vr-image-dialog-inner">
          <button type="button" className="vr-dialog-close" onClick={() => dialog.current?.close()} aria-label="关闭图片"><X aria-hidden="true" /></button>
          <img src={image!} alt={title} loading="lazy" />
          <p>{title}<span>图片来源：{story.item.sourceAccount || "原文网站"}</span></p>
          <a href={story.item.sourceUrl} target="_blank" rel="noreferrer">查看原文与图片说明 ↗</a>
        </div>
      </dialog>}
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(date);
}
