import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import type { CanvasNodeData, CanvasNodeHistoryItem } from "@/types/canvas";

export function CanvasNodeHistoryModal({ node, onRestore, onClose }: { node: CanvasNodeData | null; onRestore: (item: CanvasNodeHistoryItem) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const items = node?.metadata?.history || [];
    return (
        <Modal title={t("canvas.history.title")} open={Boolean(node)} onCancel={onClose} footer={null} width={720} destroyOnHidden>
            {items.length ? (
                <div className="grid grid-cols-3 gap-3 pt-1">
                    {items.map((item, index) => (
                        <button
                            key={`${item.createdAt}-${index}`}
                            type="button"
                            className="group relative overflow-hidden rounded-lg border border-stone-200 text-left transition hover:border-indigo-400 dark:border-stone-700 dark:hover:border-indigo-600"
                            onClick={() => {
                                onRestore(item);
                                onClose();
                            }}
                        >
                            {item.content ? (
                                <img src={item.content} alt="" className="aspect-square w-full object-cover" />
                            ) : (
                                <div className="flex aspect-square items-center justify-center bg-stone-100 text-xs text-stone-500 dark:bg-stone-900">{t("canvas.history.noPreview")}</div>
                            )}
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] text-white">{new Date(item.createdAt).toLocaleString()}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="py-10 text-center text-sm text-stone-500">{t("canvas.history.empty")}</div>
            )}
        </Modal>
    );
}
