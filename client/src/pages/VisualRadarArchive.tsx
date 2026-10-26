import { ArrowUpRight, Download, Loader2, Search, X } from "lucide-react";
import { Link, useSearchParams } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { useEffect, useMemo, useRef, useState } from "react";

import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import {
  getVisualRadarArchive,
  type VisualRadarArchive as ArchiveData,
  visualRadarStaticMode,
} from "../lib/api";
import { ARCHIVE_TOPICS, filterArchiveStories, normalizeArchiveTopic, normalizeArchiveMonth, normalizeArchiveSort, sortArchiveStories } from "../lib/visualRadarArchive";
import { visualStoryAnchor } from "../components/visual-radar/VisualStory";
import { StoryActions } from "../components/visual-radar/StoryActions";
import { libraryMarkdown, libraryStoryKey, libraryStore, useVisualRadarLibrary } from "../lib/visualRadarLibrary";
import { archiveCardAnchor, readReaderReturn, type ReaderReturn } from "../lib/readerNavigation";
import { usePageMeta } from "../lib/usePageMeta";

const PAGE_SIZE = 24;

export function VisualRadarSaved() { return <ArchiveBrowser savedOnly />; }
export default function VisualRadarArchive() { return <ArchiveBrowser />; }

function ArchiveBrowser({ savedOnly = false }: { savedOnly?: boolean }) {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [params, setParams] = useSearchParams();
  const historyState = useHistoryState();
  const restoredPosition = useRef("");
  const restored = useMemo(() => readReaderReturn(historyState?.visualRadarRestore), [historyState]);
  const browserHref = `${savedOnly ? "/saved" : "/issues"}${params.size ? `?${params.toString()}` : ""}`;
  const query = params.get("q") || "";
  const topic = normalizeArchiveTopic(params.get("topic"));
  const month = normalizeArchiveMonth(params.get("month"));
  const sort = normalizeArchiveSort(params.get("sort"), savedOnly);
  const hasFilters = Boolean(query.trim() || topic !== "all" || month !== "all");
  const storyView = savedOnly || hasFilters || params.get("view") === "stories";
  const library = useVisualRadarLibrary();
  const [exportError, setExportError] = useState("");
  const savedEntries = useMemo(() => library.entries.filter((entry) => entry.saved), [library.entries]);
  const entryByKey = useMemo(() => new Map(library.entries.map((entry) => [libraryStoryKey(entry.story), entry])), [library.entries]);
  const sourceStories = useMemo(() => savedOnly ? savedEntries.map((entry) => entry.story) : archive?.stories || [], [savedOnly, savedEntries, archive]);
  const [shown, setShown] = useState(() => restored?.href === browserHref ? restored.shown : PAGE_SIZE);
  usePageMeta(savedOnly ? "我的收藏" : "往期日报", savedOnly ? "保存在本机的 Visual Radar 收藏与个人备注。" : "按主题、月份和关键词探索 Visual Radar 往期摄影推送。");
  const months = useMemo(() => [...new Set(sourceStories.map((story) => story.issueDate.slice(0, 7)))].sort().reverse(), [sourceStories]);
  const matches = useMemo(() => sortArchiveStories(
    filterArchiveStories(sourceStories, query, topic, (story) => savedOnly ? entryByKey.get(libraryStoryKey(story))?.note || "" : "")
      .filter((story) => month === "all" || story.issueDate.startsWith(month)), sort,
    new Map(savedEntries.map((entry) => [libraryStoryKey(entry.story), entry.savedAt])),
  ), [sourceStories, query, topic, month, sort, savedOnly, entryByKey, savedEntries]);
  const editions = useMemo(() => [...(archive?.issues || [])].sort((a, b) => sort === "oldest" ? a.issueDate.localeCompare(b.issueDate) : b.issueDate.localeCompare(a.issueDate)), [archive, sort]);
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const story of sourceStories) counts[story.topic] = (counts[story.topic] || 0) + 1;
    return counts;
  }, [sourceStories]);

  useEffect(() => {
    if (savedOnly) return;
    let active = true;
    setError(null);
    void getVisualRadarArchive()
      .then((data) => { if (active) setArchive(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "往期日报加载失败"); });
    return () => { active = false; };
  }, [retry, savedOnly]);

  useEffect(() => { setShown(restored?.href === browserHref ? restored.shown : PAGE_SIZE); }, [browserHref, restored]);
  useEffect(() => {
    if (!savedOnly && !archive) return;
    const restoreKey = restored ? `${restored.href}#${restored.anchor}` : "";
    if (restoreKey && restoredPosition.current === restoreKey) return;
    const frame = requestAnimationFrame(() => {
      const target = restored?.href === browserHref ? document.getElementById(restored.anchor) : null;
      if (target) { target.scrollIntoView({ block: "start" }); target.focus({ preventScroll: true }); restoredPosition.current = restoreKey; }
    });
    return () => cancelAnimationFrame(frame);
  }, [archive, savedOnly, restored, browserHref, shown]);

  function returnContext(anchor: string): ReaderReturn {
    return { href: browserHref, label: savedOnly ? "返回我的收藏" : "返回浏览结果", anchor, shown };
  }
  function rememberPosition(anchor: string) {
    // Kept in this tab's history, never in the shared article URL.
    window.history.replaceState({ ...window.history.state, visualRadarRestore: returnContext(anchor) }, "");
  }

  function updateSearch(nextQuery: string, nextTopic: string) {
    updateParams({ q: nextQuery, topic: nextTopic === "all" ? "" : nextTopic });
  }
  function updateParams(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    setParams(next, { replace: true });
  }
  function clearFilters() { setParams(new URLSearchParams(), { replace: true }); }
  function exportSaved() {
    try {
      const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      const content = libraryMarkdown(matches.flatMap((story) => {
        const entry = entryByKey.get(libraryStoryKey(story));
        return entry ? [entry] : [];
      }), base);
      const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `Visual-Radar-收藏-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportError("");
    } catch { setExportError("导出未完成，请重试或复制备注保存。"); }
  }

  return (
    <main className="vr-root">
      <VisualRadarMasthead
        issueLabel={savedOnly ? "MY COLLECTION" : "ARCHIVE"}
        showSources={!visualRadarStaticMode}
      />
      <section className="vr-archive">
        <header className="vr-archive-heading">
          <div><p>{savedOnly ? "MY COLLECTION" : "THE ARCHIVE"}</p><h1>{savedOnly ? "我的收藏" : "往期日报"}</h1></div>
          <p>{savedOnly ? "留下值得回看的作品，写下自己的想法。" : "从每天的发现中，找到下一次创作的线索。"}<br />
            {savedOnly ? <span>{savedEntries.length} 条收藏 · {savedEntries.filter((entry) => entry.note.trim()).length} 条备注</span> : archive && <span>{archive.issues.length} 期日报 · {archive.stories.length} 条内容</span>}
          </p>
        </header>
        {savedOnly && <div className="vr-library-notice"><p>收藏与备注仅保存在当前浏览器，不会上传。清理网站数据后会丢失；本地预览与正式网站独立保存，暂不跨设备同步。</p>
          <button type="button" onClick={exportSaved} disabled={!matches.length}><Download aria-hidden="true" />导出当前结果（含备注）</button>
        </div>}
        {library.error && <div className="vr-storage-error" role="alert"><p>{library.error}</p><button type="button" onClick={() => libraryStore.refresh()}>重试读取</button></div>}
        {exportError && <p role="alert" className="vr-action-error">{exportError}</p>}
        <div className="vr-archive-controls">
          <label className="vr-archive-search">
            <Search aria-hidden="true" />
            <input type="search" aria-label={savedOnly ? "搜索收藏与备注" : "搜索往期内容"} placeholder={savedOnly ? "搜索收藏内容或我的备注……" : "搜索创作者、品牌、布光、材质……"}
              value={query} onChange={(event) => updateSearch(event.target.value, topic)} />
          </label>
          <div className="vr-archive-topics" role="group" aria-label="内容分类">
            <button type="button" aria-pressed={topic === "all"} onClick={() => updateSearch(query, "all")}>全部</button>
            {Object.entries(ARCHIVE_TOPICS).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={topic === key} onClick={() => updateSearch(query, key)}>
                {label}{(savedOnly || archive) && <small>{topicCounts[key] || 0}</small>}
              </button>
            ))}
          </div>
          <div className="vr-archive-options">
            <label>日报月份<select aria-label="日报月份" value={month} onChange={(event) => updateParams({ month: event.target.value === "all" ? "" : event.target.value })}>
              <option value="all">全部月份</option>
              {month !== "all" && !months.includes(month) && <option value={month}>{month}（暂无内容）</option>}
              {months.map((value) => <option value={value} key={value}>{value.replace("-", " 年 ")} 月</option>)}
            </select></label>
            <label>排序<select aria-label="内容排序" value={sort} onChange={(event) => updateParams({ sort: event.target.value })}>
              {savedOnly && <option value="saved">最近收藏</option>}<option value="newest">日报从新到旧</option><option value="oldest">日报从旧到新</option>
            </select></label>
            {!savedOnly && <div className="vr-view-switch" role="group" aria-label="浏览方式">
              <button type="button" aria-pressed={!storyView} onClick={() => { clearFilters(); }}>按期浏览</button>
              <button type="button" aria-pressed={storyView} onClick={() => updateParams({ view: "stories" })}>按内容浏览</button>
            </div>}
          </div>
        </div>
        {!savedOnly && error && <div className="vr-archive-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div>}
        {!savedOnly && !error && !archive && <div className="vr-message"><Loader2 className="vr-spin" /> 正在加载档案</div>}
        {(savedOnly || (!error && archive)) && <>
          <div className="vr-archive-results-heading">
            <p role="status">{storyView ? `找到 ${matches.length} 条${savedOnly ? "收藏" : "内容"}` : `全部 ${editions.length} 期 · 按日期排列`}</p>
            {hasFilters && <button type="button" onClick={clearFilters}><X aria-hidden="true" /> 清除筛选</button>}
          </div>
          {storyView ? (
            matches.length > 0 ? <>
              <div className="vr-archive-grid">
                {matches.slice(0, shown).map((story) => (
                  <article className="vr-archive-card" key={`${story.issueId}-${story.id}`} tabIndex={-1} id={archiveCardAnchor(story.issueId, story.id)}>
                    <Link href={`/issues/${story.issueId}#${visualStoryAnchor(story.id)}`} className="vr-archive-card-link"
                      state={{ visualRadarReturn: returnContext(archiveCardAnchor(story.issueId, story.id)) }}
                      onClick={() => rememberPosition(archiveCardAnchor(story.issueId, story.id))}>
                      <ArchiveImage src={story.thumbnailUrl} label={ARCHIVE_TOPICS[story.topic]} />
                      <div className="vr-archive-card-meta"><span>{story.issueDate}</span><span>{ARCHIVE_TOPICS[story.topic]}</span></div>
                      <h2>{story.title}</h2>
                      <p className="vr-archive-excerpt">{story.summary}</p>
                      <div className="vr-archive-card-footer"><span>{story.source}</span><ArrowUpRight aria-hidden="true" /></div>
                    </Link>
                    <div className="vr-archive-keywords">{story.keywords.slice(0, 3).map((keyword) => (
                      <button type="button" key={keyword} onClick={() => updateSearch(keyword, "all")}>#{keyword}</button>
                    ))}</div>
                    {savedOnly && entryByKey.get(libraryStoryKey(story))?.note && <div className="vr-saved-note"><strong>我的备注</strong><p>{entryByKey.get(libraryStoryKey(story))!.note}</p></div>}
                    <StoryActions story={story} />
                  </article>
                ))}
              </div>
              {matches.length > shown && <button className="vr-archive-more" type="button" onClick={() => setShown((value) => value + PAGE_SIZE)}>继续浏览 · 还有 {matches.length - shown} 条</button>}
            </> : savedOnly && savedEntries.length === 0 ? <div className="vr-archive-empty"><h2>给下一次创作留点线索</h2><p>在日报或搜索结果中点击“收藏”，喜欢的内容就会出现在这里。</p><Link className="vr-empty-link" href="/issues?view=stories">去发现内容 ↗</Link></div>
              : <div className="vr-archive-empty"><h2>暂时没有匹配内容</h2><p>试试更短的关键词，或切换到“全部”。</p><button type="button" onClick={clearFilters}>清除筛选</button></div>
          ) : editions.length > 0 ? (
            <div className="vr-archive-grid">
              {editions.map((issue) => (
                <article className="vr-archive-card" key={issue.id} tabIndex={-1} id={archiveCardAnchor(issue.id)}>
                  <Link href={`/issues/${issue.id}`} className="vr-archive-card-link" aria-label={`打开 ${issue.issueDate} 摄影推送`}
                    state={{ visualRadarReturn: returnContext(archiveCardAnchor(issue.id)) }}
                    onClick={() => rememberPosition(archiveCardAnchor(issue.id))}>
                    <ArchiveImage src={issue.coverImage} label="摄影推送" />
                    <div className="vr-archive-card-meta"><span>{issue.issueDate}</span><span>{issue.id === archive?.issues[0]?.id ? "最新一期" : `NO. ${String((archive?.issues.length || 0) - (archive?.issues.findIndex((item) => item.id === issue.id) || 0)).padStart(2, "0")}`}</span></div>
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
