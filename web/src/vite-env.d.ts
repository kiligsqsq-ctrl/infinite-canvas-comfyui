/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_RELEASES__: import("@/lib/release").ReleaseInfo[];

type DesktopUpdateStatus = "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";

type DesktopUpdateEvent = {
    status: DesktopUpdateStatus;
    version?: string;
    percent?: number;
    message?: string;
};

type DesktopAgentConnection = {
    url: string;
    token: string;
};

interface InfiniteCanvasDesktopApi {
    readonly isDesktop: true;
    getAppInfo?: () => Promise<{ version: string; packaged: boolean; update: DesktopUpdateEvent | { status: "idle"; currentVersion: string } }>;
    checkForUpdates: () => Promise<DesktopUpdateEvent | void>;
    installUpdate?: () => Promise<{ installed: boolean; reason?: string }>;
    onUpdateStatus: (listener: (event: DesktopUpdateEvent) => void) => (() => void) | void;
    startAgent: () => Promise<DesktopAgentConnection>;
    stopAgent?: () => Promise<{ running: false }>;
    getAgentStatus?: () => Promise<({ running: boolean } & Partial<DesktopAgentConnection>)>;
}

interface Window {
    infiniteCanvasDesktop?: InfiniteCanvasDesktopApi;
}

interface ImportMetaEnv {
    // Comma-separated local development plugin URLs, refetched on every startup without caching or persistence.
    readonly VITE_DEV_PLUGINS?: string;
    // Optional build-time analytics configuration, with one independent variable per provider.
    // GA4 measurement ID (G-XXXX)
    readonly VITE_ANALYTICS_GA4_ID?: string;
    // Baidu Analytics site ID
    readonly VITE_ANALYTICS_BAIDU_ID?: string;
}
