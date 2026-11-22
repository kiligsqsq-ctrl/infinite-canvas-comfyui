// Headless smoke test for the built web app: serve web/dist over HTTP, load it in Electron,
// and fail if the page crashes before rendering (e.g. a blank window due to a broken bundle).
const { app, BrowserWindow } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.resolve(__dirname, "..", "..", "web", "dist");
const STARTUP_TIMEOUT_MS = 45_000;
const RENDER_WAIT_MS = 7_000;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};

const errors = [];
let finished = false;

function fail(message) {
    if (finished) return;
    finished = true;
    console.error(`[smoke] FAIL: ${message}`);
    if (errors.length) console.error(`[smoke] captured errors:\n${errors.join("\n")}`);
    app.exit(1);
}

function pass() {
    if (finished) return;
    finished = true;
    console.log("[smoke] OK: the built web app rendered successfully");
    app.exit(0);
}

function startStaticServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let pathname = "/";
            try {
                pathname = decodeURIComponent((req.url || "/").split("?")[0]);
            } catch {
                res.writeHead(400);
                res.end("bad request");
                return;
            }
            if (pathname === "/") pathname = "/index.html";
            const filePath = path.resolve(WEB_ROOT, `.${pathname}`);
            if (!filePath.startsWith(WEB_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                res.writeHead(404);
                res.end("not found");
                return;
            }
            res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
            fs.createReadStream(filePath).pipe(res);
        });
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => resolve(server));
    });
}

function consoleText(event, level, message) {
    if (event && typeof event === "object" && typeof event.message === "string") return String(event.message);
    return String(message ?? "");
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

const timer = setTimeout(() => fail("startup timed out"), STARTUP_TIMEOUT_MS);

(async () => {
    if (!fs.existsSync(path.join(WEB_ROOT, "index.html"))) {
        fail(`web build not found at ${WEB_ROOT}; run "npm run build:web" first`);
        return;
    }
    const server = await startStaticServer();
    const { port } = server.address();
    await app.whenReady();
    const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { sandbox: true, contextIsolation: true } });
    win.webContents.on("console-message", (event) => {
        const text = typeof event === "object" && event && typeof event.message === "string" ? event.message : "";
        if (text.includes("Uncaught") || text.includes("Unhandled")) errors.push(text);
    });
    win.webContents.on("did-fail-load", (_event, code, description) => fail(`did-fail-load ${code}: ${description}`));
    win.webContents.on("render-process-gone", (_event, details) => fail(`render process gone: ${details.reason}`));
    win.webContents.on("did-finish-load", async () => {
        try {
            await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT_MS));
            const result = await win.webContents.executeJavaScript(
                `(() => { const root = document.getElementById('root'); return { length: root ? root.innerHTML.length : 0, text: (document.body.innerText || '').slice(0, 80) }; })()`,
            );
            if (result.length === 0) fail(`#root is empty; body text: ${JSON.stringify(result.text)}`);
            if (errors.length) fail("uncaught errors detected while rendering");
            clearTimeout(timer);
            pass();
        } catch (error) {
            fail(`render check failed: ${error && error.message ? error.message : String(error)}`);
        }
    });
    win.loadURL(`http://127.0.0.1:${port}/`).catch((error) => fail(`loadURL failed: ${error && error.message ? error.message : String(error)}`));
    server.on("close", () => undefined);
    app.on("before-quit", () => server.close());
})();
