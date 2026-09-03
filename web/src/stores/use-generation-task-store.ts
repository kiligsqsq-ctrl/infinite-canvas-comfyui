import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { localForageStorage } from "@/lib/localforage-storage";
import type { CanvasGenerationMode } from "@/types/canvas";

export type GenerationTaskStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export type GenerationTask = {
    id: string;
    projectId: string;
    runningNodeId: string;
    originNodeId: string;
    title: string;
    mode: CanvasGenerationMode;
    status: GenerationTaskStatus;
    createdAt: string;
    updatedAt: string;
};

type GenerationTaskStore = {
    tasks: GenerationTask[];
    beginTask: (input: Pick<GenerationTask, "projectId" | "runningNodeId" | "originNodeId" | "title" | "mode">) => string;
    setTaskStatus: (id: string, status: GenerationTaskStatus) => void;
    removeTask: (id: string) => void;
    clearFinished: (projectId: string) => void;
};

export const useGenerationTaskStore = create<GenerationTaskStore>()(
    persist(
        (set) => ({
            tasks: [],
            beginTask: (input) => {
                const now = new Date().toISOString();
                const id = nanoid();
                set((state) => ({ tasks: [{ ...input, id, status: "queued", createdAt: now, updatedAt: now }, ...state.tasks] }));
                return id;
            },
            setTaskStatus: (id, status) => set((state) => ({ tasks: state.tasks.map((task) => (task.id === id ? { ...task, status, updatedAt: new Date().toISOString() } : task)) })),
            removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
            clearFinished: (projectId) => set((state) => ({ tasks: state.tasks.filter((task) => task.projectId !== projectId || task.status === "queued" || task.status === "running") })),
        }),
        {
            name: "infinite-canvas:generation_tasks",
            storage: createJSONStorage(() => localForageStorage),
            merge: (persisted, current) => {
                const tasks = ((persisted as Partial<GenerationTaskStore> | undefined)?.tasks || []).map((task) =>
                    task.status === "queued" || task.status === "running" ? { ...task, status: "canceled" as const, updatedAt: new Date().toISOString() } : task,
                );
                return { ...current, ...(persisted as Partial<GenerationTaskStore>), tasks };
            },
        },
    ),
);
