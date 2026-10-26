import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { healthRows, healthTime, SourceHealthPanel, SourceHealthTable } from "./SourceHealthPanel";
import type { HealthArtifact, SourceHealth } from "../../lib/api";

const row = (sourceId: string, status: SourceHealth["status"], core = false, count = 0): SourceHealth => ({ sourceId, label: sourceId, status, core, consecutiveFailures: count, lastCheckedAt: "2026-10-23T07:00:00Z", lastSuccessAt: status === "ok" ? "2026-10-23T07:00:00Z" : null, itemCount: status === "ok" ? 8 : 0, error: status === "failed" ? "HTTP 403" : null });
const health: HealthArtifact = { generatedAt: "2026-10-23T07:00:00Z", sources: [row("healthy", "ok", true), row("broken", "failed", true, 2), row("empty", "empty", false, 1)], summary: { attempted: 3, healthy: 1, failed: 1, empty: 1, coreHealthy: 1, coreTotal: 2, alerts: ["broken"] } };
describe("source health panel", () => {
  it("filters attention/core sources and puts repeated failures first without mutating input", () => {
    expect(healthRows(health, "attention").map((s) => s.sourceId)).toEqual(["broken", "empty"]);
    expect(healthRows(health, "core").map((s) => s.sourceId)).toEqual(["broken", "healthy"]);
    expect(healthRows(health, "all")).toHaveLength(3);
    expect(health.sources[0].sourceId).toBe("healthy");
  });
  it("distinguishes unknown success time and historical records", () => {
    expect(healthTime(null)).toBe("尚无记录"); expect(healthTime("invalid")).toBe("尚无记录");
    const html = renderToStaticMarkup(createElement(SourceHealthTable, { health, filter: "attention" }));
    expect(html).toContain("最近一次记录"); expect(html).toContain("新加坡时间");
    expect(html).toContain("HTTP 403"); expect(html).toContain("无有效条目"); expect(html).toContain("尚无记录");
    expect(html).toContain('scope="col"'); expect(html).toContain('scope="row"');
  });
  it("waits for explicit read with a credential and never renders that credential", () => {
    const secret = "private-test-value";
    const locked = renderToStaticMarkup(createElement(SourceHealthPanel, { secret: "" }));
    expect(locked).toContain("输入管理密钥"); expect(locked).toContain("disabled");
    const ready = renderToStaticMarkup(createElement(SourceHealthPanel, { secret }));
    expect(ready).toContain("读取最新记录"); expect(ready).not.toContain(secret);
  });
});
