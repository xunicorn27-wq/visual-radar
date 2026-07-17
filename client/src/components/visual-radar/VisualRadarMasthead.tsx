import { Link } from "wouter";
import { Settings2 } from "lucide-react";

import { buildBaseHashHref } from "../../lib/routerBase";

export function VisualRadarMasthead({
  issueLabel,
  onToggleAdmin,
}: {
  issueLabel?: string;
  onToggleAdmin?: () => void;
}) {
  return (
    <header className="vr-masthead">
      <div className="vr-topline">
        <span>{issueLabel || "INDEPENDENT VISUAL CULTURE DAILY"}</span>
        <nav aria-label="Visual Radar 主导航">
          <Link href="/">今日日报</Link>
          <Link href="/issues">往期日报</Link>
          <a href={buildBaseHashHref(import.meta.env.BASE_URL, "#sources")}>信源</a>
          {onToggleAdmin ? (
            <button
              type="button"
              onClick={onToggleAdmin}
              aria-label="打开管理区"
              title="管理"
            >
              <Settings2 aria-hidden="true" />
            </button>
          ) : null}
        </nav>
      </div>
      <Link href="/" className="vr-wordmark" aria-label="Visual Radar 首页">
        VISUAL RADAR
      </Link>
    </header>
  );
}
