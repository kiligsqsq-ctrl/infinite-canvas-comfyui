import { Button, Tag, Tooltip } from "antd";
import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw, Server } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { testChannelConnection } from "@/services/api/channel";
import { isLocalModelChannel, useConfigStore, type ModelChannel } from "@/stores/use-config-store";

type ServiceState = { status: "checking" | "online" | "offline"; latency?: number; detail?: string };

export function ConfigLocalServiceStatus() {
    const { t } = useTranslation();
    const channels = useConfigStore((state) => state.config.channels);
    const localChannels = useMemo(() => channels.filter(isLocalModelChannel), [channels]);
    const [states, setStates] = useState<Record<string, ServiceState>>({});

    const check = useCallback(async (channel: ModelChannel) => {
        const startedAt = performance.now();
        setStates((current) => ({ ...current, [channel.id]: { status: "checking" } }));
        try {
            const result = await testChannelConnection(channel);
            const detail = result.version ? `ComfyUI ${result.version}` : result.modelCount !== undefined ? t("config.serviceStatus.models", { count: result.modelCount }) : undefined;
            setStates((current) => ({ ...current, [channel.id]: { status: "online", latency: Math.round(performance.now() - startedAt), detail } }));
        } catch (error) {
            setStates((current) => ({ ...current, [channel.id]: { status: "offline", detail: error instanceof Error ? error.message : t("config.serviceStatus.unknownError") } }));
        }
    }, [t]);

    const checkAll = useCallback(() => localChannels.forEach((channel) => void check(channel)), [check, localChannels]);

    useEffect(() => {
        if (localChannels.length) checkAll();
    }, [checkAll, localChannels.length]);

    return (
        <section className="mb-5 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold"><Server className="size-4" />{t("config.serviceStatus.title")}</div>
                    <div className="mt-1 text-xs text-stone-500">{t("config.serviceStatus.description")}</div>
                </div>
                <Button type="text" icon={<RefreshCw className="size-4" />} disabled={!localChannels.length || Object.values(states).some((item) => item.status === "checking")} onClick={checkAll}>
                    {t("config.serviceStatus.refresh")}
                </Button>
            </div>
            {localChannels.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                    {localChannels.map((channel) => {
                        const state = states[channel.id];
                        const checking = !state || state.status === "checking";
                        const online = state?.status === "online";
                        return (
                            <div key={channel.id} className="flex min-w-0 items-center gap-3 rounded-lg bg-stone-50 px-3 py-2.5 dark:bg-stone-900/60">
                                {checking ? <LoaderCircle className="size-4 shrink-0 animate-spin text-stone-400" /> : online ? <CircleCheck className="size-4 shrink-0 text-emerald-500" /> : <CircleAlert className="size-4 shrink-0 text-red-500" />}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{channel.name}</div>
                                    <Tooltip title={state?.detail}><div className="truncate text-xs text-stone-500">{state?.detail || channel.baseUrl}</div></Tooltip>
                                </div>
                                <Tag color={checking ? "default" : online ? "success" : "error"} className="m-0 shrink-0">
                                    {checking ? t("config.serviceStatus.checking") : online ? t("config.serviceStatus.online", { latency: state.latency }) : t("config.serviceStatus.offline")}
                                </Tag>
                            </div>
                        );
                    })}
                </div>
            ) : <div className="rounded-lg bg-stone-50 px-3 py-4 text-center text-xs text-stone-500 dark:bg-stone-900/60">{t("config.serviceStatus.empty")}</div>}
        </section>
    );
}
