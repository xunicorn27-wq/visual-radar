import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildIssueShareUrl, copyReaderLink } from "../../lib/readerNavigation";

export function ShareLink({ issueId, storyId }: { issueId: string; storyId?: string }) {
  const [status, setStatus] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (manualLink) { input.current?.focus(); input.current?.select(); } }, [manualLink]);

  async function copy() {
    setBusy(true);
    const link = buildIssueShareUrl(window.location.origin, import.meta.env.BASE_URL, issueId, storyId);
    let copied = false;
    try { copied = await copyReaderLink(link, navigator.clipboard?.writeText?.bind(navigator.clipboard)); } catch { /* Access to clipboard itself may be blocked. */ }
    if (!active.current) return;
    setBusy(false);
    setManualLink(copied ? "" : link);
    setStatus(copied ? "链接已复制" : "自动复制不可用，请复制下方链接。");
  }
  return <div className="vr-share">
    <button type="button" onClick={() => void copy()} disabled={busy}><Link2 aria-hidden="true" />{storyId ? "复制文章链接" : "分享本期"}</button>
    {status && <span role="status" className="vr-share-status">{status}</span>}
    {manualLink && <label className="vr-manual-link">可手动复制的链接<input ref={input} readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} /></label>}
  </div>;
}
