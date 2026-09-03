import axios from "axios";

import type { ModelChannel } from "@/stores/use-config-store";
import { bearerAuthHeaders } from "./auth-headers";
import { fetchChannelModels } from "./image";

export type ChannelConnectionResult = { modelCount?: number; version?: string };

export async function testChannelConnection(channel: ModelChannel): Promise<ChannelConnectionResult> {
    if (channel.serviceType === "comfyui") {
        const baseUrl = channel.baseUrl.trim().replace(/\/+$/, "");
        const response = await axios.get<{ system?: { comfyui_version?: string } }>(`${baseUrl}/system_stats`, { headers: bearerAuthHeaders(channel.apiKey), timeout: 8000 });
        return { version: response.data?.system?.comfyui_version };
    }
    const models = await fetchChannelModels(channel, { timeout: 8000 });
    return { modelCount: models.length };
}
