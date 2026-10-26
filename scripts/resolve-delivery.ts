import path from "node:path";
import { loadProjectEnv } from "../server/env";
import { resolveProjectPaths } from "../server/paths";
import { createVisualRadarIssueStore } from "../server/visualRadarIssue";
import { checkedIssueId } from "../server/visualRadarRunStore";
import { readDelivery, resolveDelivery } from "../server/visualRadarDelivery";

const root = path.resolve(import.meta.dirname, ".."); loadProjectEnv(root);
const files = resolveProjectPaths(root);
const [id, outcome, ...notes] = process.argv.slice(2); checkedIssueId(id || "");
if (!outcome) console.log(JSON.stringify({ issueId: id, delivery: readDelivery(files.delivery, id) }, null, 2));
else {
  if (outcome !== "sent" && outcome !== "not-sent") throw new Error("用法：pnpm delivery:resolve YYYY-MM-DD [sent|not-sent 核对说明]");
  const issue = createVisualRadarIssueStore(files.issues).getIssue(id);
  if (!issue) throw new Error("日报不存在");
  console.log(JSON.stringify(resolveDelivery(files.delivery, issue, outcome, notes.join(" ")), null, 2));
}
