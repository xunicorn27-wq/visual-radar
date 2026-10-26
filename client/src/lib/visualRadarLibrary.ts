import { useSyncExternalStore } from "react";
import type { VisualRadarArchiveStory } from "./api";
import { ARCHIVE_TOPICS, VISUAL_METHODS } from "./visualRadarArchive";

export const LIBRARY_KEY = "visual-radar:library:v1";
export const NOTE_LIMIT = 2000;
export const BACKUP_LIMIT = 5 * 1024 * 1024;
export interface LibraryEntry {
  story: VisualRadarArchiveStory;
  saved: boolean;
  savedAt: string;
  updatedAt: string;
  note: string;
  contentUpdatedAt?: string;
}
export type NoteConflictChoice = "local" | "backup";
export interface RestorePlan {
  base: string | null;
  entries: LibraryEntry[];
  added: number;
  existing: number;
  conflicts: Array<{ title: string; local: string; backup: string }>;
}
interface LibrarySnapshot { entries: LibraryEntry[]; error: string | null }
type LocalStorage = Pick<Storage, "getItem" | "setItem">;
const EMPTY: LibrarySnapshot = { entries: [], error: null };

export const libraryStoryKey = (story: Pick<VisualRadarArchiveStory, "issueId" | "id">) => `${story.issueId}/${story.id}`;

function validStory(value: unknown): value is VisualRadarArchiveStory {
  if (!value || typeof value !== "object") return false;
  const story = value as VisualRadarArchiveStory;
  return [story.id, story.title, story.summary, story.originalTitle, story.source].every((text) => typeof text === "string")
    && Boolean(story.id) && /^\d{4}-\d{2}-\d{2}$/.test(story.issueId) && story.issueDate === story.issueId
    && Object.hasOwn(ARCHIVE_TOPICS, story.topic)
    && Array.isArray(story.keywords) && story.keywords.every((keyword) => typeof keyword === "string")
    && (story.thumbnailUrl === null || (typeof story.thumbnailUrl === "string" && story.thumbnailUrl.startsWith("https://")))
    && (story.visualMethods === undefined || (Array.isArray(story.visualMethods) && story.visualMethods.every((tag) => VISUAL_METHODS.includes(tag))))
    && (story.verified === undefined || typeof story.verified === "boolean")
    && (story.featured === undefined || typeof story.featured === "boolean")
    && (story.application === undefined || typeof story.application === "string")
    && (story.revisionAt === undefined || (typeof story.revisionAt === "string" && Number.isFinite(Date.parse(story.revisionAt))));
}

function cleanStory(story: VisualRadarArchiveStory): VisualRadarArchiveStory {
  const { id, issueId, issueDate, title, summary, originalTitle, source, topic, keywords, thumbnailUrl, visualMethods, verified, featured, application, revisionAt } = story;
  return { id, issueId, issueDate, title, summary, originalTitle, source, topic, keywords, thumbnailUrl, visualMethods, verified, featured, application, revisionAt };
}

export function parseLibrary(raw: string | null): LibraryEntry[] {
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 10000) throw new Error("invalid library");
  const seen = new Set<string>();
  for (const entry of value.entries) {
    if (!validStory(entry?.story) || typeof entry.saved !== "boolean" || typeof entry.note !== "string"
      || entry.note.length > NOTE_LIMIT || typeof entry.savedAt !== "string" || typeof entry.updatedAt !== "string"
      || !Number.isFinite(Date.parse(entry.savedAt)) || !Number.isFinite(Date.parse(entry.updatedAt))
      || (entry.contentUpdatedAt !== undefined && (typeof entry.contentUpdatedAt !== "string" || !Number.isFinite(Date.parse(entry.contentUpdatedAt))))) throw new Error("invalid entry");
    const key = libraryStoryKey(entry.story);
    if (seen.has(key)) throw new Error("duplicate entry");
    seen.add(key);
  }
  return value.entries.map((entry: LibraryEntry) => ({ story: cleanStory(entry.story), saved: entry.saved, savedAt: entry.savedAt, updatedAt: entry.updatedAt, note: entry.note, contentUpdatedAt: entry.contentUpdatedAt }));
}

export function libraryBackup(entries: readonly LibraryEntry[]) {
  // All records, including notes on unsaved stories; never limited by current filters.
  return JSON.stringify({ format: "visual-radar-library", version: 1, entries: parseLibrary(JSON.stringify({ version: 1, entries })) }, null, 2);
}
export function parseLibraryBackup(raw: string) {
  if (new Blob([raw]).size > BACKUP_LIMIT) throw new Error("备份超过 5 MB，请使用较小的文件。");
  const value = JSON.parse(raw);
  if (value?.format !== "visual-radar-library") throw new Error("请选择 Visual Radar 导出的完整 JSON 备份，不支持 Markdown。");
  try { return parseLibrary(raw); }
  catch { throw new Error("备份版本不兼容或内容格式不完整，现有记录未修改。"); }
}

function newestStory(local: VisualRadarArchiveStory, incoming: VisualRadarArchiveStory) {
  if (local.revisionAt && (!incoming.revisionAt || Date.parse(local.revisionAt) > Date.parse(incoming.revisionAt))) return local;
  return cleanStory(incoming);
}

export function mergeLibraryBackup(local: readonly LibraryEntry[], incoming: readonly LibraryEntry[], choice: NoteConflictChoice) {
  const merged = new Map(local.map((entry) => [libraryStoryKey(entry.story), entry]));
  let added = 0, existing = 0;
  const conflicts: RestorePlan["conflicts"] = [];
  for (const entry of incoming) {
    const key = libraryStoryKey(entry.story), old = merged.get(key);
    if (!old) { merged.set(key, entry); added++; continue; }
    existing++;
    const conflict = Boolean(old.note.trim() && entry.note.trim() && old.note !== entry.note);
    if (conflict) conflicts.push({ title: old.story.title, local: old.note, backup: entry.note });
    // A backup cannot silently remove favorites or erase a non-empty note.
    const note = conflict ? (choice === "backup" ? entry.note : old.note) : old.note.trim() ? old.note : entry.note;
    const story = newestStory(old.story, entry.story);
    merged.set(key, { ...old, story, saved: old.saved || entry.saved, note,
      savedAt: old.saved ? old.savedAt : entry.saved ? entry.savedAt : old.savedAt,
      updatedAt: note === old.note ? old.updatedAt : entry.updatedAt,
      contentUpdatedAt: story !== old.story && JSON.stringify(story) !== JSON.stringify(old.story) ? story.revisionAt || entry.contentUpdatedAt : old.contentUpdatedAt });
  }
  return { entries: [...merged.values()], added, existing, conflicts };
}

export function createLibraryStore(storage: () => LocalStorage, now = () => new Date().toISOString()) {
  let snapshot = EMPTY;
  let initialized = false;
  let lastRaw: string | null | undefined;
  const listeners = new Set<() => void>();
  function publish(next: LibrarySnapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }
  function refresh() {
    initialized = true;
    try {
      const raw = storage().getItem(LIBRARY_KEY);
      if (raw === lastRaw && !snapshot.error) return;
      const entries = parseLibrary(raw);
      lastRaw = raw;
      publish({ entries, error: null });
    } catch {
      publish({ entries: snapshot.entries, error: "无法读取本机收藏，现有记录已保留。请检查浏览器存储权限后重试。" });
    }
  }
  function persist(entries: LibraryEntry[]) {
    try {
      const raw = JSON.stringify({ version: 1, entries });
      storage().setItem(LIBRARY_KEY, raw);
      lastRaw = raw;
      publish({ entries, error: null });
      return true;
    } catch {
      publish({ entries: snapshot.entries, error: "未能保存到本机。现有记录未被替换，请检查存储空间或权限后重试。" });
      return false;
    }
  }
  function change(story: VisualRadarArchiveStory, edit: (old: LibraryEntry | undefined, time: string) => LibraryEntry) {
    // Read again before writing so another tab's unrelated edits are preserved.
    refresh();
    if (snapshot.error) return false;
    try {
      if (!validStory(story)) throw new Error("invalid story");
      const key = libraryStoryKey(story);
      const old = snapshot.entries.find((entry) => libraryStoryKey(entry.story) === key);
      const updated = edit(old, now());
      updated.story = old ? newestStory(old.story, story) : cleanStory(story);
      updated.contentUpdatedAt = old?.contentUpdatedAt;
      const entries = [...snapshot.entries.filter((entry) => libraryStoryKey(entry.story) !== key), updated];
      return persist(entries);
    } catch {
      publish({ entries: snapshot.entries, error: "未能保存到本机。可能是存储空间不足或浏览器限制，请保留文字并重试。" });
      return false;
    }
  }
  return {
    refresh,
    getSnapshot: () => { if (!initialized) refresh(); return snapshot; },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    syncStories(stories: readonly VisualRadarArchiveStory[]) {
      refresh();
      if (snapshot.error) return false;
      const byKey = new Map(stories.filter(validStory).map((story) => [libraryStoryKey(story), story]));
      let changed = false;
      const entries = snapshot.entries.map((entry) => {
        const candidate = byKey.get(libraryStoryKey(entry.story));
        if (!candidate) return entry; // Missing from an index never means delete.
        const story = newestStory(entry.story, candidate);
        if (JSON.stringify(story) === JSON.stringify(entry.story)) return entry;
        changed = true;
        return { ...entry, story, contentUpdatedAt: now() };
      });
      return !changed || persist(entries);
    },
    previewRestore(incoming: readonly LibraryEntry[], choice: NoteConflictChoice = "local"): RestorePlan {
      refresh();
      if (snapshot.error) throw new Error(snapshot.error);
      return { base: lastRaw ?? null, ...mergeLibraryBackup(snapshot.entries, incoming, choice) };
    },
    restore(plan: RestorePlan) {
      refresh();
      if (snapshot.error) return false;
      if (lastRaw !== plan.base) {
        publish({ entries: snapshot.entries, error: "本机收藏在预览后发生变化，请重新预览再恢复。" });
        return false;
      }
      try { return persist(parseLibrary(JSON.stringify({ version: 1, entries: plan.entries }))); }
      catch { publish({ entries: snapshot.entries, error: "备份内容无效，现有记录未修改。" }); return false; }
    },
    setSaved(story: VisualRadarArchiveStory, saved: boolean) {
      return change(story, (old, time) => ({ story, saved, note: old?.note || "", savedAt: saved && !old?.saved ? time : old?.savedAt || time, updatedAt: time }));
    },
    saveNote(story: VisualRadarArchiveStory, note: string) {
      if (note.length > NOTE_LIMIT) return false;
      return change(story, (old, time) => ({ story, saved: true, note, savedAt: old?.saved ? old.savedAt : time, updatedAt: time }));
    },
  };
}

export const libraryStore = createLibraryStore(() => window.localStorage);
function subscribe(listener: () => void) {
  const unsubscribe = libraryStore.subscribe(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === LIBRARY_KEY || event.key === null) libraryStore.refresh(); };
  window.addEventListener("storage", onStorage);
  return () => { unsubscribe(); window.removeEventListener("storage", onStorage); };
}
export function useVisualRadarLibrary() {
  return useSyncExternalStore(subscribe, libraryStore.getSnapshot, () => EMPTY);
}

export function libraryMarkdown(entries: readonly LibraryEntry[], baseUrl: string) {
  const escape = (value: string) => value.replace(/[\\`*_{}\[\]<>#!|]/g, "\\$&").replace(/\r?\n/g, " ");
  const base = baseUrl.replace(/\/$/, "");
  return ["# Visual Radar · 我的收藏", "", ...entries.filter((entry) => entry.saved).flatMap((entry) => [
    `## ${escape(entry.story.title)}`, "",
    `${entry.story.issueDate} · ${escape(entry.story.source)} · ${ARCHIVE_TOPICS[entry.story.topic]}`,
    "", escape(entry.story.summary), "",
    `[查看日报](${base}/issues/${entry.story.issueId}/#story-${encodeURIComponent(entry.story.id)})`,
    ...(entry.note ? ["", "### 我的备注", "", ...entry.note.split(/\r?\n/).map((line) => `> ${escape(line)}`)] : []), "",
  ])].join("\n");
}
