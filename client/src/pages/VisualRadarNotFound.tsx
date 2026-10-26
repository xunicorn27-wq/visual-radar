import { Link } from "wouter";
import { VisualRadarMasthead } from "../components/visual-radar/VisualRadarMasthead";
import { usePageMeta } from "../lib/usePageMeta";
import { visualRadarStaticMode } from "../lib/api";

export default function VisualRadarNotFound() {
  usePageMeta("页面未找到", "这个页面暂时不存在，可以回到摄影推送或浏览往期档案。");
  return <main className="vr-root" id="main-content">
    <VisualRadarMasthead issueLabel="404" showSources={!visualRadarStaticMode} />
    <section className="vr-load-error"><h1>这条线索暂时找不到了</h1><p>链接可能已变更，你可以从最新一期或往期档案继续浏览。</p>
      <div><Link href="/">最新一期</Link><Link href="/issues">往期日报</Link></div>
    </section>
  </main>;
}
