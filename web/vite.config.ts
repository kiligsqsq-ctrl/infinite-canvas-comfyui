import { readdirSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { parseChangelog } from "./src/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");
const repositoryDir = resolve(webDir, "..");
const execFileAsync = promisify(execFile);
const updateRepositoryUrl = "https://github.com/kiligsqsq-ctrl/infinite-canvas-comfyui.git";
const updateRepositoryBranch = "main";

type RepositoryUpdateErrorCode = "DIRTY_WORKTREE" | "NO_UPSTREAM" | "DIVERGED" | "NOT_GIT_REPOSITORY" | "UPDATE_FAILED";

class RepositoryUpdateError extends Error {
    constructor(
        public code: RepositoryUpdateErrorCode,
        message: string,
        public status = 409,
    ) {
        super(message);
    }
}

async function runGit(args: string[]) {
    try {
        const result = await execFileAsync("git", args, { cwd: repositoryDir, timeout: 120_000, maxBuffer: 1024 * 1024, windowsHide: true });
        return String(result.stdout || "").trim();
    } catch (error) {
        const detail = error && typeof error === "object" && "stderr" in error ? String(error.stderr || "").trim() : error instanceof Error ? error.message : String(error);
        throw new RepositoryUpdateError("UPDATE_FAILED", detail || "Git command failed", 500);
    }
}

async function updateLocalRepository() {
    const insideWorkTree = await runGit(["rev-parse", "--is-inside-work-tree"]).catch(() => {
        throw new RepositoryUpdateError("NOT_GIT_REPOSITORY", "The application directory is not a Git repository.", 400);
    });
    if (insideWorkTree !== "true") throw new RepositoryUpdateError("NOT_GIT_REPOSITORY", "The application directory is not a Git repository.", 400);

    const changedFiles = await runGit(["status", "--porcelain"]);
    if (changedFiles) throw new RepositoryUpdateError("DIRTY_WORKTREE", "Local source changes must be committed or discarded before updating.");

    const branch = await runGit(["branch", "--show-current"]);
    if (!branch) throw new RepositoryUpdateError("NO_UPSTREAM", "The repository is not currently on a branch.");
    if (branch !== updateRepositoryBranch) throw new RepositoryUpdateError("NO_UPSTREAM", `Automatic updates are only available on the ${updateRepositoryBranch} branch.`);

    const previousCommit = await runGit(["rev-parse", "HEAD"]);
    await runGit(["fetch", updateRepositoryUrl, updateRepositoryBranch]);
    const remoteCommit = await runGit(["rev-parse", "FETCH_HEAD"]);
    const upstream = "kiligsqsq-ctrl/infinite-canvas-comfyui/main";
    if (previousCommit === remoteCommit) return { updated: false, branch, upstream, previousCommit, currentCommit: previousCommit };

    try {
        await execFileAsync("git", ["merge-base", "--is-ancestor", "HEAD", "FETCH_HEAD"], { cwd: repositoryDir, timeout: 30_000, windowsHide: true });
    } catch {
        throw new RepositoryUpdateError("DIVERGED", "The local branch and the GitHub repository have diverged. Automatic update was stopped.");
    }
    await runGit(["merge", "--ff-only", "FETCH_HEAD"]);
    const currentCommit = await runGit(["rev-parse", "HEAD"]);
    return { updated: true, branch, upstream, previousCommit, currentCommit };
}

function localRepositoryUpdater(): Plugin {
    return {
        name: "local-repository-updater",
        configureServer(server) {
            server.middlewares.use("/api/local-repository-update", async (req, res) => {
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                if (req.method !== "POST") {
                    res.statusCode = 405;
                    res.setHeader("Allow", "POST");
                    res.end(JSON.stringify({ code: "METHOD_NOT_ALLOWED" }));
                    return;
                }
                const origin = req.headers.origin;
                if (origin) {
                    try {
                        if (new URL(origin).host !== req.headers.host) throw new Error("Origin mismatch");
                    } catch {
                        res.statusCode = 403;
                        res.end(JSON.stringify({ code: "ORIGIN_NOT_ALLOWED" }));
                        return;
                    }
                }
                try {
                    res.end(JSON.stringify(await updateLocalRepository()));
                } catch (error) {
                    const known = error instanceof RepositoryUpdateError ? error : new RepositoryUpdateError("UPDATE_FAILED", error instanceof Error ? error.message : String(error), 500);
                    res.statusCode = known.status;
                    res.end(JSON.stringify({ code: known.code, message: known.message }));
                }
            });
        },
    };
}

// Expose /plugins/index.json with local plugin files from public/plugins.
// The frontend can discover and list them when enabled; development reads the directory live, while builds emit a static registry.
function localPluginsManifest(): Plugin {
    const pluginsDir = resolve(webDir, "public/plugins");
    const listLocalPlugins = () => {
        try {
            return readdirSync(pluginsDir)
                .filter((file) => file.endsWith(".js"))
                .sort()
                .map((file) => `/plugins/${file}`);
        } catch {
            return [];
        }
    };
    return {
        name: "local-plugins-manifest",
        configureServer(server) {
            server.middlewares.use("/plugins/index.json", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(listLocalPlugins()));
            });
        },
        generateBundle() {
            this.emitFile({ type: "asset", fileName: "plugins/index.json", source: JSON.stringify(listLocalPlugins()) });
        },
    };
}

export default defineConfig({
    base: process.env.VITE_BASE || "/",
    plugins: [react(), localPluginsManifest(), localRepositoryUpdater()],
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(localVersion),
        __APP_RELEASES__: JSON.stringify(parseChangelog(localChangelog)),
    },
});
