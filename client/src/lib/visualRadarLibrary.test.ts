import { describe, expect, it, vi } from "vitest";
import type { VisualRadarArchiveStory } from "./api";
import { createLibraryStore, LIBRARY_KEY, libraryMarkdown, parseLibrary, NOTE_LIMIT, libraryBackup, parseLibraryBackup, BACKUP_LIMIT } from "./visualRadarLibrary";

const story: VisualRadarArchiveStory = {
  id: "sample", issueId: "2026-10-23", issueDate: "2026-10-23", title: "光线与织物", originalTitle: "Light",
  summary: "摄影参考", source: "Test", topic: "photography", keywords: ["布光"], thumbnailUrl: null,
};
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const store = createLibraryStore(() => storage, () => "2026-10-26T00:00:00.000Z");
  return { data, storage, store };
}

describe("browser-only collection", () => {
  it("refreshes corrected content without changing personal notes or dates, including unsaved notes", () => {
    const { store, storage } = setup();
    store.saveNote(story, "我的原始想法");
    store.setSaved(story, false);
    const before = store.getSnapshot().entries[0];
    const corrected = { ...story, title: "更正标题", revisionAt: "2026-10-26T01:00:00Z", verified: true, featured: true };
    expect(store.syncStories([corrected])).toBe(true);
    expect(store.getSnapshot().entries[0]).toMatchObject({ story: corrected, note: before.note, savedAt: before.savedAt, updatedAt: before.updatedAt, saved: false, contentUpdatedAt: "2026-10-26T00:00:00.000Z" });
    const write = vi.spyOn(storage, "setItem");
    store.syncStories([corrected]);
    expect(write).not.toHaveBeenCalled();
    store.syncStories([]);
    expect(store.getSnapshot().entries).toHaveLength(1);
    // A stale detail tab may edit a note but must not roll back corrected content.
    store.saveNote(story, "新备注");
    expect(store.getSnapshot().entries[0].story.title).toBe("更正标题");
    store.syncStories([{ ...story, revisionAt: "2026-07-31T00:00:00Z" }]);
    expect(store.getSnapshot().entries[0].story.title).toBe("更正标题");
  });
  it("keeps existing content intact when correction persistence fails", () => {
    const { store, storage } = setup(); store.saveNote(story, "备注");
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(store.syncStories([{ ...story, title: "修订" }])).toBe(false);
    expect(store.getSnapshot().entries[0].story.title).toBe(story.title);
    expect(store.getSnapshot().entries[0].note).toBe("备注");
  });
  it("roundtrips complete backups, retaining unsaved notes and compatible legacy stories", () => {
    const { store } = setup(); store.saveNote(story, "私人备注"); store.setSaved(story, false);
    const raw = libraryBackup(store.getSnapshot().entries);
    const restored = setup();
    const incoming = parseLibraryBackup(raw);
    expect(restored.store.restore(restored.store.previewRestore(incoming))).toBe(true);
    expect(restored.store.getSnapshot().entries).toEqual(store.getSnapshot().entries);
    expect(incoming[0]).toMatchObject({ saved: false, note: "私人备注" });
    expect(() => parseLibraryBackup("# Markdown")).toThrow();
    expect(() => parseLibraryBackup('{"version":1,"entries":[]}')).toThrow();
    expect(() => parseLibraryBackup(" ".repeat(BACKUP_LIMIT + 1))).toThrow();
    expect(parseLibraryBackup(libraryBackup([]))).toEqual([]);
  });
  it("previews without writing, merges duplicates and defaults to preserving local conflicts", () => {
    const local = setup(), backup = setup();
    local.store.saveNote(story, "本机备注");
    local.store.setSaved({ ...story, id: "unrelated" }, true);
    backup.store.saveNote(story, "备份备注");
    backup.store.setSaved(story, false);
    backup.store.saveNote({ ...story, id: "new" }, "新增备注");
    const before = local.storage.getItem(LIBRARY_KEY);
    const plan = local.store.previewRestore(backup.store.getSnapshot().entries);
    expect(local.storage.getItem(LIBRARY_KEY)).toBe(before);
    expect(plan).toMatchObject({ added: 1, existing: 1, conflicts: [{ title: story.title, local: "本机备注", backup: "备份备注" }] });
    expect(local.store.restore(plan)).toBe(true);
    expect(local.store.getSnapshot().entries).toHaveLength(3);
    expect(local.store.getSnapshot().entries.find(e => e.story.id === "sample")).toMatchObject({ note: "本机备注", saved: true });
    const again = local.store.previewRestore(backup.store.getSnapshot().entries);
    expect(again.added).toBe(0);
    expect(local.store.restore(again)).toBe(true);
    expect(local.store.getSnapshot().entries).toHaveLength(3);
  });
  it("only replaces conflicting notes on explicit choice and never erases notes with blanks", () => {
    const local = setup(), backup = setup();
    local.store.saveNote(story, "本机"); backup.store.saveNote(story, "备份");
    local.store.restore(local.store.previewRestore(backup.store.getSnapshot().entries, "backup"));
    expect(local.store.getSnapshot().entries[0].note).toBe("备份");
    backup.store.saveNote(story, "");
    local.store.restore(local.store.previewRestore(backup.store.getSnapshot().entries, "backup"));
    expect(local.store.getSnapshot().entries[0].note).toBe("备份");
  });
  it("rejects stale previews after another tab writes and supports previewing again", () => {
    const { store, storage } = setup(); store.saveNote(story, "初始");
    const plan = store.previewRestore([]);
    const other = createLibraryStore(() => storage); other.saveNote(story, "另一标签页");
    expect(store.restore(plan)).toBe(false);
    expect(store.getSnapshot().entries[0].note).toBe("另一标签页");
    expect(store.getSnapshot().error).toContain("重新预览");
    expect(store.restore(store.previewRestore([]))).toBe(true);
  });
  it("does not partially restore when storage is full", () => {
    const local = setup(), backup = setup(); local.store.saveNote(story, "保留");
    backup.store.saveNote({ ...story, id: "new" }, "新增");
    const before = local.storage.getItem(LIBRARY_KEY);
    const plan = local.store.previewRestore(backup.store.getSnapshot().entries);
    vi.spyOn(local.storage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(local.store.restore(plan)).toBe(false);
    expect(local.storage.getItem(LIBRARY_KEY)).toBe(before);
    expect(local.store.getSnapshot().entries).toHaveLength(1);
  });
  it("rejects malformed backup entries and strips unknown fields", () => {
    const { store } = setup(); store.setSaved(story, true);
    const entry = store.getSnapshot().entries[0];
    for (const broken of [{ ...entry, note: "x".repeat(NOTE_LIMIT + 1) }, { ...entry, story: { ...story, verified: "yes" } }, { ...entry, story: { ...story, visualMethods: ["fake"] } }, { ...entry, story: { ...story, revisionAt: "invalid" } }]) {
      expect(() => parseLibraryBackup(JSON.stringify({ format: "visual-radar-library", version: 1, entries: [broken] }))).toThrow();
    }
    expect(() => parseLibrary(JSON.stringify({ version: 1, entries: [entry, entry] }))).toThrow();
    const clean = parseLibrary(JSON.stringify({ version: 1, entries: [{ ...entry, unexpected: "omit", story: { ...story, unexpected: "omit" } }] }));
    expect(clean[0]).not.toHaveProperty("unexpected"); expect(clean[0].story).not.toHaveProperty("unexpected");
  });
  it("persists favorites and notes across reloads, preserving notes after removal", () => {
    const { storage, store } = setup();
    expect(store.setSaved(story, true)).toBe(true);
    expect(store.saveNote(story, "试试侧光\n保留纹理")).toBe(true);
    const reloaded = createLibraryStore(() => storage);
    expect(reloaded.getSnapshot().entries[0]).toMatchObject({ saved: true, note: "试试侧光\n保留纹理" });
    expect(reloaded.setSaved(story, false)).toBe(true);
    expect(reloaded.getSnapshot().entries[0]).toMatchObject({ saved: false, note: "试试侧光\n保留纹理" });
    expect(reloaded.setSaved(story, true)).toBe(true);
    expect(reloaded.getSnapshot().entries[0].note).toBe("试试侧光\n保留纹理");
    expect(reloaded.getSnapshot().entries).toHaveLength(1);
  });
  it("saving a note adds a favorite and enforces note limits", () => {
    const { store } = setup();
    expect(store.saveNote(story, "拍摄想法")).toBe(true);
    expect(store.getSnapshot().entries[0].saved).toBe(true);
    expect(store.saveNote(story, "x".repeat(NOTE_LIMIT + 1))).toBe(false);
    expect(store.getSnapshot().entries[0].note).toBe("拍摄想法");
    expect(store.saveNote(story, "")).toBe(true);
    expect(store.getSnapshot().entries[0].note).toBe("");
  });
  it("does not report success or erase previous data when writes are blocked", () => {
    const { store, storage } = setup();
    store.setSaved(story, true);
    const before = storage.getItem(LIBRARY_KEY);
    const spy = vi.spyOn(storage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(store.saveNote(story, "未保存")).toBe(false);
    expect(store.getSnapshot().error).toContain("未能保存");
    expect(storage.getItem(LIBRARY_KEY)).toBe(before);
    expect(store.getSnapshot().entries[0].note).toBe("");
    spy.mockRestore();
    expect(store.saveNote(story, "重试成功")).toBe(true);
  });
  it("refuses to overwrite corrupted or unsupported stored data", () => {
    const { store, data } = setup();
    data.set(LIBRARY_KEY, "corrupted");
    expect(store.setSaved(story, true)).toBe(false);
    expect(store.getSnapshot().error).toContain("无法读取");
    expect(data.get(LIBRARY_KEY)).toBe("corrupted");
    expect(() => parseLibrary('{"version":2,"entries":[]}')).toThrow();
    expect(() => parseLibrary('{"version":1,"entries":[{}]}')).toThrow();
  });
  it("preserves unrelated changes from another tab and responds to external clears", () => {
    const { store, storage, data } = setup();
    const other = createLibraryStore(() => storage);
    store.getSnapshot(); other.getSnapshot();
    store.setSaved(story, true);
    other.setSaved({ ...story, id: "second" }, true);
    store.refresh();
    expect(store.getSnapshot().entries).toHaveLength(2);
    const snapshot = store.getSnapshot();
    store.refresh();
    expect(store.getSnapshot()).toBe(snapshot);
    const callback = vi.fn(); const off = store.subscribe(callback);
    data.delete(LIBRARY_KEY); store.refresh();
    expect(callback).toHaveBeenCalledOnce(); off();
    expect(store.getSnapshot().entries).toEqual([]);
  });
  it("gracefully handles storage access denial", () => {
    const store = createLibraryStore(() => { throw new Error("blocked"); });
    expect(store.getSnapshot().error).toContain("无法读取");
    expect(store.setSaved(story, true)).toBe(false);
  });
  it("exports only saved entries with notes and project-base article links", () => {
    const { store } = setup();
    store.saveNote(story, "<script>\n# 我的想法");
    store.setSaved({ ...story, id: "removed", title: "移除的内容" }, false);
    const markdown = libraryMarkdown(store.getSnapshot().entries, "https://example.com/visual-radar/");
    expect(markdown).toContain("https://example.com/visual-radar/issues/2026-10-23/#story-sample");
    expect(markdown).toContain("> \\<script\\>");
    expect(markdown).not.toContain("移除的内容");
    expect(markdown).toContain("我的备注");
  });
});
