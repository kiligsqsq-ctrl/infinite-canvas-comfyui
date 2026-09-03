export type ComfyWorkflowNode = {
    class_type?: string;
    inputs: Record<string, unknown>;
    _meta?: { title?: string };
};

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export type ComfyInputBinding = {
    nodeId: string;
    inputName: string;
};

export type ComfyWorkflowMapping = {
    prompt?: ComfyInputBinding;
    duration?: ComfyInputBinding;
    ratio?: ComfyInputBinding;
    resolution?: ComfyInputBinding;
    seed?: ComfyInputBinding;
    imageSlots: ComfyInputBinding[];
    videoSlots: ComfyInputBinding[];
    audioSlots: ComfyInputBinding[];
    outputNodeId: string;
};

export type ComfyWorkflowPreset = {
    id: string;
    name: string;
    capability: "image" | "video" | "audio";
    workflow: ComfyWorkflow;
    mapping: ComfyWorkflowMapping;
    sourceFileName?: string;
    updatedAt: string;
};
