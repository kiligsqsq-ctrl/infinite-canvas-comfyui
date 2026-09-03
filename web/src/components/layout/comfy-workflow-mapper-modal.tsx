import { Alert, App, Button, Empty, Input, Modal, Select, Spin } from "antd";
import { FileUp, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { checkComfyWorkflowCompatibility, type ComfyWorkflowCompatibility } from "@/services/api/comfy-workflow";
import { getComfyWorkflowPreset, parseComfyWorkflow, saveComfyWorkflowPreset } from "@/services/comfy-workflow-storage";
import type { ComfyInputBinding, ComfyWorkflow, ComfyWorkflowMapping } from "@/types/comfy-workflow";

type WorkflowCapability = "image" | "video" | "audio";

const emptyMapping = (): ComfyWorkflowMapping => ({ imageSlots: [], videoSlots: [], audioSlots: [], outputNodeId: "" });

export function ComfyWorkflowMapperModal({
    open,
    capability,
    modelName,
    workflowId,
    baseUrl,
    apiKey,
    onSave,
    onClear,
    onClose,
}: {
    open: boolean;
    capability: WorkflowCapability;
    modelName: string;
    workflowId?: string;
    baseUrl: string;
    apiKey?: string;
    onSave: (workflowId: string) => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [workflow, setWorkflow] = useState<ComfyWorkflow | null>(null);
    const [mapping, setMapping] = useState<ComfyWorkflowMapping>(emptyMapping);
    const [name, setName] = useState(modelName || t("config.workflowMapper.untitled"));
    const [sourceFileName, setSourceFileName] = useState("");
    const [checkingCompatibility, setCheckingCompatibility] = useState(false);
    const [compatibility, setCompatibility] = useState<ComfyWorkflowCompatibility | null>(null);
    const [compatibilityError, setCompatibilityError] = useState("");

    useEffect(() => {
        if (!open) return;
        let active = true;
        setName(modelName || t("config.workflowMapper.untitled"));
        setWorkflow(null);
        setMapping(emptyMapping());
        setSourceFileName("");
        setCompatibility(null);
        setCompatibilityError("");
        if (!workflowId) return () => void (active = false);
        setLoading(true);
        void getComfyWorkflowPreset(workflowId)
            .then((preset) => {
                if (!active || !preset) return;
                setName(preset.name);
                setWorkflow(preset.workflow);
                setMapping(preset.mapping);
                setSourceFileName(preset.sourceFileName || "");
            })
            .finally(() => active && setLoading(false));
        return () => void (active = false);
    }, [modelName, open, t, workflowId]);

    const bindingOptions = useMemo(() => buildBindingOptions(workflow), [workflow]);
    const nodeOptions = useMemo(() => buildNodeOptions(workflow), [workflow]);
    const miniMaxH3 = Boolean(workflow && isMiniMaxH3Workflow(workflow));
    const mappedFields = [mapping.prompt && t("config.workflowMapper.prompt"), mapping.duration && t("config.workflowMapper.duration"), mapping.ratio && t("config.workflowMapper.ratio"), mapping.resolution && t("config.workflowMapper.resolution"), mapping.seed && t("config.workflowMapper.seed"), mapping.outputNodeId && t("config.workflowMapper.outputNode")].filter(Boolean) as string[];
    const missingFields = [!mapping.prompt && t("config.workflowMapper.prompt"), miniMaxH3 && !mapping.duration && t("config.workflowMapper.duration"), miniMaxH3 && !mapping.ratio && t("config.workflowMapper.ratio"), miniMaxH3 && !mapping.resolution && t("config.workflowMapper.resolution"), !mapping.outputNodeId && t("config.workflowMapper.outputNode")].filter(Boolean) as string[];
    const missingRequiredFields = [!mapping.prompt && t("config.workflowMapper.prompt"), !mapping.outputNodeId && t("config.workflowMapper.outputNode")].filter(Boolean) as string[];

    const importWorkflow = async (file: File) => {
        try {
            const parsed = parseComfyWorkflow(JSON.parse(await file.text()));
            setWorkflow(parsed);
            setSourceFileName(file.name);
            setName(modelName || file.name.replace(/\.json$/i, ""));
            setMapping(guessMapping(parsed, capability));
            setCompatibility(null);
            setCompatibilityError("");
            message.success(t("config.workflowMapper.imported", { count: Object.keys(parsed).length }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.workflowMapper.importFailed"));
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const checkCompatibility = async () => {
        if (!workflow) return;
        setCheckingCompatibility(true);
        setCompatibility(null);
        setCompatibilityError("");
        try {
            setCompatibility(await checkComfyWorkflowCompatibility(baseUrl, apiKey, workflow));
        } catch (error) {
            setCompatibilityError(error instanceof Error ? error.message : t("config.workflowMapper.compatibilityFailed"));
        } finally {
            setCheckingCompatibility(false);
        }
    };

    const save = async () => {
        if (!workflow) return message.error(t("config.workflowMapper.importFirst"));
        if (missingRequiredFields.length) return message.error(t("config.workflowMapper.missingRequired", { fields: missingRequiredFields.join(t("config.workflowMapper.separator")) }));
        const normalizedMapping = {
            ...mapping,
            imageSlots: mapping.imageSlots.filter((binding) => binding.nodeId && binding.inputName),
            videoSlots: mapping.videoSlots.filter((binding) => binding.nodeId && binding.inputName),
            audioSlots: mapping.audioSlots.filter((binding) => binding.nodeId && binding.inputName),
        };
        setSaving(true);
        try {
            const preset = await saveComfyWorkflowPreset({ id: workflowId, name: name.trim() || modelName || t("config.workflowMapper.untitled"), capability, workflow, mapping: normalizedMapping, sourceFileName: sourceFileName || undefined });
            onSave(preset.id);
            message.success(t("config.workflowMapper.saved"));
            onClose();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.workflowMapper.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const clear = () => {
        onClear();
        onClose();
    };

    return (
        <Modal
            open={open}
            width={920}
            centered
            title={t("config.workflowMapper.title", { model: modelName })}
            onCancel={onClose}
            footer={
                <div className="flex items-center justify-between gap-3">
                    <Button
                        danger
                        disabled={!workflowId}
                        onClick={clear}
                    >
                        {t("config.workflowMapper.clear")}
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button type="primary" loading={saving} onClick={() => void save()}>
                            {t("common.save")}
                        </Button>
                    </div>
                </div>
            }
        >
            <Spin spinning={loading}>
                <div className="space-y-4">
                    <Alert type="info" showIcon message={t("config.workflowMapper.noticeTitle")} description={t("config.workflowMapper.noticeDescription")} />
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                        <Button icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
                            {workflow ? t("config.workflowMapper.replaceFile") : t("config.workflowMapper.importFile")}
                        </Button>
                        <Button icon={<ShieldCheck className="size-4" />} disabled={!workflow} loading={checkingCompatibility} onClick={() => void checkCompatibility()}>
                            {t("config.workflowMapper.checkCompatibility")}
                        </Button>
                        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => event.target.files?.[0] && void importWorkflow(event.target.files[0])} />
                        <div className="min-w-0 flex-1 text-xs text-stone-500">
                            {workflow ? t("config.workflowMapper.fileSummary", { file: sourceFileName || t("config.workflowMapper.importedFile"), count: Object.keys(workflow).length }) : t("config.workflowMapper.fileHint")}
                        </div>
                    </div>

                    {workflow ? (
                        <Alert
                            showIcon
                            type={missingFields.length ? "warning" : "success"}
                            message={t(miniMaxH3 ? "config.workflowMapper.miniMaxDetected" : "config.workflowMapper.mappingDetected")}
                            description={
                                <div className="space-y-1">
                                    <div>{t("config.workflowMapper.mappedSummary", { fields: mappedFields.join(t("config.workflowMapper.separator")) || t("config.workflowMapper.none") })}</div>
                                    <div>{t("config.workflowMapper.slotSummary", { images: mapping.imageSlots.length, videos: mapping.videoSlots.length, audios: mapping.audioSlots.length })}</div>
                                    {missingFields.length ? <div>{t("config.workflowMapper.missingSummary", { fields: missingFields.join(t("config.workflowMapper.separator")) })}</div> : null}
                                </div>
                            }
                        />
                    ) : null}

                    {compatibility ? (
                        <Alert
                            showIcon
                            type={compatibility.missingNodeTypes.length ? "warning" : "success"}
                            message={t(compatibility.missingNodeTypes.length ? "config.workflowMapper.nodesMissing" : "config.workflowMapper.nodesReady", {
                                count: compatibility.missingNodeTypes.length || compatibility.requiredNodeTypes.length,
                            })}
                            description={
                                <div className="space-y-1">
                                    {compatibility.missingNodeTypes.length ? <div className="break-all">{compatibility.missingNodeTypes.join(t("config.workflowMapper.separator"))}</div> : null}
                                    <div>{t("config.workflowMapper.modelFilesNotChecked")}</div>
                                </div>
                            }
                        />
                    ) : compatibilityError ? (
                        <Alert showIcon type="warning" message={t("config.workflowMapper.compatibilityFailed")} description={`${compatibilityError} ${t("config.workflowMapper.compatibilityConnectionHint")}`} />
                    ) : null}

                    {!workflow ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("config.workflowMapper.empty")} />
                    ) : (
                        <>
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium">{t("config.workflowMapper.name")}</span>
                                <Input value={name} onChange={(event) => setName(event.target.value)} />
                            </label>
                            <div className="grid gap-4 md:grid-cols-2">
                                <BindingField label={t("config.workflowMapper.prompt")} value={mapping.prompt} options={bindingOptions} required onChange={(prompt) => setMapping((current) => ({ ...current, prompt }))} />
                                <BindingField label={t("config.workflowMapper.duration")} value={mapping.duration} options={bindingOptions} onChange={(duration) => setMapping((current) => ({ ...current, duration }))} />
                                <BindingField label={t("config.workflowMapper.ratio")} value={mapping.ratio} options={bindingOptions} onChange={(ratio) => setMapping((current) => ({ ...current, ratio }))} />
                                <BindingField label={t("config.workflowMapper.resolution")} value={mapping.resolution} options={bindingOptions} onChange={(resolution) => setMapping((current) => ({ ...current, resolution }))} />
                                <BindingField label={t("config.workflowMapper.seed")} value={mapping.seed} options={bindingOptions} onChange={(seed) => setMapping((current) => ({ ...current, seed }))} />
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <SlotEditor title={t("config.workflowMapper.imageSlots")} values={mapping.imageSlots} options={bindingOptions} onChange={(imageSlots) => setMapping((current) => ({ ...current, imageSlots }))} />
                                <SlotEditor title={t("config.workflowMapper.videoSlots")} values={mapping.videoSlots} options={bindingOptions} onChange={(videoSlots) => setMapping((current) => ({ ...current, videoSlots }))} />
                                <SlotEditor title={t("config.workflowMapper.audioSlots")} values={mapping.audioSlots} options={bindingOptions} onChange={(audioSlots) => setMapping((current) => ({ ...current, audioSlots }))} />
                            </div>

                            <label className="block">
                                <span className="mb-1 block text-sm font-medium">{t("config.workflowMapper.outputNode")} *</span>
                                <Select className="w-full" showSearch optionFilterProp="label" value={mapping.outputNodeId || undefined} options={nodeOptions} placeholder={t("config.workflowMapper.selectNode")} onChange={(outputNodeId) => setMapping((current) => ({ ...current, outputNodeId }))} />
                            </label>
                        </>
                    )}
                </div>
            </Spin>
        </Modal>
    );
}

function BindingField({ label, value, options, required = false, onChange }: { label: string; value?: ComfyInputBinding; options: Array<{ label: string; value: string }>; required?: boolean; onChange: (binding?: ComfyInputBinding) => void }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium">
                {label} {required ? "*" : ""}
            </span>
            <Select className="w-full" allowClear showSearch optionFilterProp="label" value={value ? encodeBinding(value) : undefined} options={options} onChange={(next) => onChange(next ? decodeBinding(next) : undefined)} />
        </label>
    );
}

function SlotEditor({ title, values, options, onChange }: { title: string; values: ComfyInputBinding[]; options: Array<{ label: string; value: string }>; onChange: (values: ComfyInputBinding[]) => void }) {
    const { t } = useTranslation();
    return (
        <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{title}</span>
                <Button type="text" size="small" icon={<Plus className="size-3.5" />} onClick={() => onChange([...values, { nodeId: "", inputName: "" }])}>
                    {t("common.add")}
                </Button>
            </div>
            <div className="space-y-2">
                {values.map((binding, index) => (
                    <div key={`${index}-${binding.nodeId}-${binding.inputName}`} className="flex items-center gap-1">
                        <span className="w-5 shrink-0 text-xs text-stone-400">{index + 1}</span>
                        <Select
                            className="min-w-0 flex-1"
                            size="small"
                            showSearch
                            optionFilterProp="label"
                            value={binding.nodeId ? encodeBinding(binding) : undefined}
                            options={options}
                            onChange={(next) => onChange(values.map((item, itemIndex) => (itemIndex === index ? decodeBinding(next) : item)))}
                        />
                        <Button type="text" size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} />
                    </div>
                ))}
                {!values.length ? <div className="py-2 text-center text-xs text-stone-400">{t("config.workflowMapper.noSlots")}</div> : null}
            </div>
        </div>
    );
}

function buildBindingOptions(workflow: ComfyWorkflow | null) {
    if (!workflow) return [];
    return Object.entries(workflow).flatMap(([nodeId, node]) =>
        Object.keys(node.inputs).map((inputName) => ({ value: encodeBinding({ nodeId, inputName }), label: `${nodeId} · ${node._meta?.title || node.class_type || "Node"} · ${inputName}` })),
    );
}

function buildNodeOptions(workflow: ComfyWorkflow | null) {
    if (!workflow) return [];
    return Object.entries(workflow).map(([nodeId, node]) => ({ value: nodeId, label: `${nodeId} · ${node._meta?.title || node.class_type || "Node"}` }));
}

function guessMapping(workflow: ComfyWorkflow, capability: WorkflowCapability): ComfyWorkflowMapping {
    const bindings = Object.entries(workflow).flatMap(([nodeId, node]) => Object.keys(node.inputs).map((inputName) => ({ nodeId, inputName, node })));
    const find = (pattern: RegExp) => bindings.find((item) => pattern.test(`${item.inputName} ${item.node.class_type || ""} ${item.node._meta?.title || ""}`));
    const slots = (kind: "image" | "video" | "audio") =>
        bindings
            .filter((item) => {
                if (typeof item.node.inputs[item.inputName] !== "string") return false;
                const nodeLabel = `${item.node.class_type || ""} ${item.node._meta?.title || ""}`;
                return new RegExp(`load.*${kind}`, "i").test(nodeLabel) || new RegExp(`(^|[_\\s])${kind}($|[_\\s])`, "i").test(item.inputName);
            })
            .map(({ nodeId, inputName }) => ({ nodeId, inputName }));
    const output = Object.entries(workflow)
        .reverse()
        .find(([, node]) => /save|preview|combine|output/i.test(`${node.class_type || ""} ${node._meta?.title || ""}`));
    const clean = (binding?: (typeof bindings)[number]) => (binding ? { nodeId: binding.nodeId, inputName: binding.inputName } : undefined);
    const workflowNodeIds = Object.keys(workflow);
    const h3Conditioning = Object.entries(workflow).find(([, node]) => /minimax.*h3.*conditioning/i.test(`${node.class_type || ""} ${node._meta?.title || ""}`));
    const h3Prompt = h3Conditioning ? findUpstreamScalarBinding(workflow, h3Conditioning[1].inputs.prompt, /primitive.*string|string.*multiline|text/i) : undefined;
    const h3Duration = h3Conditioning ? findUpstreamScalarBinding(workflow, h3Conditioning[1].inputs.length, /primitive.*(float|int|number)|duration|seconds/i) : undefined;
    const h3Slots = (pattern: RegExp, kind: "image" | "video" | "audio") => h3Conditioning ? linkedLoaderBindings(workflow, h3Conditioning[1], pattern, kind) : [];
    const h3ImageSlots = h3Slots(/^ref_images\.ref_image_(\d+)$/, "image");
    const h3VideoSlots = h3Slots(/^ref_videos\.ref_video_(\d+)$/, "video");
    const h3AudioSlots = h3Slots(/^ref_audios\.ref_audio_(\d+)$/, "audio");
    return {
        prompt: h3Prompt || clean(find(/(^|[_\s])(prompt|text|positive)($|[_\s])/i)),
        duration: h3Duration || clean(find(/(^|[_\s])(duration|seconds|length)($|[_\s])/i)),
        ratio: clean(find(/aspect[_\s-]*ratio|(^|[_\s])ratio($|[_\s])/i)),
        resolution: clean(find(/megapixels?|resolution|(^|[_\s])pixels?($|[_\s])/i)),
        seed: clean(find(/seed/i)),
        imageSlots: h3ImageSlots.length ? h3ImageSlots : slots("image"),
        videoSlots: h3VideoSlots.length ? h3VideoSlots : slots("video"),
        audioSlots: h3AudioSlots.length ? h3AudioSlots : slots("audio"),
        outputNodeId: output?.[0] || (capability === "image" ? workflowNodeIds[workflowNodeIds.length - 1] || "" : ""),
    };
}

function isMiniMaxH3Workflow(workflow: ComfyWorkflow) {
    return Object.values(workflow).some((node) => /minimax.*h3/i.test(`${node.class_type || ""} ${node._meta?.title || ""}`));
}

function findUpstreamScalarBinding(workflow: ComfyWorkflow, input: unknown, nodePattern: RegExp, visited = new Set<string>()): ComfyInputBinding | undefined {
    if (!isWorkflowLink(input)) return undefined;
    const nodeId = String(input[0]);
    if (visited.has(nodeId)) return undefined;
    visited.add(nodeId);
    const node = workflow[nodeId];
    if (!node) return undefined;
    const label = `${node.class_type || ""} ${node._meta?.title || ""}`;
    if (nodePattern.test(label)) {
        const direct = Object.entries(node.inputs).find(([inputName, value]) => !isWorkflowLink(value) && /^(value|text|prompt|seconds|duration)$/i.test(inputName));
        if (direct) return { nodeId, inputName: direct[0] };
    }
    for (const value of Object.values(node.inputs)) {
        const binding = findUpstreamScalarBinding(workflow, value, nodePattern, visited);
        if (binding) return binding;
    }
    return undefined;
}

function linkedLoaderBindings(workflow: ComfyWorkflow, conditioning: ComfyWorkflow[string], pattern: RegExp, kind: "image" | "video" | "audio") {
    return Object.entries(conditioning.inputs)
        .map(([inputName, value]) => ({ match: inputName.match(pattern), value }))
        .filter((item): item is { match: RegExpMatchArray; value: unknown } => Boolean(item.match))
        .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
        .map(({ value }) => {
            if (!isWorkflowLink(value)) return undefined;
            const nodeId = String(value[0]);
            const node = workflow[nodeId];
            if (!node) return undefined;
            const inputName = Object.keys(node.inputs).find((name) => name.toLowerCase() === kind) || Object.keys(node.inputs).find((name) => new RegExp(kind, "i").test(name));
            return inputName ? { nodeId, inputName } : undefined;
        })
        .filter((binding): binding is ComfyInputBinding => Boolean(binding));
}

function isWorkflowLink(value: unknown): value is [string | number, number] {
    return Array.isArray(value) && value.length === 2 && (typeof value[0] === "string" || typeof value[0] === "number") && typeof value[1] === "number";
}

function encodeBinding(binding: ComfyInputBinding) {
    return `${binding.nodeId}\u0000${binding.inputName}`;
}

function decodeBinding(value: string): ComfyInputBinding {
    const [nodeId, inputName] = value.split("\u0000");
    return { nodeId, inputName };
}
