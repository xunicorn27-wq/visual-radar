import { spawn } from "node:child_process";

const children = [
  spawn("node_modules/.bin/tsx", ["server/index.ts"], { stdio: "inherit", env: process.env }),
  spawn("node_modules/.bin/vite", ["--host", "--port", "3100"], { stdio: "inherit", env: process.env }),
];

function stop(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const child of children) {
  child.on("exit", (code) => stop(code || 0));
}
