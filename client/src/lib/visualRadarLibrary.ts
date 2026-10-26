import { useSyncExternalStore } from "react";
import type { VisualRadarArchiveStory } from "./api";
import { ARCHIVE_TOPICS } from "./visualRadarArchive";

export const LIBRARY_KEY = "visual-radar:library:v1";
export const NOTE_LIMIT = 2000;
export interface LibraryEntry {
  story: VisualRadarArchiveStory;
  saved: boolean;
  savedAt: string;
  updatedAt: string;
  note: string;
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
    && (story.thumbnailUrl === null || (typeof story.thumbnailUrl === "string" && story.thumbnailUrl.startsWith("https://")));
}

export function parseLibrary(raw: string | null): LibraryEntry[] {
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries)) throw new Error("invalid library");
  const seen = new Set<string>();
  for (const entry of value.entries) {
    if (!validStory(entry?.story) || typeof entry.saved !== "boolean" || typeof entry.note !== "string"
      || entry.note.length > NOTE_LIMIT || typeof entry.savedAt !== "string" || typeof entry.updatedAt !== "string"
      || !Number.isFinite(Date.parse(entry.savedAt)) || !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error("invalid entry");
    const key = libraryStoryKey(entry.story);
    if (seen.has(key)) throw new Error("duplicate entry");
    seen.add(key);
  }
  return value.entries;
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
  function change(story: VisualRadarArchiveStory, edit: (old: LibraryEntry | undefined, time: string) => LibraryEntry) {
    // Read again before writing so another tab's unrelated edits are preserved.
    refresh();
    if (snapshot.error) return false;
    try {
      if (!validStory(story)) throw new Error("invalid story");
      const key = libraryStoryKey(story);
      const old = snapshot.entries.find((entry) => libraryStoryKey(entry.story) === key);
      const updated = edit(old, now());
      const entries = [...snapshot.entries.filter((entry) => libraryStoryKey(entry.story) !== key), updated];
      const raw = JSON.stringify({ version: 1, entries });
      storage().setItem(LIBRARY_KEY, raw);
      lastRaw = raw;
      publish({ entries, error: null });
      return true;
    } catch {
      publish({ entries: snapshot.entries, error: "未能保存到本机。可能是存储空间不足或浏览器限制，请保留文字并重试。" });
      return false;
    }
  }
  return {
    refresh,
    getSnapshot: () => { if (!initialized) refresh(); return snapshot; },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
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
