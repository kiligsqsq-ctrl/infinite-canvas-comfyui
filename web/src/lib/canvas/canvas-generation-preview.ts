import { buildNodeGenerationContext, buildNodeGenerationInputs, type NodeGenerationInput } from "@/components/canvas/canvas-node-generation";
import type { CanvasNodeGenerationMode } from "@/components/canvas/canvas-node-prompt-panel";
import i18n from "@/i18n";
import { buildImageReferencePromptText, imageReferenceLabel } from "@/lib/image-reference-prompt";
import { seedanceReferenceLabel } from "@/lib/seedance-video";
import { getComfyWorkflowPreset } from "@/services/comfy-workflow-storage";
import { buildGenerationConfig, getGenerationCount } from "@/lib/canvas/canvas-generation-helpers";
import { modelOptionLabel, modelOptionName, resolveModelChannel, resolveModelWorkflowId, type AiConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/types/canvas";

export type CanvasGenerationPreviewReference = {
    nodeId: string;
    type: "image" | "video" | "audio" | "text";
    label: string;
    title: string;
    previewUrl?: string;
    text?: string;
};

export type CanvasGenerationPreviewData = {
    nodeId: string;
    mode: CanvasNodeGenerationMode;
    model: string;
    channelName: string;
    prompt: string;
    references: CanvasGenerationPreviewReference[];
    parameters: Array<{ label: string; value: string }>;
    outputDescription: string;
    workflow?: { name: string; outputNodeId: string; imageLimit: number; videoLimit: number; audioLimit: number };
    warnings: string[];
};

export async function buildCanvasGenerationPreview({
    nodeId,
    mode,
    prompt,
    nodes,
    connections,
    config,
}: {
    nodeId: string;
    mode: CanvasNodeGenerationMode;
    prompt: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    config: AiConfig;
}): Promise<CanvasGenerationPreviewData> {
    const sourceNode = nodes.find((node) => node.id === nodeId);
    const generationConfig = buildGenerationConfig(config, sourceNode, mode);
    const context = buildNodeGenerationContext(nodeId, nodes, connections, prompt);
    const allInputs = buildNodeGenerationInputs(nodeId, nodes, connections);
    const inputs = selectedInputs(sourceNode, prompt, allInputs);
    const ownImage: NodeGenerationInput[] =
        sourceNode?.type === CanvasNodeType.Image && sourceNode.metadata?.content
            ? [
                  {
                      nodeId: sourceNode.id,
                      type: "image",
                      title: sourceNode.title,
                      image: {
                          id: sourceNode.id,
                          name: sourceNode.title || `image-${sourceNode.id}.png`,
                          type: sourceNode.metadata.mimeType || "image/png",
                          dataUrl: sourceNode.metadata.content,
                          storageKey: sourceNode.metadata.storageKey,
                      },
                  },
              ]
            : [];
    const combined = ownImage.length ? [...ownImage, ...inputs.filter((input) => input.type === "text")] : inputs;
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    const references: CanvasGenerationPreviewReference[] = combined.map((input) => {
        const index = counts[input.type]++;
        return {
            nodeId: input.nodeId,
            type: input.type,
            label: previewLabel(input.type, index),
            title: input.title,
            previewUrl: "image" in input ? input.image?.dataUrl : "video" in input ? input.video?.url : "audio" in input ? input.audio?.url : undefined,
            text: "text" in input ? input.text : undefined,
        };
    });
    const referenceImages = combined.map((input) => input.image).filter((image): image is NonNullable<NodeGenerationInput["image"]> => Boolean(image));
    const finalPrompt = mode === "image" ? buildImageReferencePromptText(context.prompt, referenceImages) : context.prompt;
    const channel = resolveModelChannel(config, generationConfig.model);
    const workflowId = resolveModelWorkflowId(config, generationConfig.model);
    const preset = workflowId ? await getComfyWorkflowPreset(workflowId) : null;
    const workflow = preset
        ? {
              name: preset.name,
              outputNodeId: preset.mapping.outputNodeId,
              imageLimit: preset.mapping.imageSlots.length,
              videoLimit: preset.mapping.videoSlots.length,
              audioLimit: preset.mapping.audioSlots.length,
          }
        : undefined;
    const warnings: string[] = [];
    if (workflowId && !preset) warnings.push(i18n.t("canvas.generationPreview.workflowMissing"));
    if (!finalPrompt.trim() && (mode === "text" || mode === "audio")) warnings.push(i18n.t("canvas.generationPreview.promptMissing"));
    if (workflow) {
        if (counts.image > workflow.imageLimit) warnings.push(i18n.t("canvas.generationPreview.referenceOverflow", { kind: i18n.t("canvas.generationPreview.imageKind"), used: counts.image, limit: workflow.imageLimit }));
        if (counts.video > workflow.videoLimit) warnings.push(i18n.t("canvas.generationPreview.referenceOverflow", { kind: i18n.t("canvas.generationPreview.videoKind"), used: counts.video, limit: workflow.videoLimit }));
        if (counts.audio > workflow.audioLimit) warnings.push(i18n.t("canvas.generationPreview.referenceOverflow", { kind: i18n.t("canvas.generationPreview.audioKind"), used: counts.audio, limit: workflow.audioLimit }));
    }
    const parameters = previewParameters(mode, generationConfig);
    return {
        nodeId,
        mode,
        model: modelOptionLabel(config, generationConfig.model),
        channelName: channel.name,
        prompt: finalPrompt,
        references,
        parameters,
        outputDescription: outputDescription(sourceNode, mode),
        workflow,
        warnings,
    };
}

function selectedInputs(sourceNode: CanvasNodeData | undefined, prompt: string, inputs: NodeGenerationInput[]) {
    if (sourceNode?.type !== CanvasNodeType.Config || !sourceNode.metadata?.composerContent?.trim()) return inputs;
    const inputByNodeId = new Map(inputs.map((input) => [input.nodeId, input]));
    const selected: NodeGenerationInput[] = [];
    const seen = new Set<string>();
    for (const match of prompt.matchAll(/@\[node:([^\]]+)\]/g)) {
        const input = inputByNodeId.get(match[1]);
        if (input && !seen.has(input.nodeId)) {
            selected.push(input);
            seen.add(input.nodeId);
        }
    }
    return selected;
}

function previewLabel(type: CanvasGenerationPreviewReference["type"], index: number) {
    if (type === "image") return imageReferenceLabel(index);
    if (type === "video") return seedanceReferenceLabel("video", index);
    if (type === "audio") return seedanceReferenceLabel("audio", index);
    return i18n.t("canvas.generationPreview.textReference", { index: index + 1 });
}

function previewParameters(mode: CanvasNodeGenerationMode, config: AiConfig) {
    const p = (key: string) => i18n.t(`canvas.generationPreview.parameter.${key}`);
    if (mode === "image") return [{ label: p("count"), value: String(getGenerationCount(config.count)) }, { label: p("size"), value: config.size }, { label: p("quality"), value: config.quality }];
    if (mode === "video") {
        const miniMaxH3 = /minimax[\s_-]*h3/i.test(modelOptionName(config.model || config.videoModel));
        const resolution = miniMaxH3 ? `${config.vquality === "0.9" ? "0.9" : "0.4"} MP` : ["0.4", "0.9"].includes(config.vquality) ? "720p" : config.vquality;
        return [{ label: p("duration"), value: i18n.t("common.durationSeconds", { seconds: config.videoSeconds }) }, { label: p("size"), value: config.size }, { label: p("quality"), value: resolution }, { label: p("generateAudio"), value: i18n.t(config.videoGenerateAudio === "true" ? "canvas.generationPreview.yes" : "canvas.generationPreview.no") }];
    }
    if (mode === "audio") return [{ label: p("voice"), value: config.audioVoice }, { label: p("format"), value: config.audioFormat }, { label: p("speed"), value: config.audioSpeed }];
    return [{ label: p("count"), value: String(getGenerationCount(config.count)) }, { label: p("reasoning"), value: config.reasoningEffort }];
}

function outputDescription(node: CanvasNodeData | undefined, mode: CanvasNodeGenerationMode) {
    const emptyOwnNode = node?.type === mode && !node.metadata?.content;
    if (emptyOwnNode) return i18n.t("canvas.generationPreview.writeBack");
    return i18n.t("canvas.generationPreview.createBeside", { kind: i18n.t(`config.channelEditor.capabilities.${mode}`) });
}
