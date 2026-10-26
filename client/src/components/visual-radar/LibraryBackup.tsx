import { useId, useRef, useState } from "react";
import { BACKUP_LIMIT, libraryBackup, libraryStore, parseLibraryBackup, type LibraryEntry, type NoteConflictChoice, type RestorePlan } from "../../lib/visualRadarLibrary";

export function downloadLibraryFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LibraryBackup({ entries }: { entries: LibraryEntry[] }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const label = useId();
  const [incoming, setIncoming] = useState<LibraryEntry[]>([]);
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [choice, setChoice] = useState<NoteConflictChoice>("local");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  function backup() {
    libraryStore.refresh();
    const current = libraryStore.getSnapshot();
    if (current.error) { setError(current.error); return; }
    try {
      downloadLibraryFile(libraryBackup(current.entries), `Visual-Radar-完整备份-${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8");
      setError(""); setMessage("已生成完整备份，包含全部收藏及保留的备注，不受当前筛选影响。请妥善保管个人备注。");
    } catch { setError("备份未完成，请重试。现有收藏未修改。"); }
  }
  function preview(items: LibraryEntry[], policy: NoteConflictChoice) {
    try { setPlan(libraryStore.previewRestore(items, policy)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "无法预览备份"); setPlan(null); }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setReading(true); setError(""); setMessage("");
    try {
      if (file.size > BACKUP_LIMIT) throw new Error("备份超过 5 MB，请使用较小的文件。");
      const items = parseLibraryBackup(await file.text());
      const next = libraryStore.previewRestore(items);
      setIncoming(items); setPlan(next); setChoice("local");
      dialog.current?.showModal();
    } catch (e) { setError(e instanceof SyntaxError ? "文件不是有效 JSON，请选择 Visual Radar 导出的完整备份。" : e instanceof Error ? e.message : "备份读取失败，现有记录未修改。"); }
    finally { setReading(false); if (input.current) input.current.value = ""; }
  }
  function restore() {
    if (!plan) return;
    if (libraryStore.restore(plan)) {
      setMessage(`恢复完成：新增 ${plan.added} 条，合并 ${plan.existing} 条；其他本机记录保留。`);
      setError(""); setPlan(null); dialog.current?.close();
    } else setError(libraryStore.getSnapshot().error || "恢复未完成，现有记录未修改。");
  }
  return <section className="vr-backup-tools" aria-label="收藏备份与恢复">
    <div className="vr-backup-buttons">
      <button type="button" onClick={backup} disabled={!entries.length}>备份全部收藏与备注</button>
      <button type="button" onClick={() => input.current?.click()} disabled={reading}>{reading ? "读取备份中…" : "从备份恢复"}</button>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label="选择收藏备份" onChange={(event) => void readFile(event.target.files?.[0])} />
    </div>
    {message && <p role="status">{message}</p>}
    {error && !dialog.current?.open && <p role="alert" className="vr-action-error">{error}</p>}
    <dialog ref={dialog} className="vr-note-dialog vr-restore-dialog" aria-labelledby={label}>
      <h2 id={label}>恢复预览</h2>
      {plan && <p>新增 {plan.added} 条 · 合并 {plan.existing} 条 · 备注冲突 {plan.conflicts.length} 条</p>}
      <p>只合并，不清空本机收藏；空备注不会覆盖已有文字。建议先下载一份本机备份。</p>
      <button type="button" onClick={backup} disabled={!entries.length}>先备份本机记录</button>
      {plan && plan.conflicts.length > 0 && <>
        <label className="vr-conflict-choice">备注冲突处理
          <select value={choice} onChange={(event) => { const next = event.target.value as NoteConflictChoice; setChoice(next); preview(incoming, next); }}>
            <option value="local">保留本机备注（推荐）</option>
            <option value="backup">用备份备注替换冲突备注</option>
          </select>
        </label>
        <div className="vr-restore-conflicts">{plan.conflicts.map((conflict, index) => <details key={index}><summary>{conflict.title}</summary><strong>本机备注</strong><p>{conflict.local}</p><strong>备份备注</strong><p>{conflict.backup}</p></details>)}</div>
      </>}
      {error && <p role="alert" className="vr-action-error">{error}</p>}
      <div className="vr-note-footer">
        <button type="button" onClick={() => { dialog.current?.close(); setError(""); }}>取消恢复</button>
        {error && <button type="button" onClick={() => preview(incoming, choice)}>重新预览</button>}
        <button type="button" className="vr-primary-action" onClick={restore} disabled={!plan || Boolean(error)}>确认合并恢复</button>
      </div>
    </dialog>
  </section>;
}
