import { Copy, Download, ExternalLink, FolderOpen, Music2, PencilLine, Search, Tags, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { App, Button, Card, Checkbox, Drawer, Empty, Form, Image, Input, Modal, Pagination, Select, Space, Tag, Typography } from "antd";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useCopyText } from "@/hooks/use-copy-text";
import { formatBytes, readFileAsDataUrl } from "@/lib/image-utils";
import { assetContentHash, hashBlob } from "@/lib/file-hash";
import { uploadImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useAssetStore, type Asset, type AssetKind, type ImageAsset } from "@/stores/use-asset-store";
import { exportAssets, readAssetPackage } from "./asset-transfer";

type AssetFormValues = {
    kind: AssetKind;
    title: string;
    coverUrl: string;
    tags: string[];
    source?: string;
    note?: string;
    content?: string;
};

type ImageDraft = ImageAsset["data"] | null;
type SortMode = "created-desc" | "created-asc" | "updated-desc" | "title-asc";

const kindOptions = ["all", "text", "image", "video", "audio"] as const;

export default function AssetsPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const copyText = useCopyText();
    const [form] = Form.useForm<AssetFormValues>();
    const coverInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const assetInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const assets = useAssetStore((state) => state.assets);
    const addAsset = useAssetStore((state) => state.addAsset);
    const updateAsset = useAssetStore((state) => state.updateAsset);
    const removeAsset = useAssetStore((state) => state.removeAsset);
    const projects = useCanvasStore((state) => state.projects);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState<AssetKind | "all">("all");
    const [tagFilter, setTagFilter] = useState("all");
    const [sortMode, setSortMode] = useState<SortMode>("created-desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [isAssetOpen, setIsAssetOpen] = useState(false);
    const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
    const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
    const [batchTagOpen, setBatchTagOpen] = useState(false);
    const [batchTags, setBatchTags] = useState<string[]>([]);
    const [insertTarget, setInsertTarget] = useState<Asset | null>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formKind, setFormKind] = useState<AssetKind>("text");
    const [imageDraft, setImageDraft] = useState<ImageDraft>(null);
    const coverUrl = Form.useWatch("coverUrl", form) || "";
    const title = Form.useWatch("title", form) || "";
    const tags = Form.useWatch("tags", form) || [];
    const content = Form.useWatch("content", form) || "";
    const validAssets = useMemo(() => assets.filter((asset) => asset.kind === "text" || asset.kind === "image" || asset.kind === "video" || asset.kind === "audio"), [assets]);

    const allTags = useMemo(() => Array.from(new Set(validAssets.flatMap((asset) => asset.tags || []))).slice(0, 40), [validAssets]);

    const filteredAssets = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return validAssets.filter((asset) => {
            if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
            if (tagFilter !== "all" && !(asset.tags || []).includes(tagFilter)) return false;
            if (!query) return true;
            return assetSearchText(asset).includes(query);
        });
    }, [validAssets, keyword, kindFilter, tagFilter]);

    const sortedAssets = useMemo(() => {
        const list = [...filteredAssets];
        switch (sortMode) {
            case "created-asc":
                return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            case "updated-desc":
                return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            case "title-asc":
                return list.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
            default:
                return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }
    }, [filteredAssets, sortMode]);

    const visibleAssets = useMemo(() => sortedAssets.slice((page - 1) * pageSize, page * pageSize), [sortedAssets, page, pageSize]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(sortedAssets.length / pageSize));
        setPage((value) => Math.min(value, maxPage));
    }, [sortedAssets.length, pageSize]);

    const isDuplicateHash = (hash: string) => Boolean(hash) && validAssets.some((asset) => assetContentHash(asset) === hash);

    const toggleSelected = (id: string, checked: boolean) =>
        setSelectedIds((current) => {
            const next = new Set(current);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });

    const selectAllVisible = (checked: boolean) =>
        setSelectedIds((current) => {
            const next = new Set(current);
            visibleAssets.forEach((asset) => (checked ? next.add(asset.id) : next.delete(asset.id)));
            return next;
        });

    const openCreate = () => {
        setEditingAsset(null);
        setImageDraft(null);
        setFormKind("text");
        form.setFieldsValue({ kind: "text", title: "", coverUrl: "", tags: [], source: t("assets.manual"), note: "", content: "" });
        setIsAssetOpen(true);
    };

    const openEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setFormKind(asset.kind);
        setImageDraft(asset.kind === "image" ? asset.data : null);
        form.setFieldsValue({
            kind: asset.kind,
            title: asset.title,
            coverUrl: asset.coverUrl,
            tags: asset.tags || [],
            source: asset.source,
            note: asset.note,
            content: asset.kind === "text" ? asset.data.content : "",
        });
        setIsAssetOpen(true);
    };

    const saveAsset = async () => {
        const values = await form.validateFields();
        const base = {
            title: values.title.trim(),
            coverUrl: values.coverUrl?.trim() || (values.kind === "image" && imageDraft ? imageDraft.dataUrl : ""),
            tags: values.tags || [],
            source: values.source?.trim(),
            note: values.note?.trim(),
        };

        if (editingAsset && (editingAsset.kind === "video" || editingAsset.kind === "audio")) {
            updateAsset(editingAsset.id, base);
            message.success(t("assets.updated"));
            setIsAssetOpen(false);
            return;
        }

        if (values.kind === "text") {
            const asset = { ...base, kind: "text" as const, data: { content: (values.content || "").trim() }, metadata: editingAsset?.metadata || { source: "manual" } };
            editingAsset ? updateAsset(editingAsset.id, asset) : addAsset(asset);
        } else {
            if (!imageDraft) {
                message.error(t("assets.selectImage"));
                return;
            }
            const asset = { ...base, coverUrl: base.coverUrl || imageDraft.dataUrl, kind: "image" as const, data: imageDraft, metadata: editingAsset?.metadata || { source: "manual" } };
            editingAsset ? updateAsset(editingAsset.id, asset) : addAsset(asset);
        }

        message.success(editingAsset ? t("assets.updated") : t("assets.saved"));
        setIsAssetOpen(false);
    };

    const readCoverFile = async (file?: File) => {
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        form.setFieldValue("coverUrl", dataUrl);
    };

    const readImageFile = async (file?: File) => {
        if (!file || !file.type.startsWith("image/")) return;
        const image = await uploadImage(file);
        const draft = { dataUrl: image.url, storageKey: image.storageKey, width: image.width, height: image.height, bytes: image.bytes, mimeType: image.mimeType };
        setImageDraft(draft);
        if (!form.getFieldValue("coverUrl")) form.setFieldValue("coverUrl", draft.dataUrl);
        if (!form.getFieldValue("title")) form.setFieldValue("title", file.name);
    };

    const copyAssetText = async (asset: Asset) => {
        if (asset.kind !== "text") return;
        copyText(asset.data.content, t("assets.textCopied"));
    };

    const downloadAsset = (asset: Asset) => {
        if (asset.kind === "text") return;
        if (asset.kind === "image") {
            saveAs(asset.data.dataUrl, `${asset.title || "asset"}.${asset.data.mimeType.split("/")[1] || "png"}`);
            return;
        }
        saveAs(asset.data.url, `${asset.title || "asset"}.${extensionOf(asset.data.mimeType)}`);
    };

    const addFiles = async (fileList: FileList | File[]) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setUploading(true);
        const hide = message.loading(t("assets.uploading"), 0);
        let added = 0;
        let skipped = 0;
        let failed = 0;
        try {
            for (const file of files) {
                try {
                    if (file.type.startsWith("image/")) {
                        const hash = await hashBlob(file);
                        if (isDuplicateHash(hash)) {
                            skipped += 1;
                            continue;
                        }
                        const image = await uploadImage(file);
                        addAsset({
                            kind: "image",
                            title: file.name || t("assets.kinds.image"),
                            coverUrl: image.url,
                            tags: [],
                            source: "Upload",
                            data: { dataUrl: image.url, storageKey: image.storageKey, width: image.width, height: image.height, bytes: image.bytes, mimeType: image.mimeType },
                            metadata: { source: "upload", contentHash: hash },
                        });
                        added += 1;
                    } else if (file.type.startsWith("video/")) {
                        const hash = await hashBlob(file);
                        if (isDuplicateHash(hash)) {
                            skipped += 1;
                            continue;
                        }
                        const media = await uploadMediaFile(file, "video");
                        addAsset({
                            kind: "video",
                            title: file.name || t("assets.kinds.video"),
                            coverUrl: "",
                            tags: [],
                            source: "Upload",
                            data: { url: media.url, storageKey: media.storageKey, width: media.width || 0, height: media.height || 0, bytes: media.bytes, mimeType: media.mimeType },
                            metadata: { source: "upload", contentHash: hash },
                        });
                        added += 1;
                    } else if (file.type.startsWith("audio/")) {
                        const hash = await hashBlob(file);
                        if (isDuplicateHash(hash)) {
                            skipped += 1;
                            continue;
                        }
                        const media = await uploadMediaFile(file, "audio");
                        addAsset({
                            kind: "audio",
                            title: file.name || t("assets.kinds.audio"),
                            coverUrl: "",
                            tags: [],
                            source: "Upload",
                            data: { url: media.url, storageKey: media.storageKey, bytes: media.bytes, mimeType: media.mimeType, durationMs: media.durationMs },
                            metadata: { source: "upload", contentHash: hash },
                        });
                        added += 1;
                    } else {
                        failed += 1;
                    }
                } catch {
                    failed += 1;
                }
            }
            if (added) message.success(t("assets.uploaded", { count: added }));
            if (skipped) message.warning(t("assets.duplicateSkipped", { count: skipped }));
            if (failed && !added && !skipped) message.error(t("assets.uploadFailed"));
        } finally {
            hide();
            setUploading(false);
        }
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
    };

    const exportAllAssets = async () => {
        if (!validAssets.length) {
            message.warning(t("assets.noneToExport"));
            return;
        }
        await exportAssets(validAssets, t("assets.packageName"));
    };

    const exportSelectedAssets = async () => {
        const selected = validAssets.filter((asset) => selectedIds.has(asset.id));
        if (!selected.length) return;
        await exportAssets(selected, t("assets.packageName"));
    };

    const importAssetZip = async (file?: File) => {
        if (!file) return;
        try {
            const importedAssets = await readAssetPackage(file);
            const storageKeys = new Set(validAssets.map((asset) => ("storageKey" in asset.data ? asset.data.storageKey : undefined)).filter(Boolean));
            let added = 0;
            let skipped = 0;
            importedAssets.forEach((asset) => {
                const key = "storageKey" in asset.data ? asset.data.storageKey : undefined;
                if (key && storageKeys.has(key)) {
                    skipped += 1;
                    return;
                }
                const payload = { ...asset } as Record<string, unknown>;
                delete payload.id;
                delete payload.createdAt;
                delete payload.updatedAt;
                addAsset(payload as Parameters<typeof addAsset>[0]);
                added += 1;
            });
            if (added) message.success(t("assets.imported", { count: added }));
            if (skipped) message.warning(t("assets.duplicateSkipped", { count: skipped }));
        } catch {
            message.error(t("assets.importFailed"));
        } finally {
            if (assetInputRef.current) assetInputRef.current.value = "";
        }
    };

    const confirmDelete = () => {
        if (!deletingAsset) return;
        removeAsset(deletingAsset.id);
        setSelectedIds((current) => {
            const next = new Set(current);
            next.delete(deletingAsset.id);
            return next;
        });
        message.success(t("assets.deleted"));
        setDeletingAsset(null);
    };

    const confirmBatchDelete = () => {
        const count = selectedIds.size;
        selectedIds.forEach((id) => removeAsset(id));
        setSelectedIds(new Set());
        setBatchDeleteOpen(false);
        message.success(t("assets.deletedCount", { count }));
    };

    const applyBatchTags = () => {
        const clean = batchTags.map((tag) => tag.trim()).filter(Boolean);
        if (!clean.length) {
            setBatchTagOpen(false);
            return;
        }
        const count = selectedIds.size;
        selectedIds.forEach((id) => {
            const asset = assets.find((item) => item.id === id);
            if (!asset) return;
            const merged = Array.from(new Set([...(asset.tags || []), ...clean]));
            updateAsset(id, { tags: merged });
        });
        setBatchTagOpen(false);
        setBatchTags([]);
        message.success(t("assets.tagsAdded", { count }));
    };

    const insertAssetIntoCanvas = (canvasId: string) => {
        if (!insertTarget) return;
        const assetId = insertTarget.id;
        setInsertTarget(null);
        navigate(`/canvas/${canvasId}?assetId=${assetId}`);
    };

    return (
        <div
            className="relative flex h-full flex-col overflow-hidden bg-background text-stone-900 dark:text-stone-100"
            onDragEnter={(event) => {
                if (Array.from(event.dataTransfer.types).includes("Files")) setDragging(true);
            }}
            onDragOver={(event) => {
                if (Array.from(event.dataTransfer.types).includes("Files")) {
                    event.preventDefault();
                    setDragging(true);
                }
            }}
            onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDragging(false);
            }}
            onDrop={handleDrop}
        >
            {dragging ? (
                <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-indigo-400 bg-indigo-50/80 text-sm font-medium text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300">
                    {uploading ? t("assets.uploading") : t("assets.dragHint")}
                </div>
            ) : null}
            <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.14)_1px,transparent_1px)]">
                <div className="pb-6">
                    <div className="mx-auto max-w-5xl text-center">
                        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">{t("assets.title")}</h1>
                        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{t("assets.description")}</p>
                    </div>

                    <div className="mx-auto mt-8 w-full max-w-2xl">
                        <Input.Search
                            className="w-full"
                            size="large"
                            allowClear
                            prefix={<Search className="size-4 text-stone-400" />}
                            value={keyword}
                            placeholder={t("assets.search")}
                            onChange={(event) => {
                                setPage(1);
                                setKeyword(event.target.value);
                            }}
                            onSearch={(value) => {
                                setPage(1);
                                setKeyword(value);
                            }}
                        />
                    </div>

                    <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t("assets.type")}</div>
                                <div className="flex flex-wrap gap-2">
                                    {kindOptions.map((option) => (
                                        <Tag.CheckableTag
                                            key={option}
                                            checked={kindFilter === option}
                                            className={cn("prompt-filter-tag", kindFilter === option && "is-active")}
                                            onChange={() => {
                                                setPage(1);
                                                setKindFilter(option);
                                            }}
                                        >
                                            {option === "all" ? t("common.all") : t(`assets.kinds.${option}`)}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Select
                                    size="small"
                                    value={sortMode}
                                    onChange={(value) => {
                                        setPage(1);
                                        setSortMode(value as SortMode);
                                    }}
                                    options={[
                                        { value: "created-desc", label: t("assets.sort.createdDesc") },
                                        { value: "created-asc", label: t("assets.sort.createdAsc") },
                                        { value: "updated-desc", label: t("assets.sort.updatedDesc") },
                                        { value: "title-asc", label: t("assets.sort.titleAsc") },
                                    ]}
                                    className="min-w-28"
                                />
                                <button type="button" className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline dark:text-stone-300" onClick={() => void exportAllAssets()}>
                                    {t("assets.export")}
                                </button>
                                <button type="button" className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline dark:text-stone-300" onClick={() => assetInputRef.current?.click()}>
                                    {t("assets.import")}
                                </button>
                                <button type="button" className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline dark:text-stone-300" onClick={openCreate}>
                                    {t("assets.add")}
                                </button>
                                <button type="button" className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline dark:text-stone-300" onClick={() => fileInputRef.current?.click()}>
                                    {t("common.upload")}
                                </button>
                            </div>
                        </div>
                        {allTags.length ? (
                            <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t("assets.tagsFilter.label")}</div>
                                <div className="flex flex-wrap gap-2">
                                    <Tag.CheckableTag checked={tagFilter === "all"} className={cn("prompt-filter-tag", tagFilter === "all" && "is-active")} onChange={() => setTagFilter("all")}>
                                        {t("assets.tagsFilter.all")}
                                    </Tag.CheckableTag>
                                    {allTags.map((tag) => (
                                        <Tag.CheckableTag key={tag} checked={tagFilter === tag} className={cn("prompt-filter-tag", tagFilter === tag && "is-active")} onChange={() => setTagFilter(tag)}>
                                            {tag}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {selectedIds.size ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 dark:border-indigo-900/70 dark:bg-indigo-950/20">
                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{t("assets.batch.selected", { count: selectedIds.size })}</span>
                                <Button size="small" onClick={() => selectAllVisible(true)}>
                                    {t("assets.batch.selectAll")}
                                </Button>
                                <Button size="small" onClick={() => setSelectedIds(new Set())}>
                                    {t("assets.batch.clear")}
                                </Button>
                                <Button size="small" icon={<Tags className="size-3.5" />} onClick={() => setBatchTagOpen(true)}>
                                    {t("assets.batch.addTags")}
                                </Button>
                                <Button size="small" icon={<Download className="size-3.5" />} onClick={() => void exportSelectedAssets()}>
                                    {t("assets.batch.export")}
                                </Button>
                                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => setBatchDeleteOpen(true)}>
                                    {t("assets.batch.delete")}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {visibleAssets.map((asset) => (
                            <div key={asset.id} className="relative">
                                <Checkbox className="absolute left-2 top-2 z-10" checked={selectedIds.has(asset.id)} onChange={(event) => toggleSelected(asset.id, event.target.checked)} />
                                <AssetCard
                                    asset={asset}
                                    onOpen={() => setPreviewAsset(asset)}
                                    onEdit={() => openEdit(asset)}
                                    onCopy={copyAssetText}
                                    onDownload={downloadAsset}
                                    onDelete={() => setDeletingAsset(asset)}
                                    onInsert={() => setInsertTarget(asset)}
                                    onOpenSource={(projectId) => navigate(`/canvas/${projectId}`)}
                                />
                            </div>
                        ))}
                    </div>

                    {!visibleAssets.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("assets.empty")} className="py-20" /> : null}

                    <div className="flex justify-center">
                        <Pagination
                            current={page}
                            pageSize={pageSize}
                            total={sortedAssets.length}
                            showSizeChanger
                            pageSizeOptions={[10, 20, 50, 100]}
                            onChange={(nextPage, nextPageSize) => {
                                setPage(nextPage);
                                setPageSize(nextPageSize);
                            }}
                        />
                    </div>
                </div>
            </main>

            <Modal title={editingAsset ? t("assets.edit") : t("assets.add")} open={isAssetOpen} width={980} onCancel={() => setIsAssetOpen(false)} onOk={() => void saveAsset()} okText={t("common.save")} cancelText={t("common.cancel")} destroyOnHidden>
                <div className="grid gap-6 pt-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <Form form={form} layout="vertical" requiredMark={false} initialValues={{ kind: "text", tags: [] }}>
                        {editingAsset && (formKind === "video" || formKind === "audio") ? (
                            <div className="mb-4 flex items-center gap-2 text-sm text-stone-500">
                                <Tag className="m-0">{t(`assets.kinds.${formKind}`)}</Tag>
                                <span>{t("assets.metadataOnly")}</span>
                            </div>
                        ) : (
                            <Form.Item name="kind" label={t("assets.type")}>
                                <Select
                                    options={[
                                        { label: t("assets.kinds.text"), value: "text" },
                                        { label: t("assets.kinds.image"), value: "image" },
                                    ]}
                                    onChange={(value) => setFormKind(value)}
                                />
                            </Form.Item>
                        )}
                        <Form.Item name="title" label={t("assets.fields.title")} rules={[{ required: true, message: t("assets.fields.titleRequired") }]}>
                            <Input size="large" placeholder={t("assets.fields.titlePlaceholder")} />
                        </Form.Item>
                        <Form.Item name="coverUrl" label={t("assets.fields.coverUrl")}>
                            <Space.Compact className="w-full">
                                <Input placeholder={t("assets.fields.coverPlaceholder")} />
                                <Button icon={<Upload className="size-3.5" />} onClick={() => coverInputRef.current?.click()}>
                                    {t("common.upload")}
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item name="tags" label={t("assets.fields.tags")}>
                            <Select mode="tags" tokenSeparators={[",", "，"]} placeholder={t("assets.fields.tagsPlaceholder")} />
                        </Form.Item>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Form.Item name="source" label={t("assets.fields.source")}>
                                <Input placeholder={t("assets.fields.sourcePlaceholder")} />
                            </Form.Item>
                            <Form.Item name="note" label={t("assets.fields.note")}>
                                <Input placeholder={t("assets.fields.optional")} />
                            </Form.Item>
                        </div>
                        {formKind === "text" && !(editingAsset && (editingAsset.kind === "video" || editingAsset.kind === "audio")) ? (
                            <Form.Item name="content" label={t("assets.fields.textContent")} rules={[{ required: true, message: t("assets.fields.textRequired") }]}>
                                <Input.TextArea rows={8} placeholder={t("assets.fields.textPlaceholder")} />
                            </Form.Item>
                        ) : null}
                        {formKind === "image" && !(editingAsset && (editingAsset.kind === "video" || editingAsset.kind === "audio")) ? (
                            <Form.Item label={t("assets.fields.imageContent")} required>
                                <div className="rounded-lg border border-dashed border-stone-300 p-4 dark:border-stone-700">
                                    <Button icon={<Upload className="size-4" />} onClick={() => imageInputRef.current?.click()}>
                                        {t("assets.selectImageFile")}
                                    </Button>
                                    {imageDraft ? (
                                        <Typography.Text type="secondary" className="ml-3 text-xs">
                                            {imageDraft.width}x{imageDraft.height} · {formatBytes(imageDraft.bytes)}
                                        </Typography.Text>
                                    ) : (
                                        <Typography.Text type="secondary" className="ml-3 text-xs">
                                            {t("assets.noImageSelected")}
                                        </Typography.Text>
                                    )}
                                </div>
                            </Form.Item>
                        ) : null}
                    </Form>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950">
                        <Typography.Text strong>{t("assets.preview")}</Typography.Text>
                        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
                            {coverUrl || imageDraft?.dataUrl ? (
                                <img src={coverUrl || imageDraft?.dataUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                            ) : editingAsset?.kind === "video" ? (
                                <video src={editingAsset.data.url} muted playsInline preload="metadata" className="aspect-[4/3] w-full object-cover" />
                            ) : editingAsset?.kind === "audio" ? (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-900 dark:text-stone-500">
                                    <Music2 className="size-10" />
                                </div>
                            ) : (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 text-center text-sm text-stone-500 dark:bg-stone-900">{content || t("assets.noCover")}</div>
                            )}
                            <div className="p-4">
                                <Typography.Text strong ellipsis className="block">
                                    {title || t("assets.untitled")}
                                </Typography.Text>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {tags.length ? (
                                        tags.map((tag) => (
                                            <Tag key={tag} className="m-0">
                                                {tag}
                                            </Tag>
                                        ))
                                    ) : (
                                        <Tag className="m-0">{t("assets.untagged")}</Tag>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readCoverFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readImageFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
            </Modal>

            <AssetDrawer asset={previewAsset} onClose={() => setPreviewAsset(null)} onCopy={copyAssetText} onDownload={downloadAsset} />

            <input ref={assetInputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importAssetZip(event.target.files?.[0])} />
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={(event) => void addFiles(event.target.files || [])} />

            <Modal title={t("assets.deleteTitle")} open={Boolean(deletingAsset)} onCancel={() => setDeletingAsset(null)} onOk={confirmDelete} okText={t("common.delete")} okButtonProps={{ danger: true }} cancelText={t("common.cancel")}>
                {t("assets.deleteConfirm", { name: deletingAsset?.title })}
            </Modal>

            <Modal title={t("assets.batch.deleteTitle")} open={batchDeleteOpen} onCancel={() => setBatchDeleteOpen(false)} onOk={confirmBatchDelete} okText={t("common.delete")} okButtonProps={{ danger: true }} cancelText={t("common.cancel")}>
                {t("assets.batch.deleteDescription", { count: selectedIds.size })}
            </Modal>

            <Modal title={t("assets.batch.tagTitle", { count: selectedIds.size })} open={batchTagOpen} onCancel={() => setBatchTagOpen(false)} onOk={applyBatchTags} okText={t("common.save")} cancelText={t("common.cancel")}>
                <Select mode="tags" tokenSeparators={[",", "，"]} className="w-full" value={batchTags} onChange={setBatchTags} placeholder={t("assets.batch.tagPlaceholder")} open={false} />
            </Modal>

            <Modal title={t("assets.insertTitle")} open={Boolean(insertTarget)} onCancel={() => setInsertTarget(null)} footer={null}>
                {projects.length ? (
                    <div className="max-h-80 space-y-2 overflow-y-auto pt-1">
                        {projects.map((project) => (
                            <button key={project.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-stone-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20" onClick={() => insertAssetIntoCanvas(project.id)}>
                                <span className="truncate text-sm font-medium">{project.title || t("canvas.defaultTitle", { count: 1 })}</span>
                                <FolderOpen className="size-4 shrink-0 text-stone-400" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("assets.noCanvas")} />
                )}
            </Modal>
        </div>
    );
}

function AssetCard({
    asset,
    onOpen,
    onEdit,
    onCopy,
    onDownload,
    onDelete,
    onInsert,
    onOpenSource,
}: {
    asset: Asset;
    onOpen: () => void;
    onEdit: () => void;
    onCopy: (asset: Asset) => void;
    onDownload: (asset: Asset) => void;
    onDelete: () => void;
    onInsert: () => void;
    onOpenSource: (projectId: string) => void;
}) {
    const { t } = useTranslation();
    const cover = asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "");
    const summary = assetSummary(asset);
    const sourceProjectId = typeof asset.metadata?.projectId === "string" ? asset.metadata.projectId : "";
    return (
        <Card
            hoverable
            className="overflow-hidden"
            styles={{ body: { padding: 0 } }}
            cover={
                <button type="button" className="block w-full text-left" onClick={onOpen}>
                    {cover ? (
                        <img src={cover} alt={asset.title} className="aspect-[4/3] w-full object-cover" />
                    ) : asset.kind === "video" ? (
                        <video src={asset.data.url} muted playsInline preload="metadata" className="aspect-[4/3] w-full object-cover" />
                    ) : asset.kind === "audio" ? (
                        <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-900 dark:text-stone-500">
                            <Music2 className="size-10" />
                        </div>
                    ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 text-center text-sm leading-6 text-stone-600 dark:bg-stone-900 dark:text-stone-300">{asset.kind === "text" ? asset.data.content : t("assets.noCover")}</div>
                    )}
                </button>
            }
        >
            <button type="button" className="block w-full text-left" onClick={onOpen}>
                <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="line-clamp-1 text-sm font-semibold text-stone-950 dark:text-stone-100">{asset.title}</h2>
                            <Typography.Text type="secondary" className="mt-1 block text-xs">
                                {asset.source || t("assets.unknownSource")} · {t("assets.createdAt", { date: formatDate(asset.createdAt) })}
                            </Typography.Text>
                        </div>
                        <Tag className="m-0 shrink-0 text-[11px]">{t(`assets.kinds.${asset.kind}`)}</Tag>
                    </div>
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} className="!mb-0 !mt-2 !text-xs !leading-5">
                        {summary}
                    </Typography.Paragraph>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {(asset.tags || []).slice(0, 3).map((tag) => (
                            <Tag key={tag} className="m-0 text-[11px]">
                                {tag}
                            </Tag>
                        ))}
                        {!asset.tags?.length ? <Tag className="m-0 text-[11px]">{t("assets.noTags")}</Tag> : null}
                    </div>
                </div>
            </button>
            <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
                <Button size="small" onClick={onOpen}>
                    {t("common.view")}
                </Button>
                <Button size="small" icon={<FolderOpen className="size-3.5" />} onClick={onInsert}>
                    {t("assets.insertToCanvas")}
                </Button>
                <Button size="small" icon={<PencilLine className="size-3.5" />} onClick={onEdit}>
                    {t("common.edit")}
                </Button>
                {asset.kind === "text" ? (
                    <Button size="small" icon={<Copy className="size-3.5" />} onClick={() => void onCopy(asset)}>
                        {t("common.copy")}
                    </Button>
                ) : null}
                {asset.kind !== "text" ? (
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(asset)}>
                        {t("common.download")}
                    </Button>
                ) : null}
                {sourceProjectId ? (
                    <Button size="small" icon={<ExternalLink className="size-3.5" />} onClick={() => onOpenSource(sourceProjectId)}>
                        {t("assets.openSourceCanvas")}
                    </Button>
                ) : null}
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                    {t("common.delete")}
                </Button>
            </div>
        </Card>
    );
}

function AssetDrawer({ asset, onClose, onCopy, onDownload }: { asset: Asset | null; onClose: () => void; onCopy: (asset: Asset) => void; onDownload: (asset: Asset) => void }) {
    const { t } = useTranslation();
    const cover = asset ? asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "") : "";
    return (
        <Drawer title={t("assets.details")} open={Boolean(asset)} size="large" onClose={onClose}>
            {asset ? (
                <div className="space-y-5">
                    {cover ? (
                        <Image src={cover} alt={asset.title} className="rounded-lg" />
                    ) : asset.kind === "video" ? (
                        <video src={asset.data.url} controls className="aspect-video w-full rounded-lg bg-black" />
                    ) : asset.kind === "audio" ? (
                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <div className="mb-3 flex items-center gap-2 text-sm text-stone-500">
                                <Music2 className="size-4" />
                                {asset.data.mimeType}
                            </div>
                            <audio src={asset.data.url} controls className="w-full" />
                        </div>
                    ) : (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm leading-6 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">{asset.kind === "text" ? asset.data.content : t("assets.noCover")}</div>
                    )}
                    <div>
                        <Typography.Title level={4} className="!mb-2">
                            {asset.title}
                        </Typography.Title>
                        <Space size={[4, 4]} wrap>
                            <Tag>{t(`assets.kinds.${asset.kind}`)}</Tag>
                            {(asset.tags || []).map((tag) => (
                                <Tag key={tag}>{tag}</Tag>
                            ))}
                        </Space>
                    </div>
                    <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                        <Typography.Text type="secondary" className="block text-xs">
                            {t("assets.fields.textContent")}
                        </Typography.Text>
                        {asset.kind === "text" ? (
                            <Typography.Paragraph className="mt-2 whitespace-pre-wrap">{asset.data.content}</Typography.Paragraph>
                        ) : asset.kind === "video" ? (
                            <Typography.Text className="mt-2 block">
                                {asset.data.width}x{asset.data.height} · {formatBytes(asset.data.bytes)} · {asset.data.mimeType}
                            </Typography.Text>
                        ) : asset.kind === "audio" ? (
                            <Typography.Text className="mt-2 block">
                                {formatBytes(asset.data.bytes)} · {asset.data.mimeType}
                                {asset.data.durationMs ? ` · ${Math.round(asset.data.durationMs / 1000)}s` : ""}
                            </Typography.Text>
                        ) : (
                            <Typography.Text className="mt-2 block">
                                {asset.data.width}x{asset.data.height} · {formatBytes(asset.data.bytes)} · {asset.data.mimeType}
                            </Typography.Text>
                        )}
                    </div>
                    {asset.note ? (
                        <div>
                            <Typography.Text type="secondary">{t("assets.fields.note")}</Typography.Text>
                            <Typography.Paragraph className="mt-1">{asset.note}</Typography.Paragraph>
                        </div>
                    ) : null}
                    <Space>
                        {asset.kind === "text" ? (
                            <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(asset)}>
                                {t("assets.copyText")}
                            </Button>
                        ) : (
                            <Button type="primary" icon={<Download className="size-4" />} onClick={() => onDownload(asset)}>
                                {asset.kind === "video" ? t("assets.downloadVideo") : asset.kind === "audio" ? t("assets.downloadAudio") : t("assets.downloadImage")}
                            </Button>
                        )}
                    </Space>
                </div>
            ) : null}
        </Drawer>
    );
}

function assetSummary(asset: Asset) {
    if (asset.kind === "text") return asset.data.content;
    if (asset.kind === "audio") return `${asset.data.mimeType} · ${formatBytes(asset.data.bytes)}`;
    return `${asset.data.width}x${asset.data.height} · ${formatBytes(asset.data.bytes)} · ${asset.data.mimeType}`;
}

function assetSearchText(asset: Asset) {
    return [asset.title, asset.source || "", asset.note || "", (asset.tags || []).join(" "), asset.kind === "text" ? asset.data.content : asset.data.mimeType].join(" ").toLowerCase();
}

function formatDate(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
}

function extensionOf(mimeType: string) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mpeg")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    return "bin";
}
