import { App, Button, Modal, Tabs, Tag } from "antd";
import type { TFunction } from "i18next";
import { Download, Pencil, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChannelEditorDrawer } from "@/components/layout/channel-editor-drawer";
import { ConfigLocalStorage } from "@/components/layout/config-local-storage";
import { ConfigLocalServiceStatus } from "@/components/layout/config-local-service-status";
import { LOCAL_SERVICE_PRESETS, type LocalServicePreset } from "@/constant/local-service-presets";
import { exportAppConfig, importAppConfig } from "@/services/config-file";
import { createModelChannel, isLocalModelChannel, isModelChannelReady, modelOptionsFromChannels, normalizeModelOptionValue, selectableModelsByCapability, useConfigStore, type AiConfig, type ApiCallFormat, type ConfigTabKey, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";

export function AppConfigPanel({ showDoneButton = false, initialTab = "channels" }: { showDoneButton?: boolean; initialTab?: ConfigTabKey }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const configInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<ConfigTabKey>(initialTab);
    const [editingChannelId, setEditingChannelId] = useState("");
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const editingChannel = config.channels.find((channel) => channel.id === editingChannelId) || null;
    useEffect(() => setActiveTab(initialTab), [initialTab]);

    const saveConfig = (nextConfig: AiConfig) => {
        (Object.keys(nextConfig) as Array<keyof AiConfig>).forEach((key) => updateConfig(key, nextConfig[key]));
    };

    const finishConfig = () => {
        const ready = config.channels.some(isModelChannelReady);
        setConfigDialogOpen(false);
        if (!ready) return;
        message.success(t(shouldPromptContinue ? "config.savedContinue" : "config.saved"));
        clearPromptContinue();
    };

    const loadConfigFile = async (file: File) => {
        try {
            await importAppConfig(file);
            message.success(t("config.imported"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.importFailed"));
        } finally {
            if (configInputRef.current) configInputRef.current.value = "";
        }
    };

    const updateChannels = (channels: ModelChannel[]) => saveConfig(withChannels(config, channels));

    const addLocalChannel = (preset: LocalServicePreset) => {
        const existing = config.channels.find((channel) => channel.serviceType === preset.serviceType);
        if (existing) {
            setEditingChannelId(existing.id);
            return;
        }
        const channel = createModelChannel({
            name: t(preset.nameKey),
            baseUrl: preset.baseUrl,
            apiKey: preset.apiKey,
            apiFormat: preset.apiFormat,
            serviceType: preset.serviceType,
            models: preset.models.map((model) => ({ ...model })),
        });
        const unusedDefault = config.channels.length === 1 && !config.channels[0].models.length && !config.channels[0].apiKey.trim();
        const channels = unusedDefault ? [{ ...channel, id: config.channels[0].id }] : [...config.channels, channel];
        updateChannels(channels);
        setEditingChannelId(unusedDefault ? config.channels[0].id : channel.id);
    };

    const deleteChannel = (id: string) => {
        if (config.channels.length <= 1) {
            message.warning(t("config.channels.keepOne"));
            return;
        }
        updateChannels(config.channels.filter((channel) => channel.id !== id));
    };

    const saveChannel = (channel: ModelChannel) => {
        updateChannels(config.channels.map((item) => (item.id === channel.id ? channel : item)));
    };

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-stone-800">
                <div className="text-xs text-stone-500">{t("config.fileSecurity")}</div>
                <div className="flex gap-2">
                    <Button icon={<Upload className="size-4" />} onClick={() => configInputRef.current?.click()}>
                        {t("config.import")}
                    </Button>
                    <Button icon={<Download className="size-4" />} onClick={exportAppConfig}>
                        {t("config.export")}
                    </Button>
                    <input ref={configInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => event.target.files?.[0] && void loadConfigFile(event.target.files[0])} />
                </div>
            </div>
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as ConfigTabKey)}
                items={[
                    {
                        key: "channels",
                        label: t("config.tabs.channels"),
                        children: (
                            <div>
                                <section className="mb-5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/20">
                                    <div className="mb-3">
                                        <div className="text-sm font-semibold">{t("config.channels.localQuickTitle")}</div>
                                        <div className="mt-1 text-xs text-stone-500">{t("config.channels.localQuickDescription")}</div>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {LOCAL_SERVICE_PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                className="group rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-indigo-400 hover:shadow-sm dark:border-stone-800 dark:bg-stone-950/70 dark:hover:border-indigo-600"
                                                onClick={() => addLocalChannel(preset)}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-sm font-semibold">{t(preset.nameKey)}</span>
                                                    <span className="text-xs font-medium text-indigo-600 group-hover:text-indigo-500 dark:text-indigo-400">{t("config.channels.addPreset")}</span>
                                                </div>
                                                <div className="mt-1 text-xs text-stone-500">{t(preset.descriptionKey)}</div>
                                                <code className="mt-2 block truncate text-[11px] text-stone-400">{preset.baseUrl}</code>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                                <ConfigLocalServiceStatus />
                                <div className="mb-4 text-xs text-stone-500">{t("config.channels.description")}</div>
                                <div className="space-y-2">
                                    {config.channels.map((channel) => (
                                        <div key={channel.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-800">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="truncate text-sm font-semibold">{channel.name || t("config.channels.unnamed")}</div>
                                                    <Tag color={isLocalModelChannel(channel) ? "purple" : "blue"} className="m-0 shrink-0">
                                                        {t(isLocalModelChannel(channel) ? "config.channels.localTag" : "config.channels.apiTag")}
                                                    </Tag>
                                                </div>
                                                <div className="mt-1 truncate text-xs text-stone-500">
                                                    {apiFormatLabel(channel.apiFormat, t)} · {t("config.channels.modelCount", { count: channel.models.length })} · {channel.baseUrl || t("config.channels.missingUrl")}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => setEditingChannelId(channel.id)}>
                                                    {t("common.edit")}
                                                </Button>
                                                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => deleteChannel(channel.id)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: "local-storage",
                        label: t("config.tabs.localStorage"),
                        children: <ConfigLocalStorage active={activeTab === "local-storage"} />,
                    },
                ]}
            />
            {showDoneButton ? (
                <div className="mt-4 flex justify-end">
                    <Button type="primary" onClick={finishConfig}>
                        {t("common.done")}
                    </Button>
                </div>
            ) : null}
            <ChannelEditorDrawer open={Boolean(editingChannel)} channel={editingChannel} onSave={saveChannel} onClose={() => setEditingChannelId("")} />
        </>
    );
}

export function AppConfigModal() {
    const { t } = useTranslation();
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configTab = useConfigStore((state) => state.configTab);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    return (
        <Modal
            title={
                <div>
                    <div className="text-lg font-semibold">{t("config.title")}</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">{t("config.modalDescription")}</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={null}
        >
            <AppConfigPanel showDoneButton initialTab={configTab} />
        </Modal>
    );
}

function withChannels(config: AiConfig, channels: ModelChannel[]): AiConfig {
    const next: AiConfig = {
        ...config,
        channels,
        models: modelOptionsFromChannels(channels),
        baseUrl: channels[0]?.baseUrl || config.baseUrl,
        apiKey: channels[0]?.apiKey || config.apiKey,
        apiFormat: channels[0]?.apiFormat || config.apiFormat,
        serviceType: channels[0]?.serviceType || config.serviceType,
    };
    return {
        ...next,
        imageModel: pickDefaultModel(next, "image", config.imageModel),
        videoModel: pickDefaultModel(next, "video", config.videoModel),
        textModel: pickDefaultModel(next, "text", config.textModel),
        audioModel: pickDefaultModel(next, "audio", config.audioModel),
    };
}

function pickDefaultModel(config: AiConfig, capability: ModelCapability, current: string) {
    const options = selectableModelsByCapability(config, capability);
    const normalized = normalizeModelOptionValue(current, config.channels);
    return options.includes(normalized) ? normalized : options[0] || "";
}

function apiFormatLabel(apiFormat: ApiCallFormat, t: TFunction) {
    if (apiFormat === "gemini") return "Gemini";
    if (apiFormat === "ark") return t("config.protocols.ark");
    return "OpenAI";
}
