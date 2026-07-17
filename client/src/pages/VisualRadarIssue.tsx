import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import { VisualStory } from "../components/visual-radar/VisualStory";
import {
  getVisualRadarIssue,
  type VisualRadarIssue as VisualRadarIssueData,
  type VisualRadarIssueDetail,
  visualRadarStaticMode,
} from "../lib/api";
import { buildVisualRadarIssueLayout } from "../lib/visualRadarIssueLayout";

export default function VisualRadarIssue() {
  const [, params] = useRoute("/issues/:issueId");
  const [detail, setDetail] = useState<VisualRadarIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.issueId) return;
    setDetail(null);
    setError(null);
    void getVisualRadarIssue(params.issueId)
      .then(setDetail)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "日报加载失败")
      );
  }, [params?.issueId]);

  if (error) {
    return (
      <main className="vr-root">
        <VisualRadarMasthead showSources={!visualRadarStaticMode} />
        <div className="vr-message">{error}</div>
      </main>
    );
  }
  if (!detail) {
    return (
      <main className="vr-root">
        <VisualRadarMasthead showSources={!visualRadarStaticMode} />
        <div className="vr-message"><Loader2 className="vr-spin" /> 正在加载日报</div>
      </main>
    );
  }

  return (
    <main className="vr-root">
      <VisualRadarMasthead
        issueLabel={`VOL.${detail.issue.id}`}
        showSources={!visualRadarStaticMode}
      />
      <VisualRadarIssueContent issue={detail.issue} />
      <IssueNavigation detail={detail} />
    </main>
  );
}

export function VisualRadarIssueContent({ issue }: { issue: VisualRadarIssueData }) {
  const layout = useMemo(() => buildVisualRadarIssueLayout(issue), [issue]);
  if (!layout.lead) return null;

  return (
    <div className="vr-issue-shell">
      <section className="vr-issue-intro">
        <div>
          <p className="vr-date">{formatChineseDate(issue.issueDate)}</p>
          <h1>摄影推送</h1>
          <p>{issue.stats.storyCount} 篇报道 · 约 {layout.readingMinutes} 分钟</p>
        </div>
        <div className="vr-top-stories">
          <h2>微信精选 {layout.featuredStories.length} 条</h2>
          <ol>
            {layout.featuredStories.map((story, index) => (
              <li key={story.item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {story.analysis.chineseTitle || story.item.title}
                <strong>{story.analysis.score}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="vr-lead">
        <VisualStory story={layout.lead} variant="lead" />
      </section>

      {layout.sections.map((section) => (
        <section className="vr-editorial-section" key={section.id}>
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
              <VisualStory story={story} key={story.item.id} />
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
