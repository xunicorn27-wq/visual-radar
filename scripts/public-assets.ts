import fs from "node:fs";

export function copyPublicAssets({
  outputDir,
  sourceDir,
}: {
  outputDir: string;
  sourceDir: string;
}) {
  if (!fs.existsSync(sourceDir)) return;
  fs.cpSync(sourceDir, outputDir, { force: true, recursive: true });
}
