import { Button, Empty, Modal, Tag } from "antd";
import { FileQuestion, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export type MissingCanvasMedia = { id: string; nodeId: string; imageId?: string; kind: "image" | "video" | "audio"; title: string };

export function findMissingCanvasMedia(nodes: CanvasNodeData[]): MissingCanvasMedia[] {
    return nodes.flatMap((node) => {
        const kind = node.type === CanvasNodeType.Image ? "image" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : null;
        if (!kind) return [];
        const entries: MissingCanvasMedia[] = [];
        const primaryImageId = node.metadata?.primaryImageId || node.metadata?.images?.[0]?.id;
        if (node.metadata?.missingMedia) entries.push({ id: `${node.id}:primary`, nodeId: node.id, imageId: kind === "image" ? primaryImageId : undefined, kind, title: node.title });
        if (kind === "image") {
            node.metadata?.images?.forEach((image, index) => {
                if (image.missingMedia && (!node.metadata?.missingMedia || image.id !== primaryImageId)) entries.push({ id: `${node.id}:${image.id}`, nodeId: node.id, imageId: image.id, kind, title: `${node.title} #${index + 1}` });
            });
        }
        return entries;
    });
}

export function CanvasMissingMediaModal({ open, items, onRelink, onClose }: { open: boolean; items: MissingCanvasMedia[]; onRelink: (item: MissingCanvasMedia) => void; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <Modal open={open} centered width={620} title={t("canvas.missingMedia.title")} footer={<Button onClick={onClose}>{t("common.done")}</Button>} onCancel={onClose}>
            <div className="mb-4 text-sm text-stone-500">{t("canvas.missingMedia.description")}</div>
            {items.length ? (
                <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                    {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                            <FileQuestion className="size-5 shrink-0 text-amber-500" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{item.title}</div>
                                <Tag className="m-0 mt-1">{t(`canvas.nodeTypes.${item.kind}`)}</Tag>
                            </div>
                            <Button icon={<FolderOpen className="size-4" />} onClick={() => onRelink(item)}>{t("canvas.missingMedia.relink")}</Button>
                        </div>
                    ))}
                </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.missingMedia.none")} />}
        </Modal>
    );
}
