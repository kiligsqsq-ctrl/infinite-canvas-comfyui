import type { ApiCallFormat, ChannelModel, ModelServiceType } from "@/stores/use-config-store";

export type LocalServicePresetId = "comfyui";

export type LocalServicePreset = {
    id: LocalServicePresetId;
    nameKey: string;
    descriptionKey: string;
    serviceType: ModelServiceType;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
};

export const LOCAL_SERVICE_PRESETS: LocalServicePreset[] = [
    {
        id: "comfyui",
        nameKey: "config.localPresets.comfyui.name",
        descriptionKey: "config.localPresets.comfyui.description",
        serviceType: "comfyui",
        baseUrl: "http://127.0.0.1:8188",
        apiKey: "",
        apiFormat: "openai",
        models: [],
    },
];
