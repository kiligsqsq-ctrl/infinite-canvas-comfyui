export function bearerAuthHeaders(apiKey: string | undefined): Record<string, string> {
    const token = apiKey?.trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
