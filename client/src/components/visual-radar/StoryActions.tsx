import { Bookmark, Check, PencilLine, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { VisualRadarArchiveStory } from "../../lib/api";
import { libraryStore, libraryStoryKey, NOTE_LIMIT, useVisualRadarLibrary } from "../../lib/visualRadarLibrary";
import { ShareLink } from "./ShareLink";

export function StoryActions({ story }: { story: VisualRadarArchiveStory }) {
  const library = useVisualRadarLibrary();
  const entry = library.entries.find((item) => libraryStoryKey(item.story) === libraryStoryKey(story));
  const dialog = useRef<HTMLDialogElement>(null);
  const labelId = useId();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [noteError, setNoteError] = useState("");
  const [original, setOriginal] = useState("");
  const [discardPrompt, setDiscardPrompt] = useState(false);
  function openNote() {
    const text = entry?.note || "";
    setDraft(text); setOriginal(text); setNoteError(""); setDiscardPrompt(false);
    dialog.current?.showModal();
  }
  function closeNote() {
    if (draft !== original) { setDiscardPrompt(true); return; }
    dialog.current?.close();
  }
  function saveNote() {
    if (libraryStore.saveNote(story, draft)) {
      setMessage("备注已保存，已加入收藏。");
      dialog.current?.close();
    } else setNoteError(libraryStore.getSnapshot().error || "备注过长，请缩短后再保存。");
  }
  return <div className="vr-story-actions">
    <div className="vr-story-action-buttons">
      <button type="button" aria-pressed={Boolean(entry?.saved)} aria-label={`${entry?.saved ? "取消收藏" : "收藏"}：${story.title}`}
        onClick={() => {
          const ok = libraryStore.setSaved(story, !entry?.saved);
          setMessage(ok ? (entry?.saved ? "已取消收藏，备注保留。" : "已收藏到本机。") : libraryStore.getSnapshot().error || "保存失败");
        }}><Bookmark aria-hidden="true" />{entry?.saved ? "已收藏" : "收藏"}</button>
      <button type="button" onClick={openNote} aria-label={`编辑备注：${story.title}`}><PencilLine aria-hidden="true" />{entry?.note ? "编辑备注" : "写备注"}</button>
      <ShareLink issueId={story.issueId} storyId={story.id} />
    </div>
    {message && <p className="vr-action-feedback" role="status">{message}</p>}
    <dialog ref={dialog} className="vr-note-dialog" aria-labelledby={labelId}
      onCancel={(event) => { event.preventDefault(); closeNote(); }}>
      <div className="vr-note-heading"><h2 id={labelId}>我的备注</h2><button type="button" onClick={closeNote} aria-label="关闭备注"><X aria-hidden="true" /></button></div>
      <p className="vr-note-story-title">{story.title}</p>
      <label className="vr-note-label">记下想借鉴的细节或下一步尝试
        <textarea autoFocus value={draft} maxLength={NOTE_LIMIT} onChange={(event) => { setDraft(event.target.value); setDiscardPrompt(false); }} rows={7} placeholder="例如：侧光下的织物质感，下一次拍摄可以试试……" />
      </label>
      <p className="vr-note-hint">仅保存在当前浏览器 · 保存备注会加入收藏 <span>{draft.length}/{NOTE_LIMIT}</span></p>
      {noteError && <p role="alert" className="vr-action-error">{noteError}</p>}
      {discardPrompt && <div className="vr-discard-prompt" role="alert"><p>这次修改尚未保存。</p><button type="button" onClick={() => dialog.current?.close()}>放弃本次修改</button><button type="button" onClick={() => setDiscardPrompt(false)}>继续编辑</button></div>}
      <div className="vr-note-footer"><button type="button" onClick={closeNote}>取消</button><button type="button" className="vr-primary-action" onClick={saveNote}><Check aria-hidden="true" />保存备注</button></div>
    </dialog>
  </div>;
}
