import { ArrowUpRight, Loader2, Search, X } from "lucide-react";
import { Link, useSearchParams } from "wouter";
import { useEffect, useMemo, useState } from "react";

import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import {
  getVisualRadarArchive,
  type VisualRadarArchive as ArchiveData,
  visualRadarStaticMode,
} from "../lib/api";
import { ARCHIVE_TOPICS, filterArchiveStories, normalizeArchiveTopic } from "../lib/visualRadarArchive";
import { visualStoryAnchor } from "../components/visual-radar/VisualStory";

const PAGE_SIZE = 24;

export default function VisualRadarArchive() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const topic = normalizeArchiveTopic(params.get("topic"));
  const isSearching = Boolean(query.trim() || topic !== "all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const matches = useMemo(() => filterArchiveStories(archive?.stories || [], query, topic), [archive, query, topic]);
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const story of archive?.stories || []) counts[story.topic] = (counts[story.topic] || 0) + 1;
    return counts;
  }, [archive]);

  useEffect(() => {
    let active = true;
    setError(null);
    void getVisualRadarArchive()
      .then((data) => { if (active) setArchive(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "往期日报加载失败"); });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => { setShown(PAGE_SIZE); }, [query, topic]);

  function updateSearch(nextQuery: string, nextTopic: string) {
    const next = new URLSearchParams();
    if (nextQuery) next.set("q", nextQuery);
    if (nextTopic !== "all") next.set("topic", nextTopic);
    setParams(next, { replace: true });
  }

  return (
    <main className="vr-root">
      <VisualRadarMasthead
        issueLabel="ARCHIVE"
        showSources={!visualRadarStaticMode}
      />
      <section className="vr-archive">
        <header className="vr-archive-heading">
          <div><p>THE ARCHIVE</p><h1>往期日报</h1></div>
          <p>从每天的发现中，找到下一次创作的线索。<br />
            {archive && <span>{archive.issues.length} 期日报 · {archive.stories.length} 条内容</span>}
          </p>
        </header>
        <div className="vr-archive-controls">
          <label className="vr-archive-search">
            <Search aria-hidden="true" />
            <input type="search" aria-label="搜索往期内容" placeholder="搜索创作者、品牌、布光、材质……"
              value={query} onChange={(event) => updateSearch(event.target.value, topic)} />
          </label>
          <div className="vr-archive-topics" role="group" aria-label="内容分类">
            <button type="button" aria-pressed={topic === "all"} onClick={() => updateSearch(query, "all")}>全部</button>
            {Object.entries(ARCHIVE_TOPICS).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={topic === key} onClick={() => updateSearch(query, key)}>
                {label}{archive && <small>{topicCounts[key] || 0}</small>}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="vr-archive-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div>}
        {!error && !archive && <div className="vr-message"><Loader2 className="vr-spin" /> 正在加载档案</div>}
        {!error && archive && <>
          <div className="vr-archive-results-heading">
            <p role="status">{isSearching ? `找到 ${matches.length} 条内容` : `全部 ${archive.issues.length} 期 · 按日期排列`}</p>
            {isSearching && <button type="button" onClick={() => updateSearch("", "all")}><X aria-hidden="true" /> 清除筛选</button>}
          </div>
          {isSearching ? (
            matches.length > 0 ? <>
              <div className="vr-archive-grid">
                {matches.slice(0, shown).map((story) => (
                  <article className="vr-archive-card" key={`${story.issueId}-${story.id}`}>
                    <Link href={`/issues/${story.issueId}#${visualStoryAnchor(story.id)}`} className="vr-archive-card-link">
                      <ArchiveImage src={story.thumbnailUrl} label={ARCHIVE_TOPICS[story.topic]} />
                      <div className="vr-archive-card-meta"><span>{story.issueDate}</span><span>{ARCHIVE_TOPICS[story.topic]}</span></div>
                      <h2>{story.title}</h2>
                      <p className="vr-archive-excerpt">{story.summary}</p>
                      <div className="vr-archive-card-footer"><span>{story.source}</span><ArrowUpRight aria-hidden="true" /></div>
                    </Link>
                    <div className="vr-archive-keywords">{story.keywords.slice(0, 3).map((keyword) => (
                      <button type="button" key={keyword} onClick={() => updateSearch(keyword, "all")}>#{keyword}</button>
                    ))}</div>
                  </article>
                ))}
              </div>
              {matches.length > shown && <button className="vr-archive-more" type="button" onClick={() => setShown((value) => value + PAGE_SIZE)}>继续浏览 · 还有 {matches.length - shown} 条</button>}
            </> : <div className="vr-archive-empty"><h2>暂时没有匹配内容</h2><p>试试更短的关键词，或切换到“全部”。</p><button type="button" onClick={() => updateSearch("", "all")}>返回全部日报</button></div>
          ) : archive.issues.length > 0 ? (
            <div className="vr-archive-grid">
              {archive.issues.map((issue, index) => (
                <article className="vr-archive-card" key={issue.id}>
                  <Link href={`/issues/${issue.id}`} className="vr-archive-card-link" aria-label={`打开 ${issue.issueDate} 摄影推送`}>
                    <ArchiveImage src={issue.coverImage} label="摄影推送" />
                    <div className="vr-archive-card-meta"><span>{issue.issueDate}</span><span>{index === 0 ? "最新一期" : `NO. ${String(archive.issues.length - index).padStart(2, "0")}`}</span></div>
                    <h2>{issue.coverTitle}</h2>
                    <p className="vr-archive-topic-line">{issue.topics.slice(0, 4).map((key) => ARCHIVE_TOPICS[key]).join(" / ")}</p>
                    <div className="vr-archive-card-footer"><span>{issue.storyCount} 篇报道</span><span>阅读本期 <ArrowUpRight aria-hidden="true" /></span></div>
                  </Link>
                </article>
              ))}
            </div>
          ) : <div className="vr-archive-empty"><h2>档案即将开始</h2><p>第一期摄影推送发布后，会出现在这里。</p></div>}
        </>}
      </section>
    </main>
  );
}

function ArchiveImage({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={`vr-archive-image${!src || failed === src ? " vr-archive-image-empty" : ""}`}>
    {src && failed !== src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      : <><span>VISUAL RADAR</span><strong>{label}</strong><small>NOTES ON VISUAL CULTURE</small></>}
  </div>;
}
