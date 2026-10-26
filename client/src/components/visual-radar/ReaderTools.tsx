import { ArrowUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { readingPercentage } from "../../lib/readerNavigation";

export function ReaderTools({ content, issueId }: { content: RefObject<HTMLDivElement | null>; issueId: string }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      const element = content.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setProgress(readingPercentage(window.scrollY, rect.top + window.scrollY, rect.height, window.innerHeight));
      setVisible(window.scrollY > 600);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (content.current) observer?.observe(content.current);
    schedule();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [content, issueId]);

  return <>
    <progress className="vr-reading-progress" max={100} value={progress} aria-label="页面阅读位置" />
    {visible && <button className="vr-back-top" type="button" onClick={() => {
      content.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }} aria-label="回到顶部"><ArrowUp aria-hidden="true" /><span>顶部</span></button>}
  </>;
}
