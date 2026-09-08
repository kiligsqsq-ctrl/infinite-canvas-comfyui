import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const agentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = path.resolve(agentDir, "..", "desktop", "resources", "agent");

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(path.join(agentDir, "dist"), path.join(targetDir, "dist"), { recursive: true });
for (const file of ["agent-instructions.md", "package.json", "package-lock.json"]) {
    fs.copyFileSync(path.join(agentDir, file), path.join(targetDir, file));
}

const npmArgs = ["ci", "--omit=dev", "--no-audit", "--no-fund"];
const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
const args = npmCli ? [npmCli, ...npmArgs] : process.platform === "win32" ? ["/d", "/s", "/c", `npm ${npmArgs.join(" ")}`] : npmArgs;
const result = spawnSync(command, args, { cwd: targetDir, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
