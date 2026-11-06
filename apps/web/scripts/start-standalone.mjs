// Starts the production standalone server locally (Playwright, manual checks).
// `next build` does not copy static assets into the standalone bundle: Docker does it in
// infra/docker/web.Dockerfile, this script does the same for local runs.
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bundle = path.join(root, ".next/standalone/apps/web");

if (!existsSync(bundle)) {
  console.error("No standalone build found: run `pnpm build` first.");
  process.exit(1);
}

cpSync(path.join(root, "public"), path.join(bundle, "public"), { recursive: true });
cpSync(path.join(root, ".next/static"), path.join(bundle, ".next/static"), { recursive: true });

const server = spawn(process.execPath, [path.join(bundle, "server.js")], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
