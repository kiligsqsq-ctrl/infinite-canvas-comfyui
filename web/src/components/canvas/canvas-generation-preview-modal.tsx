import { Alert, Button, Modal, Tag } from "antd";
import { FileText, Image as ImageIcon, Music2, Play, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasGenerationPreviewData, CanvasGenerationPreviewReference } from "@/lib/canvas/canvas-generation-preview";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasGenerationPreviewModal({ data, onClose, onConfirm }: { data: CanvasGenerationPreviewData | null; onClose: () => void; onConfirm: () => void }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (!data) return null;
    return (
        <Modal
            open
            width={820}
            centered
            title={t("canvas.generationPreview.title")}
            onCancel={onClose}
            styles={{ container: { background: theme.node.panel, color: theme.node.text }, header: { background: theme.node.panel, color: theme.node.text }, body: { color: theme.node.text }, footer: { background: theme.node.panel } }}
            footer={
                <>
                    <Button onClick={onClose}>{t("common.cancel")}</Button>
                    <Button type="primary" icon={<Play className="size-4" />} disabled={Boolean(data.warnings.length)} onClick={onConfirm}>
                        {t("canvas.generationPreview.start")}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {data.warnings.length ? <Alert type="warning" showIcon message={t("canvas.generationPreview.blocked")} description={data.warnings.join("；")} /> : <Alert type="success" showIcon message={t("canvas.generationPreview.ready")} />}
                <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2" style={{ borderColor: theme.node.stroke }}>
                    <Info label={t("canvas.generationPreview.model")} value={data.model} muted={theme.node.muted} />
                    <Info label={t("canvas.generationPreview.channel")} value={data.channelName} muted={theme.node.muted} />
                    <Info label={t("canvas.generationPreview.mode")} value={t(`config.channelEditor.capabilities.${data.mode}`)} muted={theme.node.muted} />
                    <Info label={t("canvas.generationPreview.output")} value={data.outputDescription} muted={theme.node.muted} />
                    {data.workflow ? <Info label={t("canvas.generationPreview.workflow")} value={`${data.workflow.name} · ${t("canvas.generationPreview.outputNode", { node: data.workflow.outputNodeId })}`} muted={theme.node.muted} /> : null}
                </div>

                <section>
                    <div className="mb-2 text-sm font-semibold">{t("canvas.generationPreview.prompt")}</div>
                    <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg p-3 text-sm leading-6" style={{ background: theme.node.fill }}>{data.prompt || t("canvas.generationPreview.emptyPrompt")}</div>
                </section>

                <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{t("canvas.generationPreview.references")}</div>
                        {data.workflow ? (
                            <div className="flex flex-wrap gap-1 text-xs text-stone-500">
                                <Tag>{t("canvas.generationPreview.imageLimit", { used: countType(data.references, "image"), limit: data.workflow.imageLimit })}</Tag>
                                <Tag>{t("canvas.generationPreview.videoLimit", { used: countType(data.references, "video"), limit: data.workflow.videoLimit })}</Tag>
                                <Tag>{t("canvas.generationPreview.audioLimit", { used: countType(data.references, "audio"), limit: data.workflow.audioLimit })}</Tag>
                            </div>
                        ) : null}
                    </div>
                    {data.references.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {data.references.map((reference) => <ReferenceItem key={`${reference.type}-${reference.nodeId}`} reference={reference} border={theme.node.stroke} fill={theme.node.fill} />)}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>{t("canvas.generationPreview.noReferences")}</div>
                    )}
                </section>

                <section>
                    <div className="mb-2 text-sm font-semibold">{t("canvas.generationPreview.parameters")}</div>
                    <div className="flex flex-wrap gap-2">
                        {data.parameters.map((item) => (
                            <span key={item.label} className="rounded-md border px-2.5 py-1.5 text-xs" style={{ borderColor: theme.node.stroke }}>
                                <span style={{ color: theme.node.muted }}>{item.label}</span> · {item.value}
                            </span>
                        ))}
                    </div>
                </section>
            </div>
        </Modal>
    );
}

function Info({ label, value, muted }: { label: string; value: string; muted: string }) {
    return (
        <div className="min-w-0">
            <div className="text-xs" style={{ color: muted }}>{label}</div>
            <div className="mt-1 break-words font-medium">{value}</div>
        </div>
    );
}

function ReferenceItem({ reference, border, fill }: { reference: CanvasGenerationPreviewReference; border: string; fill: string }) {
    const Icon = reference.type === "image" ? ImageIcon : reference.type === "video" ? Video : reference.type === "audio" ? Music2 : FileText;
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-lg border p-2" style={{ borderColor: border }}>
            {reference.type === "image" && reference.previewUrl ? <img src={reference.previewUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : reference.type === "video" && reference.previewUrl ? <video src={reference.previewUrl} className="size-12 shrink-0 rounded-md bg-black object-cover" muted preload="metadata" /> : <span className="grid size-12 shrink-0 place-items-center rounded-md" style={{ background: fill }}><Icon className="size-5" /></span>}
            <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{reference.label}</div>
                <div className="truncate text-sm" title={reference.text || reference.title}>{reference.text || reference.title}</div>
            </div>
        </div>
    );
}

function countType(references: CanvasGenerationPreviewReference[], type: CanvasGenerationPreviewReference["type"]) {
    return references.filter((reference) => reference.type === type).length;
}
