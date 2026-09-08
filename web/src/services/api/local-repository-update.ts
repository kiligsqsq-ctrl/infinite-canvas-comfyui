import { isDesktopRuntime } from "@/lib/desktop-runtime";

type SourceRepositoryUpdateResult = {
    mode: "source";
    updated: boolean;
    branch: string;
    upstream: string;
    previousCommit: string;
    currentCommit: string;
};

type SourceRepositoryUpdatePayload = Omit<SourceRepositoryUpdateResult, "mode">;

type DesktopRepositoryUpdateResult = {
    mode: "desktop";
    event: DesktopUpdateEvent;
};

export type LocalRepositoryUpdateResult = SourceRepositoryUpdateResult | DesktopRepositoryUpdateResult;

export class LocalRepositoryUpdateError extends Error {
    constructor(
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

export async function updateLocalRepository(): Promise<LocalRepositoryUpdateResult> {
    if (isDesktopRuntime()) {
        const event = await window.infiniteCanvasDesktop!.checkForUpdates();
        return { mode: "desktop", event: event || { status: "checking" } };
    }

    let response: Response;
    try {
        response = await fetch("/api/local-repository-update", { method: "POST", headers: { Accept: "application/json" } });
    } catch {
        throw new LocalRepositoryUpdateError("SERVICE_UNAVAILABLE", "Local update service is unavailable");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new LocalRepositoryUpdateError("SERVICE_UNAVAILABLE", "Local update service is unavailable");
    const result = (await response.json()) as SourceRepositoryUpdatePayload & { code?: string; message?: string };
    if (!response.ok) throw new LocalRepositoryUpdateError(result.code || "UPDATE_FAILED", result.message || `Update failed (HTTP ${response.status})`);
    return { ...result, mode: "source" };
}

export function subscribeToDesktopUpdateStatus(listener: (event: DesktopUpdateEvent) => void) {
    if (!isDesktopRuntime()) return;
    return window.infiniteCanvasDesktop!.onUpdateStatus(listener);
}
