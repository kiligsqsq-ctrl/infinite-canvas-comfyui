import type { CSSProperties } from "react";
import { App, Tooltip } from "antd";
import { CloudDownload, Keyboard, Puzzle, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { changeAppLocale, type AppLocale } from "@/i18n";
import { canvasThemes } from "@/lib/canvas-theme";
import { isDesktopRuntime } from "@/lib/desktop-runtime";
import { LocalRepositoryUpdateError, subscribeToDesktopUpdateStatus, updateLocalRepository } from "@/services/api/local-repository-update";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
    onOpenPlugins?: () => void;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts, onOpenPlugins }: UserStatusActionsProps) {
    const { message } = App.useApp();
    const { i18n, t } = useTranslation();
    const [updating, setUpdating] = useState(false);
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const canvasTheme = canvasThemes[theme];
    const naturalIconClass = "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-black/5 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white [&_svg]:size-4";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;
    const locale = i18n.resolvedLanguage as AppLocale;
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    const languageLabel = t("topNav.switchLanguage", { language: t(nextLocale === "zh-CN" ? "locale.zhCN" : "locale.enUS") });

    const showDesktopUpdateStatus = useCallback((event: DesktopUpdateEvent) => {
        const key = "desktop-app-update";
        if (event.status === "checking") message.open({ key, type: "loading", duration: 0, content: t("topNav.desktopUpdate.checking") });
        else if (event.status === "available") message.open({ key, type: "loading", duration: 0, content: t("topNav.desktopUpdate.available", { version: event.version || "" }) });
        else if (event.status === "downloading") message.open({ key, type: "loading", duration: 0, content: t("topNav.desktopUpdate.downloading", { percent: Math.round(event.percent || 0) }) });
        else if (event.status === "downloaded") message.success({ key, content: t("topNav.desktopUpdate.downloaded", { version: event.version || "" }), duration: 5 });
        else if (event.status === "not-available") message.info({ key, content: t("topNav.desktopUpdate.current"), duration: 3 });
        else message.error({ key, content: event.message || t("topNav.desktopUpdate.failed"), duration: 5 });
    }, [message, t]);

    useEffect(() => {
        const unsubscribe = subscribeToDesktopUpdateStatus(showDesktopUpdateStatus);
        return typeof unsubscribe === "function" ? unsubscribe : undefined;
    }, [showDesktopUpdateStatus]);

    const updateRepository = async () => {
        if (updating) return;
        setUpdating(true);
        try {
            const result = await updateLocalRepository();
            if (result.mode === "desktop") {
                showDesktopUpdateStatus(result.event);
                return;
            }
            if (!result.updated) {
                message.info(t("topNav.updateCurrent"));
                return;
            }
            message.success(t("topNav.updateSuccess"));
            window.setTimeout(() => window.location.reload(), 1200);
        } catch (error) {
            if (isDesktopRuntime()) {
                message.error(error instanceof Error && error.message ? error.message : t("topNav.desktopUpdate.failed"));
                return;
            }
            const code = error instanceof LocalRepositoryUpdateError ? error.code : "UPDATE_FAILED";
            const knownKeys: Record<string, string> = {
                DIRTY_WORKTREE: "topNav.updateErrors.dirty",
                NO_UPSTREAM: "topNav.updateErrors.noUpstream",
                DIVERGED: "topNav.updateErrors.diverged",
                NOT_GIT_REPOSITORY: "topNav.updateErrors.notRepository",
                SERVICE_UNAVAILABLE: "topNav.updateErrors.unavailable",
            };
            message.error(t(knownKeys[code] || "topNav.updateErrors.failed"));
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            <Tooltip title={t(isDesktopRuntime() ? "topNav.desktopUpdate.action" : "topNav.updateFromGitHub")} mouseEnterDelay={0.2}>
                <button type="button" className={naturalIconClass} style={iconStyle} disabled={updating} onClick={() => void updateRepository()} aria-label={t(isDesktopRuntime() ? "topNav.desktopUpdate.action" : "topNav.updateFromGitHub")}>
                    <CloudDownload className={updating ? "size-4 animate-pulse" : "size-4"} />
                </button>
            </Tooltip>
            {onOpenPlugins ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenPlugins} aria-label={t("topNav.plugins")} title={t("topNav.plugins")}>
                    <Puzzle className="size-4" />
                </button>
            ) : null}
            {showConfig ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label={t("navigation.config")} title={t("navigation.config")}>
                    <Settings2 className="size-4" />
                </button>
            ) : null}
            <Tooltip title={languageLabel} mouseEnterDelay={0.2}>
                <button type="button" className={`${naturalIconClass} text-[11px] font-semibold tracking-tight`} style={iconStyle} onClick={() => void changeAppLocale(nextLocale)} aria-label={languageLabel}>
                    {locale === "zh-CN" ? "中" : "EN"}
                </button>
            </Tooltip>
            <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className={naturalIconClass} style={iconStyle} aria-label={t(theme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme")} title={t(theme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme")} />
            {onOpenShortcuts ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label={t("topNav.shortcuts")} title={t("topNav.shortcuts")}>
                    <Keyboard className="size-4" />
                </button>
            ) : null}
        </div>
    );
}
