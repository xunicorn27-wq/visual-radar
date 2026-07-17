import fs from "node:fs";

export function stagePagesPublicAssets({
  outputDir,
  sourceDir,
}: {
  outputDir: string;
  sourceDir: string;
}) {
  fs.rmSync(outputDir, { force: true, recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(sourceDir)) return;
  fs.cpSync(sourceDir, outputDir, { force: true, recursive: true });
}
