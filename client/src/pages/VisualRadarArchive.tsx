import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";

import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import {
  getVisualRadarIssues,
  type VisualRadarIssueSummary,
  visualRadarStaticMode,
} from "../lib/api";

export default function VisualRadarArchive() {
  const [issues, setIssues] = useState<VisualRadarIssueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getVisualRadarIssues()
      .then(setIssues)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "往期日报加载失败")
      );
  }, []);

  return (
    <main className="vr-root">
      <VisualRadarMasthead
        issueLabel="ARCHIVE"
        showSources={!visualRadarStaticMode}
      />
      <section className="vr-archive">
        <header>
          <h1>往期日报</h1>
          <p>VISUAL RADAR ARCHIVE</p>
        </header>
        {error ? <div className="vr-message">{error}</div> : null}
        {!error && !issues ? (
          <div className="vr-message"><Loader2 className="vr-spin" /> 正在加载</div>
        ) : null}
        {issues?.length === 0 ? <div className="vr-message">尚未生成日报</div> : null}
        <ol>
          {issues?.map((issue, index) => (
            <li key={issue.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{issue.issueDate}</p>
                <h2>{issue.topStories[0] || issue.title}</h2>
                <small>{issue.storyCount} STORIES</small>
              </div>
              <Link href={`/issues/${issue.id}`} aria-label={`打开 ${issue.title}`}>
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
