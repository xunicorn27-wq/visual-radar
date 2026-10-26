import type { VisualRadarIssue } from "./visualRadarIssue";
import { stableHash } from "./visualRadarRunStore";
import { DeliveryBlocked } from "./visualRadarDelivery";

export async function verifyPagesIssue(issue: VisualRadarIssue, publicUrl: string, expectedCommit: string, fetchImpl: typeof fetch = fetch) {
  const base = new URL(publicUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.port
    || !/^[a-z0-9-]+\.github\.io$/i.test(base.hostname) || !/^\/[a-z0-9_.-]+\/?$/i.test(base.pathname)) throw new DeliveryBlocked("请配置已核实的 GitHub Pages 项目地址");
  if (!/^[a-f0-9]{40}$/.test(expectedCommit)) throw new DeliveryBlocked("缺少有效提交 SHA");
  const owner = base.hostname.split(".")[0];
  const repo = base.pathname.replace(/^\/|\/$/g, "");
  const root = base.href.replace(/\/$/, "");
  async function read(url: string) {
    const r = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(20000), headers: { "Cache-Control": "no-cache", "User-Agent": "VisualRadar-Publication/1" } });
    if (r.status !== 200) throw new DeliveryBlocked(`部署验证失败：HTTP ${r.status}`);
    return r;
  }
  const response = await read(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/pages.yml/runs?head_sha=${expectedCommit}&branch=main&per_page=10`);
  const runs = await response.json() as { workflow_runs?: Array<{ id: number; head_sha: string; head_branch: string; conclusion: string; status: string }> };
  const run = runs.workflow_runs?.find((r) => r.head_sha === expectedCommit && r.head_branch === "main" && r.status === "completed" && r.conclusion === "success");
  if (!run) throw new DeliveryBlocked("对应提交的 Pages 工作流尚未成功");
  const index = await (await read(`${root}/public-data/issues/index.json`)).json() as Array<{ id: string }>;
  if (!Array.isArray(index) || !index.some((entry) => entry.id === issue.id)) throw new DeliveryBlocked("公网索引缺少本期日报");
  const detail = await (await read(`${root}/public-data/issues/${issue.id}.json`)).json() as { issue?: unknown };
  if (stableHash(detail.issue) !== stableHash(issue)) throw new DeliveryBlocked("公网日报与本地版本不一致，请重新部署验证");
  await read(`${root}/issues/${issue.id}/`);
  return { runId: run.id, commit: expectedCommit, issueHash: stableHash(issue), checkedAt: new Date().toISOString() };
}
