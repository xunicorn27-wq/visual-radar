import { Link, useRoute } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import { VisualStory, visualStoryAnchor } from "../components/visual-radar/VisualStory";
import {
  getVisualRadarIssue,
  type VisualRadarIssue as VisualRadarIssueData,
  type VisualRadarIssueDetail,
  visualRadarStaticMode,
} from "../lib/api";
import { buildVisualRadarIssueLayout } from "../lib/visualRadarIssueLayout";
import { readReaderReturn } from "../lib/readerNavigation";
import { usePageMeta } from "../lib/usePageMeta";
import { ShareLink } from "../components/visual-radar/ShareLink";
import { ReaderTools } from "../components/visual-radar/ReaderTools";

export default function VisualRadarIssue() {
  const [, params] = useRoute("/issues/:issueId");
  const [detail, setDetail] = useState<VisualRadarIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const historyState = useHistoryState();
  const returnTo = readReaderReturn(historyState?.visualRadarReturn);
  usePageMeta(params?.issueId ? `${params.issueId} 摄影推送` : "摄影推送", detail ? `本期 ${detail.issue.stats.storyCount} 篇摄影、造型与创作观察。` : "Visual Radar 摄影推送，阅读本期精选与完整报道。");

  useEffect(() => {
    if (!params?.issueId) return;
    let active = true;
    setDetail(null);
    setError(null);
    void getVisualRadarIssue(params.issueId)
      .then((result) => { if (active) setDetail(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "日报加载失败"); });
    return () => { active = false; };
  }, [params?.issueId, retry]);

  if (error) {
    return (
      <main className="vr-root">
        <VisualRadarMasthead showSources={!visualRadarStaticMode} />
        <div className="vr-load-error" role="alert"><h1 id="main-content" tabIndex={-1}>这期暂时没有打开</h1><p>{error}</p>
          <div><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button><Link href="/issues">浏览往期日报</Link></div>
        </div>
      </main>
    );
  }
  if (!detail || detail.issue.id !== params?.issueId) {
    return (
      <main className="vr-root">
        <VisualRadarMasthead showSources={!visualRadarStaticMode} />
        <div id="main-content" tabIndex={-1} className="vr-message" role="status" aria-live="polite"><Loader2 className="vr-spin" aria-hidden="true" /> 正在加载日报</div>
      </main>
    );
  }

  return (
    <main className="vr-root">
      <VisualRadarMasthead
        issueLabel={`VOL.${detail.issue.id}`}
        showSources={!visualRadarStaticMode}
      />
      <div className="vr-reader-return"><Link href={returnTo?.href || "/issues"} state={returnTo ? { visualRadarRestore: returnTo } : undefined}>
        <ArrowLeft aria-hidden="true" />{returnTo?.label || "往期日报"}
      </Link></div>
      <VisualRadarIssueContent issue={detail.issue} />
      <IssueNavigation detail={detail} />
    </main>
  );
}

export function VisualRadarIssueContent({ issue }: { issue: VisualRadarIssueData }) {
  const layout = useMemo(() => buildVisualRadarIssueLayout(issue), [issue]);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Deep links from archive search arrive before the async issue has rendered.
    const frame = requestAnimationFrame(() => {
      const hash = window.location.hash.slice(1);
      if (!hash) { window.scrollTo({ top: 0 }); return; }
      let id: string;
      try { id = decodeURIComponent(hash); } catch { return; }
      const target = document.getElementById(hash) || document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: "start" });
        if (target.matches("article")) target.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [issue.id]);
  if (!layout.lead) return <section className="vr-empty"><h1 id="main-content" tabIndex={-1}>本期暂无内容</h1><p>可以到往期日报继续浏览。</p><Link href="/issues">往期日报</Link></section>;
  const highlights = layout.featuredStories
    .filter((story) => story.item.id !== layout.lead?.item.id).slice(0, 3);
  const featuredIds = new Set(layout.featuredStories.map((story) => story.item.id));

  return (
    <div className="vr-issue-shell" ref={content}>
      <ReaderTools content={content} issueId={issue.id} />
      <section className="vr-issue-intro">
        <div>
          <p className="vr-date">{formatChineseDate(issue.issueDate)}</p>
          <h1 id="main-content" tabIndex={-1}>摄影推送</h1>
        </div>
        <div className="vr-edition-actions"><p className="vr-edition-note">摄影、造型与创作的每日观察。<br />
          <span>{issue.stats.storyCount} 篇报道 · 约 {layout.readingMinutes} 分钟</span>
        </p><ShareLink issueId={issue.id} /></div>
      </section>

      <section className="vr-cover" aria-label="本期重点">
        <VisualStory story={layout.lead} issueId={issue.id} issueGeneratedAt={issue.generatedAt} variant="lead" featured={featuredIds.has(layout.lead.item.id)} />
        <aside className="vr-highlights">
          <div className="vr-highlights-heading"><span>THE EDIT</span><h2>本期重点</h2></div>
          <ol className="vr-highlight-list">
            {highlights.map((story, index) => (
              <li key={story.item.id}>
                <a href={`#${visualStoryAnchor(story.item.id)}`}>
                  <span className="vr-highlight-number">0{index + 1}</span>
                  <div><small>{story.item.sourceAccount}</small>
                    <h3>{story.analysis.chineseTitle || story.item.title}</h3>
                    <p>{story.analysis.selectionRationale || story.analysis.chineseSummary}</p>
                  </div>
                </a>
              </li>
            ))}
          </ol>
          <details className="vr-top-stories">
            <summary>完整精选目录 <span>{layout.featuredStories.length} 条 ＋</span></summary>
          <ol>
            {layout.featuredStories.map((story, index) => (
              <li key={story.item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <a href={`#${visualStoryAnchor(story.item.id)}`}>{story.analysis.chineseTitle || story.item.title}</a>
              </li>
            ))}
          </ol>
          </details>
        </aside>
      </section>

      {layout.sections.length > 0 && <nav className="vr-section-nav" aria-label="本期内容目录">
        <span>浏览本期</span>
        {layout.sections.map((section) => (
          <a key={section.id} href={`#section-${section.id}`}>{section.title}<small>{section.stories.length}</small></a>
        ))}
      </nav>}

      {layout.sections.map((section) => (
        <section className="vr-editorial-section" key={section.id} id={`section-${section.id}`}>
          <header>
            <span>{section.index}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.englishTitle}</p>
            </div>
            <strong>{section.stories.length} STORIES</strong>
          </header>
          <div className="vr-story-list">
            {section.stories.map((story) => (
              <VisualStory story={story} issueId={issue.id} issueGeneratedAt={issue.generatedAt} key={`${issue.id}-${story.item.id}`} featured={featuredIds.has(story.item.id)} />
            ))}
          </div>
        </section>
      ))}

      <footer className="vr-issue-footer">
        <span>{issue.stats.storyCount} STORIES</span>
        <span>{Object.keys(issue.stats.bySource).length} SOURCES</span>
        <span>{Object.keys(issue.stats.byTopic).length} TOPICS</span>
        <span>VISUAL RADAR DAILY</span>
      </footer>
    </div>
  );
}

function IssueNavigation({ detail }: { detail: VisualRadarIssueDetail }) {
  return (
    <nav className="vr-issue-nav" aria-label="日报翻页">
      {detail.navigation.previousId ? (
        <Link href={`/issues/${detail.navigation.previousId}`}>
          <ArrowLeft aria-hidden="true" /> 前一期
        </Link>
      ) : <span />}
      <Link href="/issues">往期日报</Link>
      {detail.navigation.nextId ? (
        <Link href={`/issues/${detail.navigation.nextId}`}>
          后一期 <ArrowRight aria-hidden="true" />
        </Link>
      ) : <span />}
    </nav>
  );
}

function formatChineseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
  }).format(date);
}
