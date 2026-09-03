import { Badge, Button, Drawer, Empty, Tag, Tooltip } from "antd";
import { CheckCircle2, CircleStop, Clock3, Focus, ListTodo, LoaderCircle, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useGenerationTaskStore, type GenerationTask } from "@/stores/use-generation-task-store";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasGenerationTaskCenter({ projectId, onCancel, onFocus }: { projectId: string; onCancel: (runningNodeId: string) => void; onFocus: (nodeId: string) => void }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const tasks = useGenerationTaskStore((state) => state.tasks);
    const removeTask = useGenerationTaskStore((state) => state.removeTask);
    const clearFinished = useGenerationTaskStore((state) => state.clearFinished);
    const [open, setOpen] = useState(false);
    const projectTasks = useMemo(() => tasks.filter((task) => task.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [projectId, tasks]);
    const activeCount = projectTasks.filter((task) => task.status === "queued" || task.status === "running").length;

    return (
        <>
            <Tooltip title={t("canvas.taskCenter.title")}>
                <Badge count={activeCount} size="small" offset={[-1, 3]}>
                    <button type="button" className="grid size-8 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} onClick={() => setOpen(true)} aria-label={t("canvas.taskCenter.title")}>
                        <ListTodo className="size-4" />
                    </button>
                </Badge>
            </Tooltip>
            <Drawer open={open} width={420} title={t("canvas.taskCenter.title")} onClose={() => setOpen(false)} extra={<Button type="text" disabled={!projectTasks.some(isFinished)} onClick={() => clearFinished(projectId)}>{t("canvas.taskCenter.clearFinished")}</Button>}>
                {projectTasks.length ? (
                    <div className="space-y-2">
                        {projectTasks.map((task) => (
                            <div key={task.id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                                <div className="flex items-start gap-3">
                                    <TaskIcon task={task} />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{task.title || t(`config.channelEditor.capabilities.${task.mode}`)}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                            <Tag color={task.status === "completed" ? "success" : task.status === "failed" ? "error" : task.status === "canceled" ? "default" : "processing"} className="m-0">{t(`canvas.taskCenter.status.${task.status}`)}</Tag>
                                            <span>{t(`config.channelEditor.capabilities.${task.mode}`)}</span>
                                            <span>{new Date(task.updatedAt).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <Tooltip title={t("canvas.taskCenter.focus")}><Button type="text" size="small" icon={<Focus className="size-4" />} onClick={() => (onFocus(task.runningNodeId), setOpen(false))} /></Tooltip>
                                        {task.status === "queued" || task.status === "running" ? (
                                            <Tooltip title={t("canvas.taskCenter.cancel")}><Button type="text" danger size="small" icon={<CircleStop className="size-4" />} onClick={() => onCancel(task.runningNodeId)} /></Tooltip>
                                        ) : (
                                            <Tooltip title={t("common.delete")}><Button type="text" size="small" icon={<Trash2 className="size-4" />} onClick={() => removeTask(task.id)} /></Tooltip>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.taskCenter.empty")} />}
            </Drawer>
        </>
    );
}

function isFinished(task: GenerationTask) {
    return task.status === "completed" || task.status === "failed" || task.status === "canceled";
}

function TaskIcon({ task }: { task: GenerationTask }) {
    if (task.status === "queued") return <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-500" />;
    if (task.status === "running") return <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-blue-500" />;
    if (task.status === "completed") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />;
    if (task.status === "failed") return <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />;
    return <XCircle className="mt-0.5 size-4 shrink-0 text-stone-400" />;
}
