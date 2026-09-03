import type { ApiCallFormat, ChannelModel, ModelServiceType } from "@/stores/use-config-store";

export type LocalServicePresetId = "comfyui" | "ollama" | "lm-studio" | "local-openai";

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
        models: [{ name: "MiniMax-H3", capability: "video" }],
    },
    {
        id: "ollama",
        nameKey: "config.localPresets.ollama.name",
        descriptionKey: "config.localPresets.ollama.description",
        serviceType: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        apiKey: "",
        apiFormat: "openai",
        models: [],
    },
    {
        id: "lm-studio",
        nameKey: "config.localPresets.lmStudio.name",
        descriptionKey: "config.localPresets.lmStudio.description",
        serviceType: "lm-studio",
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "",
        apiFormat: "openai",
        models: [],
    },
    {
        id: "local-openai",
        nameKey: "config.localPresets.localOpenAI.name",
        descriptionKey: "config.localPresets.localOpenAI.description",
        serviceType: "local-openai",
        baseUrl: "http://127.0.0.1:8000/v1",
        apiKey: "",
        apiFormat: "openai",
        models: [],
    },
];
