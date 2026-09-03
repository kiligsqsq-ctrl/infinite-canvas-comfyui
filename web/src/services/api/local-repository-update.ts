export type LocalRepositoryUpdateResult = {
    updated: boolean;
    branch: string;
    upstream: string;
    previousCommit: string;
    currentCommit: string;
};

export class LocalRepositoryUpdateError extends Error {
    constructor(
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

export async function updateLocalRepository(): Promise<LocalRepositoryUpdateResult> {
    let response: Response;
    try {
        response = await fetch("/api/local-repository-update", { method: "POST", headers: { Accept: "application/json" } });
    } catch {
        throw new LocalRepositoryUpdateError("SERVICE_UNAVAILABLE", "Local update service is unavailable");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new LocalRepositoryUpdateError("SERVICE_UNAVAILABLE", "Local update service is unavailable");
    const result = (await response.json()) as LocalRepositoryUpdateResult & { code?: string; message?: string };
    if (!response.ok) throw new LocalRepositoryUpdateError(result.code || "UPDATE_FAILED", result.message || `Update failed (HTTP ${response.status})`);
    return result;
}
