import { timingSafeEqual } from "node:crypto";

export interface DailyAutomationOperations {
  analyze: () => Promise<{ analyzed: number }>;
  collect: () => Promise<{ items: number }>;
  dryRun?: boolean;
  generate: () => Promise<{ id: string; stories: number }>;
  publish: () => Promise<{ sent: boolean }>;
}

export function assertCronSecret(provided: string, configured: string) {
  if (!configured || !provided) throw new Error("定时任务密钥不正确");
  const expected = Buffer.from(configured);
  const received = Buffer.from(provided);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("定时任务密钥不正确");
  }
}

export async function runDailyAutomation(operations: DailyAutomationOperations) {
  const collection = await operations.collect();
  const analysis = await operations.analyze();
  const issue = await operations.generate();
  const publication = operations.dryRun
    ? { sent: false }
    : await operations.publish();
  return {
    analyzed: analysis.analyzed,
    collected: collection.items,
    issueId: issue.id,
    sent: publication.sent,
    stories: issue.stories,
  };
}
