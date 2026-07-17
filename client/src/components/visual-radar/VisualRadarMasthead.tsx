import { Link } from "wouter";
import { Settings2 } from "lucide-react";

import { buildBaseHashHref } from "../../lib/routerBase";

interface VisualRadarMastheadNavigationItem {
  href: string;
  label: string;
  type: "anchor" | "route";
}

export function buildVisualRadarMastheadNavigation(
  showSources = true,
  baseUrl = import.meta.env.BASE_URL
): VisualRadarMastheadNavigationItem[] {
  const navigation: VisualRadarMastheadNavigationItem[] = [
    { href: "/", label: "今日日报", type: "route" },
    { href: "/issues", label: "往期日报", type: "route" },
  ];
  if (showSources) {
    navigation.push({
      href: buildBaseHashHref(baseUrl, "#sources"),
      label: "信源",
      type: "anchor",
    });
  }
  return navigation;
}

export function VisualRadarMasthead({
  issueLabel,
  onToggleAdmin,
  showSources = true,
}: {
  issueLabel?: string;
  onToggleAdmin?: () => void;
  showSources?: boolean;
}) {
  return (
    <header className="vr-masthead">
      <div className="vr-topline">
        <span>{issueLabel || "INDEPENDENT VISUAL CULTURE DAILY"}</span>
        <nav aria-label="Visual Radar 主导航">
          {buildVisualRadarMastheadNavigation(showSources).map((item) =>
            item.type === "route" ? (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ) : (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            )
          )}
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
