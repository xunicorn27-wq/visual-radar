import type { RequestHandler } from "express";

import type { VisualRadarIssue } from "./visualRadarIssue";
import { deliverVisualRadarIssue } from "./weComPublisher";

export interface SendVisualRadarIssueHandlerDependencies {
  deliverIssue?: (
    issue: VisualRadarIssue,
    options: { dryRun: boolean }
  ) => Promise<{ markdown: string; sent: boolean }>;
  getIssue: (issueId: string) => VisualRadarIssue | null;
}

export function createSendVisualRadarIssueHandler(
  dependencies: SendVisualRadarIssueHandlerDependencies
): RequestHandler {
  const deliverIssue = dependencies.deliverIssue || deliverVisualRadarIssue;
  return async (req, res) => {
    try {
      const issue = dependencies.getIssue(String(req.params.issueId));
      if (!issue) {
        res.status(404).json({ error: "日报不存在" });
        return;
      }
      res.json(await deliverIssue(issue, {
        dryRun: req.query.dryRun === "1",
      }));
    } catch (error) {
      res.status(502).json({
        error: "企业微信发送失败",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
