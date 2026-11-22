import { useEffect } from "react";
import type { ReactNode } from "react";
import { History, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ContextMenuState } from "@/types/canvas";

type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "distribute-h" | "distribute-v";

export function CanvasNodeContextMenu({
    menu,
    onClose,
    onDuplicate,
    onDelete,
    onToggleLock,
    locked = false,
    onAlign,
    canAlign = false,
    hasHistory = false,
    onOpenHistory,
}: {
    menu: ContextMenuState;
    onClose: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onToggleLock?: () => void;
    locked?: boolean;
    onAlign?: (mode: AlignMode) => void;
    canAlign?: boolean;
    hasHistory?: boolean;
    onOpenHistory?: () => void;
}) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    useEffect(() => {
        const close = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest(".ant-popover")) return;
            onClose();
        };
        window.addEventListener("pointerdown", close);
        return () => window.removeEventListener("pointerdown", close);
    }, [onClose]);

    return (
        <div
            className="fixed z-[80] min-w-44 overflow-hidden rounded-xl border py-1 shadow-2xl"
            style={{ left: menu.x, top: menu.y, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {menu.type === "node" ? <MenuButton icon={<Plus className="size-4" />} label={t("canvas.controls.duplicate")} onClick={onDuplicate} /> : null}
            {menu.type === "node" ? <MenuButton icon={locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />} label={t(locked ? "canvas.controls.unlock" : "canvas.controls.lock")} onClick={onToggleLock} /> : null}
            {menu.type === "node" && hasHistory ? <MenuButton icon={<History className="size-4" />} label={t("canvas.controls.history")} onClick={onOpenHistory} /> : null}
            {menu.type === "node" && canAlign ? (
                <div className="mt-1 border-t px-3 py-2" style={{ borderColor: theme.toolbar.border }}>
                    <div className="mb-1 text-[11px]" style={{ color: theme.node.muted }}>
                        {t("canvas.controls.align")}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        <AlignButton label={t("canvas.controls.alignLeft")} onClick={() => onAlign?.("left")} theme={theme} />
                        <AlignButton label={t("canvas.controls.alignCenterX")} onClick={() => onAlign?.("hcenter")} theme={theme} />
                        <AlignButton label={t("canvas.controls.alignRight")} onClick={() => onAlign?.("right")} theme={theme} />
                        <AlignButton label={t("canvas.controls.alignTop")} onClick={() => onAlign?.("top")} theme={theme} />
                        <AlignButton label={t("canvas.controls.alignCenterY")} onClick={() => onAlign?.("vcenter")} theme={theme} />
                        <AlignButton label={t("canvas.controls.alignBottom")} onClick={() => onAlign?.("bottom")} theme={theme} />
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                        <AlignButton label={t("canvas.controls.distributeH")} onClick={() => onAlign?.("distribute-h")} theme={theme} />
                        <AlignButton label={t("canvas.controls.distributeV")} onClick={() => onAlign?.("distribute-v")} theme={theme} />
                    </div>
                </div>
            ) : null}
            <MenuButton icon={<Trash2 className="size-4" />} label={t("canvas.controls.delete")} onClick={onDelete} danger />
        </div>
    );
}

function MenuButton({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick?: () => void; danger?: boolean }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:opacity-80" style={{ color: danger ? "#f87171" : theme.node.text }} onClick={onClick}>
            {icon}
            <span>{label}</span>
        </button>
    );
}

function AlignButton({ label, onClick, theme }: { label: string; onClick?: () => void; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <button
            type="button"
            className="rounded-md border px-1.5 py-1 text-[11px] transition hover:opacity-80"
            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
            onClick={onClick}
        >
            {label}
        </button>
    );
}
