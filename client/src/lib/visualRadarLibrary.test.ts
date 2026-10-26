import { describe, expect, it, vi } from "vitest";
import type { VisualRadarArchiveStory } from "./api";
import { createLibraryStore, LIBRARY_KEY, libraryMarkdown, parseLibrary, NOTE_LIMIT } from "./visualRadarLibrary";

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
