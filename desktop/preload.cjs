const { contextBridge, ipcRenderer } = require("electron");

const updateChannel = "desktop:update-status";

contextBridge.exposeInMainWorld("infiniteCanvasDesktop", Object.freeze({
    isDesktop: true,
    getAppInfo: () => ipcRenderer.invoke("desktop:get-app-info"),
    checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
    installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
    onUpdateStatus(callback) {
        if (typeof callback !== "function") return () => undefined;
        const listener = (_event, status) => callback(status);
        ipcRenderer.on(updateChannel, listener);
        return () => ipcRenderer.removeListener(updateChannel, listener);
    },
    startAgent: () => ipcRenderer.invoke("desktop:start-agent"),
    stopAgent: () => ipcRenderer.invoke("desktop:stop-agent"),
    getAgentStatus: () => ipcRenderer.invoke("desktop:get-agent-status"),
}));
