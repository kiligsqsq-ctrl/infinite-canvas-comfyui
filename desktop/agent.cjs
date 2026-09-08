const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** Start the agent shipped in Electron resources and return its private connection details. */
async function startBundledAgent(options = {}) {
    const electron = options.electron || require("electron");
    const executablePath = options.executablePath || process.execPath;
    const resourcesPath = options.resourcesPath || process.resourcesPath;
    const userDataPath = options.userDataPath || electron.app.getPath("userData");
    const entryPath = options.entryPath || path.join(resourcesPath, "agent", "dist", "index.js");
    const configDir = path.join(userDataPath, "canvas-agent");
    const configFile = path.join(configDir, "canvas-agent.json");
    const logFile = path.join(configDir, "canvas-agent.log");
    const startupTimeoutMs = options.startupTimeoutMs || 20_000;

    if (!fs.existsSync(entryPath)) throw new Error(`Bundled Canvas Agent is missing: ${entryPath}`);
    fs.mkdirSync(configDir, { recursive: true });

    const logFd = fs.openSync(logFile, "a");
    const child = spawn(executablePath, [entryPath], {
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            CANVAS_AGENT_BUNDLED: "1",
            PORT: "0",
            CANVAS_AGENT_CONFIG_DIR: configDir,
        },
        stdio: ["ignore", logFd, logFd, "ipc"],
        windowsHide: true,
    });
    fs.closeSync(logFd);
    child.on("error", () => undefined);

    try {
        const url = await waitForReady(child, startupTimeoutMs);
        await waitForConfig(url, child, startupTimeoutMs);
        const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
        if (config.url !== url || typeof config.token !== "string" || !config.token) throw new Error("Bundled Canvas Agent wrote an invalid config");
        return {
            url,
            token: config.token,
            isRunning: () => child.exitCode === null && child.signalCode === null,
            stop: createStop(child),
        };
    } catch (error) {
        await createStop(child)();
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`${detail}；日志：${logFile}`);
    }
}

function waitForReady(child, timeoutMs) {
    return new Promise((resolve, reject) => {
        const finish = (error, url) => {
            clearTimeout(timer);
            child.off("error", onError);
            child.off("exit", onExit);
            child.off("message", onMessage);
            error ? reject(error) : resolve(url);
        };
        const onError = (error) => finish(error);
        const onExit = (code, signal) => finish(new Error(`Bundled Canvas Agent exited before startup (${signal || code})`));
        const onMessage = (message) => {
            if (message?.type === "ready" && /^http:\/\/127\.0\.0\.1:\d+$/.test(message.url)) finish(null, message.url);
        };
        const timer = setTimeout(() => finish(new Error("Bundled Canvas Agent startup timed out")), timeoutMs);
        timer.unref();
        child.once("error", onError);
        child.once("exit", onExit);
        child.on("message", onMessage);
    });
}

async function waitForConfig(url, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) throw new Error("Bundled Canvas Agent stopped during startup");
        try {
            const response = await fetch(`${url}/config`);
            if (response.ok && (await response.json()).ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Bundled Canvas Agent config endpoint timed out");
}

function createStop(child) {
    let stopping;
    return () => stopping ||= new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        const done = () => {
            clearTimeout(forceTimer);
            resolve();
        };
        const forceTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }, 3_000);
        forceTimer.unref();
        child.once("exit", done);
        if (!child.kill("SIGTERM")) done();
    });
}

module.exports = { startBundledAgent };
