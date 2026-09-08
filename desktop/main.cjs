const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    Menu,
    net,
    protocol,
    session,
    shell,
} = require("electron");
const log = require("electron-log/main");
const { autoUpdater } = require("electron-updater");

const { startBundledAgent } = require("./agent.cjs");
const { assertLocalTarget } = require("./local-network.cjs");

const APP_ORIGIN = "app://infinite-canvas";
const LOCAL_PROXY_ORIGIN = "canvas-local://proxy";
const UPDATE_CHANNEL = "desktop:update-status";
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;
const APP_PERMISSIONS = new Set(["clipboard-read", "clipboard-sanitized-write", "local-network", "local-network-access", "loopback-network"]);
const CONTENT_SECURITY_POLICY = [
    "default-src 'self' data: blob:",
    "script-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http: https:",
    "media-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${LOCAL_PROXY_ORIGIN} blob: http: https: ws: wss:`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
].join("; ");

protocol.registerSchemesAsPrivileged([{
    scheme: "app",
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        codeCache: true,
    },
}, {
    scheme: "canvas-local",
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
    },
}]);

let mainWindow = null;
let bundledAgent = null;
let bundledAgentStart = null;
let updateReady = false;
let updateState = { status: "idle", currentVersion: app.getVersion() };
let quitAfterAgentStops = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
});

app.on("before-quit", (event) => {
    if (quitAfterAgentStops || (!bundledAgent && !bundledAgentStart)) return;
    event.preventDefault();
    void stopAgent().finally(() => {
        quitAfterAgentStops = true;
        app.quit();
    });
});

app.whenReady().then(async () => {
    app.setAppUserModelId("com.kiligsqsq.infinitecanvas");
    Menu.setApplicationMenu(null);
    log.initialize();
    await protocol.handle("app", handleAppRequest);
    await protocol.handle("canvas-local", handleLocalProxyRequest);
    configurePermissions();
    registerIpc();
    createWindow();
    configureUpdater();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

function createWindow() {
    const iconPath = path.join(__dirname, "build", "icon.png");
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 950,
        minWidth: 1024,
        minHeight: 680,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: "#0b0b0c",
        ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
    });
    mainWindow.once("ready-to-show", () => {
        if (process.env.INFINITE_CANVAS_SMOKE_TEST !== "1") mainWindow?.show();
    });
    mainWindow.on("closed", () => { mainWindow = null; });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isSafeExternalUrl(url)) void shell.openExternal(url);
        return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (isAppUrl(url)) return;
        event.preventDefault();
        if (isSafeExternalUrl(url)) void shell.openExternal(url);
    });
    if (process.env.INFINITE_CANVAS_SMOKE_TEST === "1") attachSmokeTest(mainWindow);
    void mainWindow.loadURL(`${APP_ORIGIN}/`);
}

async function handleAppRequest(request) {
    const requestUrl = new URL(request.url);
    if (requestUrl.host !== "infinite-canvas") return textResponse("Not found", 404);
    if (!["GET", "HEAD"].includes(request.method)) return textResponse("Method not allowed", 405);

    const webRoot = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..", "web", "dist");
    let pathname;
    try {
        pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
        return textResponse("Bad request", 400);
    }
    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    let filePath = path.resolve(webRoot, `.${requestedPath}`);
    if (!isInside(webRoot, filePath)) return textResponse("Forbidden", 403);

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!isFile(filePath) && (acceptsHtml || !path.extname(filePath))) filePath = path.join(webRoot, "index.html");
    if (!isFile(filePath)) return textResponse("Not found", 404);

    const headers = new Headers();
    const range = request.headers.get("range");
    if (range) headers.set("range", range);
    const source = await net.fetch(pathToFileURL(filePath).toString(), { method: request.method, headers });
    const responseHeaders = new Headers(source.headers);
    responseHeaders.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    if (path.basename(filePath) === "index.html") responseHeaders.set("Cache-Control", "no-cache");
    return new Response(source.body, { status: source.status, statusText: source.statusText, headers: responseHeaders });
}

async function handleLocalProxyRequest(request) {
    const requestUrl = new URL(request.url);
    if (requestUrl.host !== "proxy" || requestUrl.pathname !== "/") return textResponse("Not found", 404);
    if (request.method === "OPTIONS") return proxyPreflightResponse(request);

    const response = await proxyLocalRequest(request, requestUrl);
    const headers = new Headers(response.headers);
    for (const name of [
        "access-control-allow-credentials",
        "access-control-allow-headers",
        "access-control-allow-methods",
        "access-control-allow-origin",
        "access-control-expose-headers",
        "set-cookie",
        "set-cookie2",
    ]) headers.delete(name);
    headers.set("Access-Control-Allow-Origin", APP_ORIGIN);
    headers.set("Access-Control-Expose-Headers", "*");
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    headers.set("Vary", "Origin");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function proxyPreflightResponse(request) {
    const requestedHeaders = request.headers.get("access-control-request-headers") || "";
    if (requestedHeaders && !/^[-a-z0-9_, ]+$/i.test(requestedHeaders)) return textResponse("Bad request", 400);
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Headers": requestedHeaders,
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Origin": APP_ORIGIN,
            "Access-Control-Max-Age": "600",
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Vary": "Origin, Access-Control-Request-Headers",
        },
    });
}

async function proxyLocalRequest(request, requestUrl) {
    const value = requestUrl.searchParams.get("url") || "";
    try {
        const target = await assertLocalTarget(value);
        const headers = new Headers(request.headers);
        for (const name of ["host", "origin", "referer", "cookie", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user"]) headers.delete(name);
        const init = { method: request.method, headers, redirect: "error" };
        if (!["GET", "HEAD"].includes(request.method)) {
            init.body = request.body;
            init.duplex = "half";
        }
        return await net.fetch(target.toString(), init);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = /只允许|无效|无法解析/.test(message) ? 403 : 502;
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "content-type": "application/json; charset=utf-8" },
        });
    }
}

function configurePermissions() {
    session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
        return typeof requestingOrigin === "string" && requestingOrigin.startsWith(`${APP_ORIGIN}/`) && APP_PERMISSIONS.has(permission);
    });
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(isAppUrl(webContents.getURL()) && APP_PERMISSIONS.has(permission));
    });
}

function registerIpc() {
    ipcMain.handle("desktop:get-app-info", (event) => {
        validateIpcSender(event);
        return { version: app.getVersion(), platform: process.platform, packaged: app.isPackaged, update: updateState };
    });
    ipcMain.handle("desktop:check-for-updates", async (event) => {
        validateIpcSender(event);
        return checkForUpdates(true);
    });
    ipcMain.handle("desktop:install-update", async (event) => {
        validateIpcSender(event);
        if (!updateReady) return { installed: false, reason: "not-downloaded" };
        await installDownloadedUpdate();
        return { installed: true };
    });
    ipcMain.handle("desktop:start-agent", async (event) => {
        validateIpcSender(event);
        return startAgent();
    });
    ipcMain.handle("desktop:stop-agent", async (event) => {
        validateIpcSender(event);
        await stopAgent();
        return { running: false };
    });
    ipcMain.handle("desktop:get-agent-status", (event) => {
        validateIpcSender(event);
        return bundledAgent?.isRunning() ? { running: true, url: bundledAgent.url, token: bundledAgent.token } : { running: false };
    });
}

function configureUpdater() {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => publishUpdate({ status: "checking" }));
    autoUpdater.on("update-available", (info) => publishUpdate({ status: "available", version: info.version }));
    autoUpdater.on("update-not-available", (info) => publishUpdate({ status: "not-available", version: info.version || app.getVersion() }));
    autoUpdater.on("download-progress", (progress) => publishUpdate({ status: "downloading", percent: Math.round(progress.percent * 10) / 10 }));
    autoUpdater.on("update-downloaded", (info) => {
        updateReady = true;
        publishUpdate({ status: "downloaded", version: info.version });
        void promptToInstall(info.version);
    });
    autoUpdater.on("error", (error) => publishUpdate({ status: "error", message: error?.message || String(error) }));
    if (!app.isPackaged) return;
    setTimeout(() => void checkForUpdates(false), 10_000).unref();
    setInterval(() => void checkForUpdates(false), UPDATE_INTERVAL_MS).unref();
}

async function checkForUpdates(userInitiated) {
    if (!app.isPackaged) {
        const result = { status: "not-available", version: app.getVersion(), message: "开发模式不会检查安装包更新" };
        publishUpdate(result);
        return result;
    }
    try {
        await autoUpdater.checkForUpdates();
        return updateState;
    } catch (error) {
        const result = { status: "error", message: error instanceof Error ? error.message : String(error) };
        publishUpdate(result);
        if (userInitiated) log.error("Manual update check failed", error);
        return result;
    }
}

async function promptToInstall(version) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "更新已下载",
        message: `无限画布 ${version} 已下载完成`,
        detail: "现在重启即可自动完成安装。画布数据和本地配置会保留。",
        buttons: ["立即重启更新", "稍后"],
        defaultId: 0,
        cancelId: 1,
    });
    if (response === 0) await installDownloadedUpdate();
}

async function installDownloadedUpdate() {
    await stopAgent();
    quitAfterAgentStops = true;
    autoUpdater.quitAndInstall(false, true);
}

function publishUpdate(patch) {
    updateState = { ...patch, currentVersion: app.getVersion() };
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send(UPDATE_CHANNEL, updateState);
}

async function startAgent() {
    if (bundledAgent && !bundledAgent.isRunning()) bundledAgent = null;
    if (bundledAgent) return { url: bundledAgent.url, token: bundledAgent.token };
    if (!bundledAgentStart) {
        const resourcesPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, "resources");
        bundledAgentStart = startBundledAgent({ resourcesPath })
            .then((agent) => (bundledAgent = agent))
            .finally(() => { bundledAgentStart = null; });
    }
    const agent = await bundledAgentStart;
    return { url: agent.url, token: agent.token };
}

async function stopAgent() {
    const pending = bundledAgentStart;
    if (pending) {
        try { await pending; } catch { /* Startup already failed. */ }
    }
    const agent = bundledAgent;
    bundledAgent = null;
    if (agent) await agent.stop();
}

function validateIpcSender(event) {
    if (!event.senderFrame || !isAppUrl(event.senderFrame.url)) throw new Error("Rejected IPC request from an untrusted page");
}

function isAppUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "app:" && url.host === "infinite-canvas";
    } catch {
        return false;
    }
}

function isSafeExternalUrl(value) {
    try {
        return ["https:", "http:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

function isInside(root, target) {
    const relative = path.relative(root, target);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isFile(value) {
    try {
        return fs.statSync(value).isFile();
    } catch {
        return false;
    }
}

function textResponse(value, status) {
    return new Response(value, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function attachSmokeTest(window) {
    const timeout = setTimeout(() => {
        finishSmokeTest("DESKTOP_SMOKE_TEST timeout", 2);
    }, 30_000);
    timeout.unref();
    window.webContents.once("did-fail-load", (_event, code, description) => {
        clearTimeout(timeout);
        finishSmokeTest(`DESKTOP_SMOKE_TEST load failed (${code}): ${description}`, 2);
    });
    window.webContents.once("did-finish-load", () => {
        setTimeout(async () => {
            try {
                const testAgent = process.env.INFINITE_CANVAS_SMOKE_AGENT === "1";
                const result = await window.webContents.executeJavaScript(`(async () => {
                    const api = window.infiniteCanvasDesktop;
                    const base = {
                        href: window.location.href,
                        title: document.title,
                        hasDesktopApi: Boolean(api?.isDesktop),
                        hasApp: Boolean(document.getElementById("root")?.childElementCount),
                    };
                    if (!${JSON.stringify(testAgent)}) return base;
                    const agent = await api.startAgent();
                    const response = await fetch(agent.url + "/health");
                    const stateResponse = await fetch(agent.url + "/canvas/state?clientId=desktop-smoke", {
                        method: "POST",
                        headers: { "content-type": "application/json", "x-canvas-agent-token": agent.token },
                        body: JSON.stringify({ nodes: [], connections: [] }),
                    });
                    await api.stopAgent();
                    const restartedAgent = await api.startAgent();
                    const restartedResponse = await fetch(restartedAgent.url + "/health");
                    await api.stopAgent();
                    return {
                        ...base,
                        proxyIsolated: new URL("${LOCAL_PROXY_ORIGIN}/").origin !== window.location.origin,
                        agentStatus: response.status,
                        agentPostStatus: stateResponse.status,
                        restartedAgentStatus: restartedResponse.status,
                    };
                })()`);
                const ok = result.href === `${APP_ORIGIN}/`
                    && result.hasDesktopApi
                    && result.hasApp
                    && (!testAgent || (result.proxyIsolated && result.agentStatus === 200 && result.agentPostStatus === 200 && result.restartedAgentStatus === 200));
                clearTimeout(timeout);
                finishSmokeTest(`DESKTOP_SMOKE_TEST ${JSON.stringify(result)}`, ok ? 0 : 2);
            } catch (error) {
                clearTimeout(timeout);
                finishSmokeTest(`DESKTOP_SMOKE_TEST ${error instanceof Error ? error.stack || error.message : String(error)}`, 2);
            }
        }, 1_500).unref();
    });
}

function finishSmokeTest(message, code) {
    (code === 0 ? console.log : console.error)(message);
    const outputPath = process.env.INFINITE_CANVAS_SMOKE_OUTPUT;
    if (outputPath) {
        try { fs.writeFileSync(path.resolve(outputPath), `${message}\n`, "utf8"); } catch { /* Console output remains available. */ }
    }
    app.exit(code);
}
