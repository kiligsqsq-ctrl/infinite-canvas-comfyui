// Content hash used to detect duplicate assets (same file uploaded twice).
export async function hashBlob(blob: Blob): Promise<string> {
    if (!blob || typeof crypto === "undefined" || !crypto.subtle) return "";
    try {
        const buffer = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    } catch {
        return "";
    }
}

export function assetContentHash(asset: { metadata?: Record<string, unknown> }): string {
    const value = asset.metadata?.contentHash;
    return typeof value === "string" ? value : "";
}
