import localforage from "localforage";
import { nanoid } from "nanoid";

import type { ComfyWorkflow, ComfyWorkflowPreset } from "@/types/comfy-workflow";

const store = localforage.createInstance({ name: "infinite-canvas", storeName: "comfy_workflows" });

export async function saveComfyWorkflowPreset(input: Omit<ComfyWorkflowPreset, "id" | "updatedAt"> & { id?: string }) {
    const preset: ComfyWorkflowPreset = { ...input, id: input.id || `workflow:${nanoid()}`, updatedAt: new Date().toISOString() };
    await store.setItem(preset.id, preset);
    return preset;
}

export async function getComfyWorkflowPreset(id: string) {
    return store.getItem<ComfyWorkflowPreset>(id);
}

export async function deleteComfyWorkflowPreset(id: string) {
    await store.removeItem(id);
}

export function parseComfyWorkflow(value: unknown): ComfyWorkflow {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("工作流 JSON 根节点必须是对象");
    const workflow = value as Record<string, unknown>;
    const entries = Object.entries(workflow);
    if (!entries.length) throw new Error("工作流中没有节点");
    for (const [nodeId, node] of entries) {
        if (!node || typeof node !== "object" || Array.isArray(node)) throw new Error(`节点 ${nodeId} 格式不正确`);
        const candidate = node as { class_type?: unknown; inputs?: unknown };
        if (typeof candidate.class_type !== "string" || !candidate.class_type.trim()) throw new Error(`节点 ${nodeId} 缺少 class_type；请确认导出的是 API 格式工作流`);
        const inputs = candidate.inputs;
        if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new Error(`节点 ${nodeId} 缺少 inputs；请从 ComfyUI 导出 API 格式工作流`);
    }
    const nodeIds = new Set(entries.map(([nodeId]) => nodeId));
    for (const [nodeId, node] of entries) {
        for (const [inputName, input] of Object.entries((node as { inputs: Record<string, unknown> }).inputs)) {
            // API-format links normally serialize their source node ID as a string.
            // Numeric pairs can also be legitimate literal values (for example dimensions),
            // so only treat a numeric first item as a link when it names an existing node.
            if (!Array.isArray(input) || input.length !== 2 || typeof input[1] !== "number" || (typeof input[0] !== "string" && !(typeof input[0] === "number" && nodeIds.has(String(input[0]))))) continue;
            if (!nodeIds.has(String(input[0]))) throw new Error(`节点 ${nodeId} 的输入 ${inputName} 引用了不存在的节点 ${input[0]}`);
        }
    }
    return workflow as ComfyWorkflow;
}
