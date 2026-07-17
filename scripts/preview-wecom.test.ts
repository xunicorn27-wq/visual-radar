import { describe, expect, it, vi } from "vitest";

import { buildPreviewRequest, previewWeComIssue } from "./preview-wecom";

describe("buildPreviewRequest", () => {
  it("builds a POST request that can only preview one existing issue", () => {
    expect(
      buildPreviewRequest({
        automationUrl: "https://automation.example.com/ignored/base/",
        cronSecret: "local-secret",
        issueId: "2026-07-16",
      })
    ).toEqual({
      init: {
        headers: { "x-cron-secret": "local-secret" },
        method: "POST",
      },
      url: "https://automation.example.com/api/visual-radar/issues/2026-07-16/send-wecom?dryRun=1",
    });
  });

  it("uses the local Express service by default", () => {
    expect(
      buildPreviewRequest({
        cronSecret: "local-secret",
        issueId: "2026-07-16",
      }).url
    ).toBe(
      "http://localhost:3099/api/visual-radar/issues/2026-07-16/send-wecom?dryRun=1"
    );
  });

  it.each(["2026-02-30", "2026-7-16", "../2026-07-16", ""])(
    "rejects invalid issue id %s",
    (issueId) => {
      expect(() =>
        buildPreviewRequest({ cronSecret: "local-secret", issueId })
      ).toThrow("Issue ID must be a real YYYY-MM-DD date");
    }
  );

  it("requires a CRON_SECRET", () => {
    expect(() =>
      buildPreviewRequest({ cronSecret: " ", issueId: "2026-07-16" })
    ).toThrow("CRON_SECRET is required");
  });

  it("returns only the Markdown dry-run response without sending elsewhere", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ markdown: "preview markdown", sent: false }),
    });

    await expect(
      previewWeComIssue({
        env: { CRON_SECRET: "local-secret" },
        fetchImpl: fetchImpl as typeof fetch,
        issueId: "2026-07-16",
      })
    ).resolves.toEqual({ markdown: "preview markdown", sent: false });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/send-wecom\?dryRun=1$/),
      expect.objectContaining({ method: "POST" })
    );
  });
});
