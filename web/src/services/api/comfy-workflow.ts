import axios from "axios";

import { isDesktopRuntime } from "@/lib/desktop-runtime";
import { getComfyWorkflowPreset } from "@/services/comfy-workflow-storage";
import type { AiConfig, ModelCapability } from "@/stores/use-config-store";
import type { ComfyInputBinding, ComfyWorkflow, ComfyWorkflowPreset } from "@/types/comfy-workflow";
import { bearerAuthHeaders } from "./auth-headers";

export type ComfyWorkflowCompatibility = {
    requiredNodeTypes: string[];
    missingNodeTypes: string[];
};

export type ComfyMediaReference = {
    name: string;
    type: string;
    url: string;
    blob?: Blob;
};

type RunComfyWorkflowArgs = {
    workflowId: string;
    capability: Exclude<ModelCapability, "text">;
    config: AiConfig;
    prompt: string;
    images?: string[];
    videos?: ComfyMediaReference[];
    audios?: ComfyMediaReference[];
    params?: Record<string, unknown>;
    signal?: AbortSignal;
};

type ComfyOutputFile = {
    filename: string;
    subfolder?: string;
    type?: string;
    format?: string;
};

export async function checkComfyWorkflowCompatibility(baseUrl: string, apiKey: string | undefined, workflow: ComfyWorkflow): Promise<ComfyWorkflowCompatibility> {
    const comfyUrl = normalizeComfyUrl(baseUrl);
    const response = await axios.get<Record<string, unknown>>(`${comfyUrl}/object_info`, { headers: bearerAuthHeaders(apiKey), timeout: 8000 });
    const installedNodeTypes = new Set(Object.keys(response.data || {}));
    const requiredNodeTypes = Array.from(new Set(Object.values(workflow).map((node) => node.class_type?.trim()).filter((value): value is string => Boolean(value)))).sort();
    return { requiredNodeTypes, missingNodeTypes: requiredNodeTypes.filter((nodeType) => !installedNodeTypes.has(nodeType)) };
}

export async function runComfyWorkflow({ workflowId, capability, config, prompt, images = [], videos = [], audios = [], params = {}, signal }: RunComfyWorkflowArgs): Promise<Blob> {
    const preset = await requireComfyWorkflowPreset(workflowId, capability);
    const workflow = cloneWorkflow(preset.workflow);
    const mapping = preset.mapping;
    const comfyUrl = normalizeComfyUrl(config.baseUrl);
    const headers = bearerAuthHeaders(config.apiKey);

    try {
        await axios.get(`${comfyUrl}/system_stats`, { headers, signal });
    } catch (error) {
        const hint = isDesktopRuntime() ? "请确认服务已启动且地址可访问。" : "请确认服务已启动并允许跨域访问。";
        throw new Error(`无法连接 ComfyUI（${comfyUrl}）。${hint}${errorDetail(error)}`);
    }

    setBinding(workflow, mapping.prompt, prompt);
    setBinding(workflow, mapping.duration, Math.max(1, Number(params.seconds) || 1));
    const requestedSize = String(params.ratio || params.size || "1:1");
    if (!applyCustomDimensions(workflow, mapping.ratio, requestedSize)) setRatioBinding(workflow, mapping.ratio, requestedSize);
    const resolution = Number.parseFloat(String(params.resolution || ""));
    setBinding(workflow, mapping.resolution, Number.isFinite(resolution) ? resolution : params.resolution);
    setBinding(workflow, mapping.seed, Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

    await applySlots(workflow, mapping.imageSlots || [], images, "image", comfyUrl, headers, signal);
    await applySlots(workflow, mapping.videoSlots || [], videos, "video", comfyUrl, headers, signal);
    await applySlots(workflow, mapping.audioSlots || [], audios, "audio", comfyUrl, headers, signal);

    let queued: { prompt_id?: string };
    try {
        queued = (
            await axios.post<{ prompt_id?: string }>(
                `${comfyUrl}/prompt`,
                { prompt: workflow, client_id: createUniqueId("canvas") },
                { headers: { ...headers, "Content-Type": "application/json" }, signal },
            )
        ).data;
    } catch (error) {
        throw new Error(`ComfyUI 拒绝了工作流：${errorDetail(error)}`);
    }
    if (!queued.prompt_id) throw new Error("ComfyUI 没有返回任务 ID");
    const promptId = queued.prompt_id;
    const cancelListener = () => void cancelComfyPrompt(comfyUrl, headers, promptId);
    if (signal?.aborted) cancelListener();
    else signal?.addEventListener("abort", cancelListener, { once: true });

    try {
        const outputFile = await waitForComfyOutput(comfyUrl, headers, promptId, mapping.outputNodeId, capability, signal);
        const query = new URLSearchParams({ filename: outputFile.filename, subfolder: outputFile.subfolder || "", type: outputFile.type || "output" });
        return (
            await axios.get<Blob>(`${comfyUrl}/view?${query.toString()}`, {
                headers,
                responseType: "blob",
                signal,
            })
        ).data;
    } finally {
        signal?.removeEventListener("abort", cancelListener);
    }
}

async function requireComfyWorkflowPreset(workflowId: string, capability: Exclude<ModelCapability, "text">): Promise<ComfyWorkflowPreset> {
    const preset = await getComfyWorkflowPreset(workflowId);
    if (!preset) throw new Error("找不到这个 ComfyUI 工作流，请重新导入并映射");
    if (preset.capability !== capability) throw new Error(`工作流输出类型是${capabilityLabel(preset.capability)}，不能用于${capabilityLabel(capability)}`);
    return preset;
}

function normalizeComfyUrl(baseUrl: string) {
    const comfyUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(comfyUrl)) throw new Error("Base URL 必须是 ComfyUI 地址，例如 http://127.0.0.1:8188");
    return comfyUrl;
}

function cloneWorkflow(workflow: ComfyWorkflow): ComfyWorkflow {
    return typeof structuredClone === "function" ? structuredClone(workflow) : (JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow);
}

function setBinding(workflow: ComfyWorkflow, binding: ComfyInputBinding | undefined, value: unknown) {
    if (!binding || value === undefined) return;
    const node = workflow[binding.nodeId];
    if (!node?.inputs) throw new Error(`映射节点 ${binding.nodeId} 不存在`);
    node.inputs[binding.inputName] = value;
}

function removeNodeAndReferences(workflow: ComfyWorkflow, nodeId: string) {
    delete workflow[nodeId];
    for (const node of Object.values(workflow)) {
        for (const [name, value] of Object.entries(node.inputs || {})) {
            if (Array.isArray(value) && String(value[0]) === String(nodeId)) delete node.inputs[name];
        }
    }
}

function applyCustomDimensions(workflow: ComfyWorkflow, binding: ComfyInputBinding | undefined, value: string) {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (!match || !binding) return false;
    const sourceNodeId = String(binding.nodeId);
    const sourceNode = workflow[sourceNodeId];
    if (!/resolution|size|dimension/i.test(`${sourceNode?.class_type || ""} ${sourceNode?._meta?.title || ""}`)) return false;
    const width = Number(match[1]);
    const height = Number(match[2]);
    let replaced = false;
    for (const node of Object.values(workflow)) {
        for (const [name, input] of Object.entries(node.inputs || {})) {
            if (!Array.isArray(input) || String(input[0]) !== sourceNodeId) continue;
            if (Number(input[1]) === 0) {
                node.inputs[name] = width;
                replaced = true;
            }
            if (Number(input[1]) === 1) {
                node.inputs[name] = height;
                replaced = true;
            }
        }
    }
    if (replaced) delete workflow[sourceNodeId];
    return replaced;
}

function setRatioBinding(workflow: ComfyWorkflow, binding: ComfyInputBinding | undefined, value: string) {
    if (!binding) return;
    const labels: Record<string, string> = {
        "1:1": "1:1 (Square)",
        "2:3": "2:3 (Portrait Photo)",
        "3:2": "3:2 (Photo)",
        "3:4": "3:4 (Portrait Standard)",
        "4:3": "4:3 (Standard)",
        "9:16": "9:16 (Portrait Widescreen)",
        "16:9": "16:9 (Widescreen)",
        "21:9": "21:9 (Ultrawide)",
    };
    const node = workflow[binding.nodeId];
    const current = node?.inputs?.[binding.inputName];
    const mapped = labels[value];
    setBinding(workflow, binding, mapped && (/resolutionselector/i.test(node?.class_type || "") || /^\d+:\d+\s*\(/.test(String(current || ""))) ? mapped : value);
}

async function applySlots(
    workflow: ComfyWorkflow,
    bindings: ComfyInputBinding[],
    values: Array<string | ComfyMediaReference>,
    kind: "image" | "video" | "audio",
    comfyUrl: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
) {
    if (values.length > bindings.length) throw new Error(`当前工作流最多支持 ${bindings.length} 个${kindLabel(kind)}参考，实际收到 ${values.length} 个`);
    const paths = await Promise.all(values.map((value, index) => uploadInput(value, kind, index, comfyUrl, headers, signal)));
    bindings.forEach((binding, index) => (paths[index] ? setBinding(workflow, binding, paths[index]) : removeNodeAndReferences(workflow, binding.nodeId)));
}

async function uploadInput(value: string | ComfyMediaReference, kind: "image" | "video" | "audio", index: number, comfyUrl: string, headers: Record<string, string>, signal?: AbortSignal) {
    const media = typeof value === "string" ? { url: value, name: `reference_${index + 1}` } : value;
    const blob = await mediaBlob(media, `第 ${index + 1} 个${kindLabel(kind)}`, signal);
    const suffix = extensionFor(media.name, blob.type, kind === "image" ? ".png" : kind === "video" ? ".mp4" : ".wav");
    const form = new FormData();
    form.append("image", blob, `${createUniqueId(`canvas_${kind}_${index + 1}`)}${suffix}`);
    form.append("type", "input");
    form.append("subfolder", "infinite-canvas");
    form.append("overwrite", "true");
    const uploaded = (
        await axios.post<{ name?: string; subfolder?: string }>(`${comfyUrl}/upload/image`, form, {
            headers,
            signal,
        })
    ).data;
    if (!uploaded.name) throw new Error("ComfyUI 上传接口没有返回文件名");
    return [uploaded.subfolder, uploaded.name].filter(Boolean).join("/");
}

async function mediaBlob(media: { url: string; blob?: Blob }, label: string, signal?: AbortSignal) {
    if (media.blob instanceof Blob) return media.blob;
    if (!media.url) throw new Error(`${label}没有可读取的文件`);
    const response = await fetch(media.url, { signal });
    if (!response.ok) throw new Error(`读取${label}失败（HTTP ${response.status}）`);
    return response.blob();
}

async function waitForComfyOutput(comfyUrl: string, headers: Record<string, string>, promptId: string, outputNodeId: string, capability: Exclude<ModelCapability, "text">, signal?: AbortSignal) {
    const deadline = Date.now() + 3_600_000;
    for (;;) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const history = (await axios.get<Record<string, unknown>>(`${comfyUrl}/history/${encodeURIComponent(promptId)}`, { headers, signal })).data;
        const entry = history[promptId] as Record<string, unknown> | undefined;
        if (entry) {
            const status = entry.status as { status_str?: string; completed?: boolean; messages?: unknown[] } | undefined;
            if (status?.status_str === "error") throw new Error(`ComfyUI 执行失败：${historyError(status.messages)}`);
            const output = (entry.outputs as Record<string, Record<string, unknown>> | undefined)?.[outputNodeId];
            const files = output ? Object.values(output).flatMap((value) => (Array.isArray(value) ? value : [])) : [];
            const file = findOutputFile(files, capability);
            if (file) return file;
            if (status?.completed === true || status?.status_str === "success") throw new Error(`输出节点 ${outputNodeId} 没有返回${capabilityLabel(capability)}文件`);
        }
        if (Date.now() >= deadline) throw new Error("ComfyUI 工作流等待超时");
        await delay(2500, signal);
    }
}

function findOutputFile(files: unknown[], capability: Exclude<ModelCapability, "text">): ComfyOutputFile | null {
    const pattern = capability === "image" ? /\.(png|jpe?g|webp|gif)(\?.*)?$/i : capability === "audio" ? /\.(mp3|wav|flac|ogg|m4a|aac)(\?.*)?$/i : /\.(mp4|mov|webm|mkv)(\?.*)?$/i;
    const candidates = files.filter((file): file is ComfyOutputFile => Boolean(file && typeof file === "object" && "filename" in file && typeof (file as ComfyOutputFile).filename === "string"));
    return candidates.find((file) => pattern.test(file.filename)) || candidates[0] || null;
}

function historyError(messages: unknown[] | undefined) {
    const failure = messages?.find((item) => Array.isArray(item) && item[0] === "execution_error") as [string, { exception_message?: string; exception_type?: string }] | undefined;
    return failure?.[1]?.exception_message || failure?.[1]?.exception_type || "未知错误";
}

async function cancelComfyPrompt(comfyUrl: string, headers: Record<string, string>, promptId: string) {
    try {
        const response = await fetch(`${comfyUrl}/api/jobs/${encodeURIComponent(promptId)}/cancel`, { method: "POST", headers });
        if (response.ok) return;
    } catch {
        // Fall through to the standard ComfyUI queue endpoints.
    }
    try {
        await fetch(`${comfyUrl}/queue`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ delete: [promptId] }) });
        const queueResponse = await fetch(`${comfyUrl}/queue`, { headers });
        if (!queueResponse.ok) return;
        const queue = (await queueResponse.json()) as { queue_running?: unknown[] };
        const isRunning = (queue.queue_running || []).some((item) => Array.isArray(item) && String(item[1]) === String(promptId));
        if (isRunning) await fetch(`${comfyUrl}/interrupt`, { method: "POST", headers });
    } catch {
        // Cancellation is best effort because ComfyUI variants expose different endpoints.
    }
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

function extensionFor(name: string, type: string, fallback: string) {
    const existing = name.match(/\.([a-z0-9]{1,8})$/i);
    if (existing) return `.${existing[1].toLowerCase()}`;
    const byMime: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/flac": ".flac", "audio/ogg": ".ogg" };
    return byMime[type.toLowerCase()] || fallback;
}

function createUniqueId(prefix: string) {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${id}`;
}

function errorDetail(error: unknown) {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === "string") return data;
        if (data) {
            try {
                return JSON.stringify(data);
            } catch {
                return error.message;
            }
        }
        return error.message;
    }
    return error instanceof Error ? error.message : String(error);
}

function capabilityLabel(capability: string) {
    return capability === "image" ? "图片" : capability === "audio" ? "音频" : capability === "video" ? "视频" : "文本";
}

function kindLabel(kind: "image" | "video" | "audio") {
    return kind === "image" ? "图片" : kind === "video" ? "视频" : "音频";
}
