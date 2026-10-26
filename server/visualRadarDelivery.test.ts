import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { VisualRadarIssue } from "./visualRadarIssue";
import { readDelivery, resolveDelivery, sendIssueOnce, WeComRejected } from "./visualRadarDelivery";
import { checkpoint, readRun, stableHash } from "./visualRadarRunStore";
import { verifyPagesIssue } from "./visualRadarPublication";

const issue: VisualRadarIssue = {
  id: "2026-10-26", issueDate: "2026-10-26", generatedAt: "2026-10-26T02:00:00Z", featuredStoryIds: [], stories: [], skipped: [],
  title: "Visual Radar", metadata: { models: [], promptVersion: "test" }, stats: { storyCount: 0, bySource: {}, byTopic: {} },
};
const now = () => "2026-10-26T03:00:00Z";
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "radar-delivery-"));
const options = (directory = temp()) => ({ directory, issue, now, verify: vi.fn(async () => {}), send: vi.fn(async () => ({ markdown: "message", sent: true })) });

describe("durable delivery gate", () => {
  it("sends once and returns the saved receipt on subsequent calls and restarts", async () => {
    const opts = options();
    expect(await sendIssueOnce(opts)).toMatchObject({ sent: true, alreadySent: false });
    expect(await sendIssueOnce({ ...opts })).toMatchObject({ sent: true, alreadySent: true });
    expect(opts.send).toHaveBeenCalledOnce(); expect(opts.verify).toHaveBeenCalledOnce();
    expect(readDelivery(opts.directory, issue.id)).toMatchObject({ status: "sent", attempts: 1 });
    expect(fs.readdirSync(opts.directory)).toEqual([`${issue.id}.json`]);
  });
  it("blocks concurrent requests while the first network operation is pending", async () => {
    const opts = options(); let release!: () => void;
    opts.send.mockImplementation(async () => { await new Promise<void>((done) => { release = done; }); return { markdown: "message", sent: true }; });
    const first = sendIssueOnce(opts);
    await vi.waitFor(() => expect(opts.send).toHaveBeenCalledOnce());
    await expect(sendIssueOnce(opts)).rejects.toThrow("正在发送");
    release(); await first;
    expect(opts.send).toHaveBeenCalledOnce();
  });
  it("records unknown on timeout and will not automatically retry", async () => {
    const opts = options(); opts.send.mockRejectedValue(new Error("timeout with sensitive URL"));
    await expect(sendIssueOnce(opts)).rejects.toThrow("未知");
    expect(readDelivery(opts.directory, issue.id)?.status).toBe("unknown");
    await expect(sendIssueOnce(opts)).rejects.toThrow("人工核对");
    expect(opts.send).toHaveBeenCalledOnce();
    expect(fs.readFileSync(path.join(opts.directory, `${issue.id}.json`), "utf8")).not.toContain("sensitive URL");
  });
  it("requires explicit manual resolution after a definite rejection", async () => {
    const opts = options(); opts.send.mockRejectedValueOnce(new WeComRejected("rejected"));
    await expect(sendIssueOnce(opts)).rejects.toThrow("明确拒绝");
    await expect(sendIssueOnce(opts)).rejects.toThrow("人工核对");
    resolveDelivery(opts.directory, issue, "not-sent", "已核对群消息，未收到；修复配置后允许重试");
    expect(await sendIssueOnce(opts)).toMatchObject({ sent: true });
    expect(readDelivery(opts.directory, issue.id)?.attempts).toBe(2);
  });
  it("accepts manually confirmed delivery without another network request", async () => {
    const opts = options(); opts.send.mockRejectedValueOnce(new Error("connection closed"));
    await expect(sendIssueOnce(opts)).rejects.toThrow();
    resolveDelivery(opts.directory, issue, "sent", "已在群中找到本期消息");
    expect(await sendIssueOnce(opts)).toMatchObject({ alreadySent: true });
    expect(opts.send).toHaveBeenCalledOnce();
    expect(() => resolveDelivery(opts.directory, issue, "not-sent", "尝试重发")).toThrow("已发送");
  });
  it("keeps changed content from reusing a successful issue ID", async () => {
    const opts = options(); await sendIssueOnce(opts);
    await expect(sendIssueOnce({ ...opts, issue: { ...issue, title: "Changed" } })).rejects.toThrow("内容已更新");
    expect(opts.send).toHaveBeenCalledOnce();
  });
  it("does not send before 09:30 or replay legacy issues without receipts", async () => {
    const opts = options();
    await expect(sendIssueOnce({ ...opts, now: () => "2026-10-26T01:29:59Z" })).rejects.toThrow("09:30");
    await expect(sendIssueOnce({ ...opts, now: () => "2026-10-27T03:00:00Z" })).rejects.toThrow("历史日报");
    expect(opts.send).not.toHaveBeenCalled();
  });
  it("blocks before sending when verification fails and permits a safe recheck", async () => {
    const opts = options(); opts.verify.mockRejectedValueOnce(new Error("not deployed"));
    await expect(sendIssueOnce(opts)).rejects.toThrow("not deployed");
    expect(readDelivery(opts.directory, issue.id)).toBeNull();
    expect(opts.send).not.toHaveBeenCalled();
    expect(await sendIssueOnce(opts)).toMatchObject({ sent: true });
  });
  it("blocks a crash marker, malformed record and live-process lock", async () => {
    const opts = options();
    fs.writeFileSync(path.join(opts.directory, `${issue.id}.json`), JSON.stringify({ version: 1, issueId: issue.id, issueHash: stableHash(issue), updatedAt: now(), attempts: 1, status: "sending", history: [] }));
    await expect(sendIssueOnce(opts)).rejects.toThrow("人工核对");
    fs.writeFileSync(path.join(opts.directory, `${issue.id}.json`), "bad JSON");
    await expect(sendIssueOnce(opts)).rejects.toThrow();
    fs.writeFileSync(path.join(opts.directory, `${issue.id}.lock`), JSON.stringify({ pid: process.pid }));
    expect(() => resolveDelivery(opts.directory, issue, "not-sent", "manual")).toThrow("仍在运行");
    expect(opts.send).not.toHaveBeenCalled();
  });
});

describe("run checkpoint invalidation", () => {
  it("keeps unchanged stages and invalidates all downstream stages on content change", () => {
    const dir = temp();
    checkpoint(dir, issue.id, "collected", "a"); checkpoint(dir, issue.id, "prepared", "b"); checkpoint(dir, issue.id, "generated", "c");
    checkpoint(dir, issue.id, "collected", "a"); expect(readRun(dir, issue.id).checkpoints.generated).toBeDefined();
    checkpoint(dir, issue.id, "collected", "changed"); expect(readRun(dir, issue.id).checkpoints.prepared).toBeUndefined();
    expect(readRun(dir, issue.id).checkpoints.generated).toBeUndefined();
    expect(stableHash({ b: 1, a: 2 })).toBe(stableHash({ a: 2, b: 1 }));
  });
});

describe("publication verification", () => {
  const commit = "a".repeat(40);
  function mockFetch(change: { badSha?: boolean; mismatch?: boolean; missingIndex?: boolean; pageStatus?: number } = {}) {
    return vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      const body = u.includes("api.github.com") ? { workflow_runs: [{ id: 123, head_sha: change.badSha ? "bad" : commit, head_branch: "main", status: "completed", conclusion: "success" }] }
        : u.endsWith("index.json") ? (change.missingIndex ? [] : [{ id: issue.id }])
        : u.endsWith(".json") ? { issue: change.mismatch ? { ...issue, title: "wrong" } : issue } : {};
      return new Response(JSON.stringify(body), { status: !u.endsWith(".json") && !u.includes("api.github.com") ? change.pageStatus || 200 : 200 });
    }) as unknown as typeof fetch;
  }
  it("requires the matching successful commit, public index, exact issue data and page", async () => {
    const result = await verifyPagesIssue(issue, "https://owner.github.io/visual-radar", commit, mockFetch());
    expect(result).toMatchObject({ runId: 123, commit, issueHash: stableHash(issue) });
  });
  it.each([{ badSha: true }, { mismatch: true }, { missingIndex: true }, { pageStatus: 404 }])("rejects incomplete publication %j", async (failure) => {
    await expect(verifyPagesIssue(issue, "https://owner.github.io/visual-radar", commit, mockFetch(failure))).rejects.toThrow();
  });
});
