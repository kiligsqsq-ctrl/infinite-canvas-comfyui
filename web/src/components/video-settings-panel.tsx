import { type ReactNode } from "react";
import { Switch } from "antd";
import { useTranslation } from "react-i18next";

import { ImageSettingsTheme } from "@/components/image-settings-panel";
import i18n from "@/i18n";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { boolConfig, isSeedanceVideoConfig } from "@/lib/seedance-video";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";

const miniMaxResolutionOptions = ["0.4", "0.9"] as const;
const ratioOptions = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"] as const;
const secondOptions = [5, 10, 15] as const;

export const videoResolutionOptions = miniMaxResolutionOptions.map((value) => ({ value, label: `${value} MP` }));
export const videoSizeOptions = ratioOptions.map((value) => ({ value, label: value }));
export const videoSecondOptions = secondOptions.map(String);

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: VideoSettingsPanelProps) {
    const { t } = useTranslation();
    const miniMaxH3 = isMiniMaxH3VideoConfig(config);
    const seedance = isSeedanceVideoConfig(config);
    const seconds = config.videoSeconds || "5";
    const size = normalizeVideoSizeValue(config.size);
    const megapixels = normalizeMiniMaxResolutionValue(config.vquality);
    const previewMegapixels = miniMaxH3 ? Number(megapixels) : 0.9;
    const dimensions = readSizeDimensions(size, previewMegapixels);
    const generateAudio = boolConfig(config.videoGenerateAudio, true);
    const watermark = boolConfig(config.videoWatermark, false);
    const updateDimension = (key: "width" | "height", value: number | null) => {
        const next = Math.max(1, Math.floor(value || dimensions[key] || 720));
        onConfigChange("size", `${key === "width" ? next : dimensions.width}x${key === "height" ? next : dimensions.height}`);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{t("settingsPanels.video.title")}</div> : null}
                {miniMaxH3 ? (
                    <SettingGroup title={t("settingsPanels.video.megapixels")} color={theme.node.muted}>
                        <div className="grid grid-cols-2 gap-2.5">
                            {miniMaxResolutionOptions.map((value) => (
                                <OptionPill key={value} selected={megapixels === value} theme={theme} onClick={() => onConfigChange("vquality", value)}>
                                    {value} MP
                                </OptionPill>
                            ))}
                        </div>
                    </SettingGroup>
                ) : null}

                <SettingGroup title={t("settingsPanels.video.size")} color={theme.node.muted}>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                        <DimensionInput prefix="W" value={dimensions.width} theme={theme} onChange={(value) => updateDimension("width", value)} />
                        <span className="text-lg opacity-45">↔</span>
                        <DimensionInput prefix="H" value={dimensions.height} theme={theme} onChange={(value) => updateDimension("height", value)} />
                    </div>
                    <div className="grid grid-cols-4 gap-2.5">
                        {ratioOptions.map((value) => {
                            const optionDimensions = dimensionsForRatio(value, previewMegapixels);
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className="flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border bg-transparent px-1 text-sm transition hover:opacity-80"
                                    style={{ borderColor: size === value ? theme.node.text : theme.node.stroke, color: theme.node.text }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={() => onConfigChange("size", value)}
                                >
                                    <SizePreview width={optionDimensions.width} height={optionDimensions.height} color={theme.node.text} />
                                    <span>{value}</span>
                                    {miniMaxH3 ? <span className="text-[9px] leading-none opacity-55">{optionDimensions.width}×{optionDimensions.height}</span> : null}
                                </button>
                            );
                        })}
                    </div>
                </SettingGroup>

                <SettingGroup title={t("settingsPanels.video.seconds")} color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-2.5">
                        {secondOptions.map((value) => (
                            <OptionPill key={value} selected={seconds === String(value)} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>
                                {value}s
                            </OptionPill>
                        ))}
                        <NumberInput value={seconds} min={1} theme={theme} onChange={(value) => onConfigChange("videoSeconds", value)} />
                    </div>
                </SettingGroup>

                {seedance ? (
                    <SettingGroup title={t("settingsPanels.video.output")} color={theme.node.muted}>
                        <div className="grid gap-2 rounded-xl border p-2.5" style={{ borderColor: theme.node.stroke }}>
                            <SwitchRow label={t("settingsPanels.video.generateAudio")} checked={generateAudio} theme={theme} onChange={(checked) => onConfigChange("videoGenerateAudio", String(checked))} />
                            <SwitchRow label={t("settingsPanels.video.watermark")} checked={watermark} theme={theme} onChange={(checked) => onConfigChange("videoWatermark", String(checked))} />
                        </div>
                    </SettingGroup>
                ) : null}
            </div>
        </ImageSettingsTheme>
    );
}

export function isMiniMaxH3VideoConfig(config: Pick<AiConfig, "model" | "videoModel">) {
    return /minimax[\s_-]*h3/i.test(modelOptionName(config.model || config.videoModel));
}

export function videoResolutionLabel(value: string, config?: Pick<AiConfig, "model" | "videoModel">) {
    return config && isMiniMaxH3VideoConfig(config) ? `${normalizeMiniMaxResolutionValue(value)} MP` : `${normalizeVideoResolutionValue(value)}p`;
}

export function videoSizeLabel(value: string) {
    if (ratioOptions.includes(value as (typeof ratioOptions)[number])) return value;
    if (/^\d+x\d+$/i.test(value || "")) return value.toLowerCase();
    return "16:9";
}

export function videoSecondsLabel(value: string) {
    if (String(value).trim() === "-1") return i18n.t("settingsPanels.video.smart");
    return `${value || "5"}s`;
}

export function normalizeVideoSizeValue(value: string) {
    if (ratioOptions.includes(value as (typeof ratioOptions)[number])) return value;
    if (/^\d+x\d+$/i.test(value || "")) return value.toLowerCase();
    return "16:9";
}

export function normalizeVideoResolutionValue(value: string) {
    if (value === "480p" || value === "low") return "480";
    if (value === "720p" || value === "auto" || value === "high" || value === "medium" || value === "0.4" || value === "0.9") return "720";
    return value.replace(/p$/i, "") || "720";
}

export function normalizeMiniMaxResolutionValue(value: string) {
    return value === "0.9" ? "0.9" : "0.4";
}

function OptionPill({ selected, disabled = false, theme, onClick, children }: { selected: boolean; disabled?: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" disabled={disabled} className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35" style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function DimensionInput({ prefix, value, theme, onChange }: { prefix: string; value: number; theme: CanvasTheme; onChange: (value: number | null) => void }) {
    return (
        <label className="flex h-9 overflow-hidden rounded-xl text-sm" style={{ background: theme.node.fill, color: theme.node.text }}>
            <span className="grid w-9 place-items-center" style={{ color: theme.node.muted }}>
                {prefix}
            </span>
            <input type="number" min={1} className="min-w-0 flex-1 bg-transparent px-2 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || null)} onMouseDown={(event) => event.stopPropagation()} />
        </label>
    );
}

function NumberInput({ value, min, max, theme, onChange }: { value: string; min: number; max?: number; theme: CanvasTheme; onChange: (value: string) => void }) {
    return <input type="number" min={min} max={max} className="h-9 min-w-0 rounded-full border bg-transparent px-2 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" style={{ borderColor: theme.node.stroke, color: theme.node.text, WebkitTextFillColor: theme.node.text }} value={value} onChange={(event) => onChange(event.target.value)} onMouseDown={(event) => event.stopPropagation()} />;
}

function SizePreview({ width, height, color }: { width: number; height: number; color: string }) {
    const longSide = Math.max(width, height);
    const previewWidth = Math.max(10, Math.round((width / longSide) * 26));
    const previewHeight = Math.max(10, Math.round((height / longSide) * 26));
    return <span className="rounded-[3px] border-2" style={{ width: previewWidth, height: previewHeight, borderColor: color }} />;
}

function SwitchRow({ label, checked, theme, onChange }: { label: string; checked: boolean; theme: CanvasTheme; onChange: (checked: boolean) => void }) {
    return (
        <div className="flex h-8 items-center justify-between gap-3">
            <span className="text-sm" style={{ color: theme.node.text }}>{label}</span>
            <span onMouseDown={(event) => event.stopPropagation()}><Switch size="small" checked={checked} onChange={onChange} /></span>
        </div>
    );
}

function readSizeDimensions(size: string, megapixels: number) {
    const match = size.match(/^(\d+)x(\d+)$/i);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
    return dimensionsForRatio(ratioValue(size), megapixels);
}

function ratioValue(value: string) {
    if (ratioOptions.includes(value as (typeof ratioOptions)[number])) return value as (typeof ratioOptions)[number];
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (!match) return "16:9" as const;
    const actual = Number(match[1]) / Number(match[2]);
    return ratioOptions.reduce((best, item) => Math.abs(readRatio(item) - actual) < Math.abs(readRatio(best) - actual) ? item : best, ratioOptions[0]);
}

function dimensionsForRatio(ratio: string, megapixels: number) {
    const value = readRatio(ratio);
    const pixels = Math.max(0.01, megapixels) * 1_000_000;
    const width = Math.ceil(Math.sqrt(pixels * value) / 32) * 32;
    const height = Math.ceil(Math.sqrt(pixels / value) / 32) * 32;
    return { width, height };
}

function readRatio(ratio: string) {
    const [width, height] = ratio.split(":").map(Number);
    return width > 0 && height > 0 ? width / height : 16 / 9;
}
