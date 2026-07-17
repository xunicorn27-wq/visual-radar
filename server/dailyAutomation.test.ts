import { describe, expect, it, vi } from "vitest";

import { assertCronSecret, runDailyAutomation } from "./dailyAutomation";

describe("dailyAutomation", () => {
  it("rejects missing and incorrect cron secrets", () => {
    expect(() => assertCronSecret("", "configured-secret")).toThrow("定时任务密钥不正确");
    expect(() => assertCronSecret("wrong", "configured-secret")).toThrow("定时任务密钥不正确");
    expect(() => assertCronSecret("configured-secret", "configured-secret")).not.toThrow();
  });

  it("runs collect, analyze, generate and publish in order", async () => {
    const order: string[] = [];
    const result = await runDailyAutomation({
      collect: vi.fn(async () => { order.push("collect"); return { items: 40 }; }),
      analyze: vi.fn(async () => { order.push("analyze"); return { analyzed: 30 }; }),
      generate: vi.fn(async () => { order.push("generate"); return { id: "2026-07-16", stories: 30 }; }),
      publish: vi.fn(async () => { order.push("publish"); return { sent: true }; }),
    });

    expect(order).toEqual(["collect", "analyze", "generate", "publish"]);
    expect(result).toMatchObject({ issueId: "2026-07-16", sent: true });
  });

  it("skips the webhook in dry-run mode", async () => {
    const publish = vi.fn();
    const result = await runDailyAutomation({
      collect: async () => ({ items: 1 }),
      analyze: async () => ({ analyzed: 1 }),
      dryRun: true,
      generate: async () => ({ id: "2026-07-16", stories: 1 }),
      publish,
    });

    expect(publish).not.toHaveBeenCalled();
    expect(result.sent).toBe(false);
  });
});
