import { useEffect, useRef, useState } from "react";
import { Download, FileWarning, FolderOpen, Home, ImageDown, Images, Keyboard, Menu, PanelLeftClose, PanelLeftOpen, Plus, Redo2, Trash2, Undo2, Upload } from "lucide-react";
import { Badge, Dropdown, Modal, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { CanvasGenerationTaskCenter } from "@/components/canvas/canvas-generation-task-center";
import { testChannelConnection } from "@/services/api/channel";
import { canvasThemes } from "@/lib/canvas-theme";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useConfigStore } from "@/stores/use-config-store";
import { useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasTopBar({
    title,
    titleDraft,
    isTitleEditing,
    onTitleDraftChange,
    onStartTitleEditing,
    onFinishTitleEditing,
    onCancelTitleEditing,
    canUndo,
    canRedo,
    onHome,
    onProjects,
    onCreateProject,
    onDeleteProject,
    onExportProject,
    onExportImage,
    onImportImage,
    onOpenPlugins,
    onUndo,
    onRedo,
    projectId,
    onCancelTask,
    onFocusTask,
    missingMediaCount,
    onOpenMissingMedia,
    saveState = "saved",
}: {
    title: string;
    titleDraft: string;
    isTitleEditing: boolean;
    onTitleDraftChange: (value: string) => void;
    onStartTitleEditing: () => void;
    onFinishTitleEditing: () => void;
    onCancelTitleEditing: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onHome: () => void;
    onProjects: () => void;
    onCreateProject: () => void;
    onDeleteProject: () => void;
    onExportProject: () => void;
    onExportImage: () => void;
    onImportImage: () => void;
    onOpenPlugins: () => void;
    onUndo: () => void;
    onRedo: () => void;
    projectId: string;
    onCancelTask: (runningNodeId: string) => void;
    onFocusTask: (nodeId: string) => void;
    missingMediaCount: number;
    onOpenMissingMedia: () => void;
    saveState?: "saving" | "saved";
}) {
    const colorTheme = useThemeStore((state) => state.theme);
    const { t } = useTranslation();
    const theme = canvasThemes[colorTheme];
    const navigate = useNavigate();
    const projects = useCanvasStore((state) => state.projects);
    const otherProjects = projects.filter((project) => project.id !== projectId);
    const channels = useConfigStore((state) => state.config.channels);
    const comfyChannel = channels.find((channel) => channel.serviceType === "comfyui");
    const [comfyStatus, setComfyStatus] = useState<"none" | "checking" | "online" | "offline">(comfyChannel ? "checking" : "none");
    useEffect(() => {
        if (!comfyChannel) {
            setComfyStatus("none");
            return;
        }
        let active = true;
        const check = async () => {
            setComfyStatus((current) => (current === "online" ? current : "checking"));
            try {
                await testChannelConnection(comfyChannel);
                if (active) setComfyStatus("online");
            } catch {
                if (active) setComfyStatus("offline");
            }
        };
        void check();
        const timer = window.setInterval(() => void check(), 60_000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comfyChannel?.id, comfyChannel?.baseUrl]);
    const comfyColor = comfyStatus === "online" ? "#22c55e" : comfyStatus === "offline" ? "#ef4444" : comfyStatus === "checking" ? "#f59e0b" : "#94a3b8";
    const comfyLabel = comfyStatus === "online" ? t("canvas.comfyOnline") : comfyStatus === "offline" ? t("canvas.comfyOffline") : comfyStatus === "checking" ? t("canvas.comfyChecking") : t("canvas.comfyNone");
    const shortcutGroups = [
        {
            title: t("canvas.shortcut.groupCanvas"),
            items: [
                { keys: ["Ctrl / Space", t("canvas.shortcut.drag")], value: t("canvas.shortcut.toggleTool") },
                { keys: [t("canvas.shortcut.wheel")], value: t("canvas.shortcut.zoom") },
                { keys: [t("canvas.shortcut.zoomSlider")], value: t("canvas.shortcut.preciseZoom") },
                { keys: [t("canvas.shortcut.middleDrag")], value: t("canvas.shortcut.pan") },
                { keys: [t("canvas.shortcut.pinch")], value: t("canvas.shortcut.zoom") },
            ],
        },
        {
            title: t("canvas.shortcut.groupSelect"),
            items: [
                { keys: [t("canvas.shortcut.drag")], value: t("canvas.shortcut.boxSelect") },
                { keys: ["Shift / Cmd", t("canvas.shortcut.click")], value: t("canvas.shortcut.addSelection") },
                { keys: ["Ctrl / Cmd", "A"], value: t("canvas.shortcut.selectAll") },
                { keys: ["Ctrl / Cmd", "C / V"], value: t("canvas.shortcut.copyPaste") },
                { keys: ["Ctrl / Cmd", "Z"], value: t("canvas.undo") },
                { keys: ["Ctrl / Cmd", "Shift", "Z"], value: t("canvas.redo") },
                { keys: ["Ctrl / Cmd", "Y"], value: t("canvas.redo") },
                { keys: ["Delete / Backspace"], value: t("canvas.shortcut.delete") },
                { keys: ["Esc"], value: t("canvas.shortcut.escape") },
            ],
        },
        {
            title: t("canvas.shortcut.groupNode"),
            items: [
                { keys: [t("canvas.shortcut.nudge")], value: t("canvas.shortcut.nudgeDesc") },
                { keys: [t("canvas.shortcut.nudgeFast")], value: t("canvas.shortcut.nudgeFastDesc") },
                { keys: [t("canvas.shortcut.altSnap")], value: t("canvas.shortcut.altSnapDesc") },
                { keys: [t("canvas.shortcut.doubleCreate")], value: t("canvas.shortcut.createMenuDesc") },
                { keys: [t("canvas.shortcut.nodeMenu")], value: t("canvas.shortcut.nodeMenuDesc") },
                { keys: [t("canvas.shortcut.doubleImage")], value: t("canvas.shortcut.viewImageDesc") },
                { keys: [t("canvas.shortcut.doubleText")], value: t("canvas.shortcut.editTextDesc") },
                { keys: [t("canvas.shortcut.doubleTitle")], value: t("canvas.shortcut.renameDesc") },
                { keys: [t("canvas.shortcut.groupFold")], value: t("canvas.shortcut.groupFoldDesc") },
            ],
        },
        {
            title: t("canvas.shortcut.groupMore"),
            items: [
                { keys: [t("canvas.shortcut.dropMedia")], value: t("canvas.shortcut.upload") },
                { keys: [t("canvas.shortcut.dragCanvas")], value: t("canvas.shortcut.pan") },
            ],
        },
    ];
    const titleRef = useRef<HTMLDivElement>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const sidePanelOpen = useCanvasSidePanelStore((state) => state.panelOpen);
    const toggleSidePanel = useCanvasSidePanelStore((state) => state.togglePanel);

    useEffect(() => {
        if (!isTitleEditing) return;
        const close = (event: PointerEvent) => {
            if (!titleRef.current?.contains(event.target as Node)) onFinishTitleEditing();
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [isTitleEditing, onFinishTitleEditing]);

    return (
        <>
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between pl-1 pr-2 sm:pr-4">
                <div className="pointer-events-auto flex min-w-0 items-center gap-2">
                    <Tooltip title={sidePanelOpen ? t("canvas.collapsePanel") : t("canvas.expandPanel")}>
                        <button
                            type="button"
                            onClick={toggleSidePanel}
                            aria-label={sidePanelOpen ? t("canvas.collapsePanel") : t("canvas.expandPanel")}
                            className="grid size-7 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: theme.node.text }}
                        >
                            {sidePanelOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                        </button>
                    </Tooltip>
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: [
                                { key: "home", icon: <Home className="size-4" />, label: t("canvas.home"), onClick: onHome },
                                { key: "projects", icon: <Images className="size-4" />, label: t("canvas.projects"), onClick: onProjects },
                                {
                                    key: "switch",
                                    icon: <FolderOpen className="size-4" />,
                                    label: t("canvas.switchProject"),
                                    disabled: !otherProjects.length,
                                    children: otherProjects.slice(0, 12).map((project) => ({ key: `switch-${project.id}`, label: project.title || t("canvas.node.untitled"), onClick: () => navigate(`/canvas/${project.id}`) })),
                                },
                                { type: "divider" },
                                { key: "new", icon: <Plus className="size-4" />, label: t("canvas.create"), onClick: onCreateProject },
                                { key: "delete", danger: true, icon: <Trash2 className="size-4" />, label: t("canvas.deleteCurrent"), onClick: onDeleteProject },
                                { type: "divider" },
                                { key: "import", icon: <Upload className="size-4" />, label: t("canvas.importAsset"), onClick: onImportImage },
                                { key: "export", icon: <Download className="size-4" />, label: t("canvas.exportCurrent"), onClick: onExportProject },
                                { key: "export-image", icon: <ImageDown className="size-4" />, label: t("canvas.exportImage"), onClick: onExportImage },
                                { type: "divider" },
                                { key: "undo", disabled: !canUndo, icon: <Undo2 className="size-4" />, label: <MenuLabel text={t("canvas.undo")} shortcut="⌘ Z" />, onClick: onUndo },
                                { key: "redo", disabled: !canRedo, icon: <Redo2 className="size-4" />, label: <MenuLabel text={t("canvas.redo")} shortcut="⌘ ⇧ Z / ⌘ Y" />, onClick: onRedo },
                                { type: "divider" },
                                { key: "shortcuts", icon: <Keyboard className="size-4" />, label: t("canvas.shortcuts"), onClick: () => setShortcutsOpen(true) },
                            ],
                        }}
                    >
                        <button type="button" className="grid size-7 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} aria-label={t("canvas.openMenu")}>
                            <Menu className="size-4" />
                        </button>
                    </Dropdown>

                    <div ref={titleRef} className="flex min-w-0 items-center gap-2">
                        {isTitleEditing ? (
                            <input
                                autoFocus
                                value={titleDraft}
                                onChange={(event) => onTitleDraftChange(event.target.value)}
                                onBlur={onFinishTitleEditing}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") onFinishTitleEditing();
                                    if (event.key === "Escape") onCancelTitleEditing();
                                }}
                                className="max-w-[280px] bg-transparent p-0 text-left text-lg font-semibold tracking-normal outline-none"
                                style={{ color: theme.node.text }}
                            />
                        ) : (
                            <button
                                type="button"
                                className="max-w-[280px] truncate border-b border-dashed border-transparent text-left text-lg font-semibold tracking-normal transition hover:border-current"
                                onDoubleClick={onStartTitleEditing}
                                title={t("canvas.renameHint")}
                            >
                                {title}
                            </button>
                        )}
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
                    <span className="hidden text-xs sm:inline" style={{ color: theme.node.muted }}>
                        {saveState === "saving" ? t("canvas.saving") : t("canvas.saved")}
                    </span>
                    <CanvasGenerationTaskCenter projectId={projectId} onCancel={onCancelTask} onFocus={onFocusTask} />
                    {missingMediaCount ? (
                        <Tooltip title={t("canvas.missingMedia.title")}>
                            <Badge count={missingMediaCount} size="small" offset={[-1, 3]}>
                                <button type="button" className="grid size-8 place-items-center rounded-full text-amber-500 transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onOpenMissingMedia} aria-label={t("canvas.missingMedia.title")}><FileWarning className="size-4" /></button>
                            </Badge>
                        </Tooltip>
                    ) : null}
                    <UserStatusActions variant="canvas" onOpenShortcuts={() => setShortcutsOpen(true)} onOpenPlugins={onOpenPlugins} />
                    <button type="button" onClick={() => navigate("/config")} className="flex items-center gap-1.5 rounded-full px-1.5 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10" title={t("canvas.comfyStatusHint")} style={{ color: theme.node.muted }}>
                        <span className="size-2 shrink-0 rounded-full" style={{ background: comfyColor }} />
                        <span className="hidden sm:inline">{comfyLabel}</span>
                    </button>
                </div>
            </div>
            <Modal title={t("canvas.shortcuts")} open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered width={640}>
                <div className="max-h-[70vh] space-y-5 overflow-y-auto border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    {shortcutGroups.map((group) => (
                        <section key={group.title}>
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-50">{group.title}</div>
                            <div className="space-y-1.5">
                                {group.items.map((item, index) => (
                                    <Shortcut key={`${group.title}-${index}`} keys={item.keys} value={item.value} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </Modal>
        </>
    );
}

function MenuLabel({ text, shortcut }: { text: string; shortcut: string }) {
    return (
        <span className="flex min-w-36 items-center justify-between gap-8">
            <span>{text}</span>
            <span className="text-xs opacity-45">{shortcut}</span>
        </span>
    );
}

function Shortcut({ keys, value }: { keys: string[]; value: string }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-6 rounded-lg px-1 py-1.5">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {keys.map((key, index) => (
                    <span key={`${key}-${index}`} className="flex items-center gap-1.5">
                        {index ? <span className="text-xs opacity-35">+</span> : null}
                        <kbd
                            className="min-w-9 rounded-md border px-2.5 py-1.5 text-center text-xs font-medium leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.06)]"
                            style={{ borderColor: "rgba(120,113,108,.28)", background: "linear-gradient(#fff, rgba(245,245,244,.92))", color: "rgb(68,64,60)" }}
                        >
                            {key}
                        </kbd>
                    </span>
                ))}
            </span>
            <span className="text-right text-sm opacity-55">{value}</span>
        </div>
    );
}
