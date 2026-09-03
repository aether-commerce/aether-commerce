"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  ImagePlus,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { useAdminConfig, useAdminStoreCurrency } from "./AetherAdminProvider";
import { FormSection } from "./FormSection";
import { StickyFormActions } from "./StickyFormActions";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAdminLanguage } from "./AdminLanguageProvider";
import { CategorySelect } from "./CategorySelect";
import { MoneyInput } from "./MoneyInput";

export type ProductFormValues = {
  name: string;
  slug: string;
  sku: string;
  brand: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  description: string;
  tags: string;
  highlights: string;
  images: { main: string; gallery: string[] };
  seoTitle: string;
  seoDescription: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  lowStockThreshold: number;
  visibility: "draft" | "visible" | "hidden";
  featured: boolean;
  featuredPosition: number | null;
  isNew: boolean;
  isDeal: boolean;
};

export const emptyProductForm: ProductFormValues = {
  name: "",
  slug: "",
  sku: "",
  brand: "",
  category: "",
  subcategory: "",
  shortDescription: "",
  description: "",
  tags: "",
  highlights: "",
  images: { main: "", gallery: [] },
  seoTitle: "",
  seoDescription: "",
  priceCents: 0,
  compareAtPriceCents: null,
  stock: 0,
  lowStockThreshold: 4,
  visibility: "draft",
  featured: false,
  featuredPosition: null,
  isNew: false,
  isDeal: false
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type GenerationStatus = "idle" | "generating" | "success" | "error";
type CategoryOption = { id: string; slug: string; name: string; isHidden: boolean };
type GeneratedProductContent = {
  category: string | null;
  subcategory: string | null;
  shortDescription: string;
  tags: string[];
  highlights: string[];
  seoTitle: string;
  seoDescription: string;
};
type GeneratedFieldsSnapshot = Pick<
  ProductFormValues,
  | "category"
  | "subcategory"
  | "shortDescription"
  | "tags"
  | "highlights"
  | "seoTitle"
  | "seoDescription"
>;

const inputClass =
  "focus-ring min-h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-ink disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm";
const labelClass = "grid gap-1 text-sm";
const labelTextClass = "font-medium text-ink-muted";

export function ProductForm({
  mode,
  productId,
  initialValues,
  onSaved
}: Readonly<{
  mode: "create" | "edit";
  productId?: string | undefined;
  initialValues: ProductFormValues;
  onSaved?: ((id: string) => void) | undefined;
}>) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { apiBaseUrl, config } = useAdminConfig();
  const { locale: adminLocale, t } = useAdminLanguage();
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(mode === "edit");
  const [valuesBeforeGeneration, setValuesBeforeGeneration] =
    useState<GeneratedFieldsSnapshot | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<"name" | "category" | "shortDescription" | "description" | "price", string | undefined>
    >
  >({});
  const storeCurrency = useAdminStoreCurrency();
  const moneyLocale = adminLocale === "es" ? config.store.locale : "en-US";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const advancedSummaryRef = useRef<HTMLElement>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => generationControllerRef.current?.abort(), []);

  async function loadCategories() {
    if (categoryStatus === "loading" || categoryStatus === "ready") return;
    setCategoryStatus("loading");
    try {
      const response = await authorizedFetch("/api/v1/admin/categories", { method: "GET" });
      const payload = (await response.json()) as { success: boolean; data?: CategoryOption[] };
      if (!payload.success || !payload.data) throw new Error("categories unavailable");
      setCategories(
        payload.data.filter((category) => !category.isHidden || category.slug === values.category)
      );
      setCategoryStatus("ready");
    } catch {
      setCategoryStatus("error");
    }
  }

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setCompareAtPrice(value: number | null) {
    set("compareAtPriceCents", value);
  }

  function buildPayload() {
    return {
      name: values.name.trim(),
      slug: values.slug.trim() || undefined,
      sku: values.sku.trim() || undefined,
      brand: values.brand.trim() || null,
      category: values.category.trim(),
      subcategory: values.subcategory.trim() || null,
      shortDescription: values.shortDescription.trim(),
      description: values.description.trim(),
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      highlights: values.highlights
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      images: values.images,
      seoTitle: values.seoTitle.trim() || undefined,
      seoDescription: values.seoDescription.trim() || undefined,
      priceCents: values.priceCents,
      compareAtPriceCents: values.compareAtPriceCents,
      stock: values.stock,
      lowStockThreshold: values.lowStockThreshold,
      visibility: values.visibility,
      featured: values.featured,
      featuredPosition: values.featured ? values.featuredPosition : null,
      isNew: values.isNew,
      isDeal: values.isDeal
    };
  }

  async function authorizedFetch(path: string, init: RequestInit) {
    const token = await getToken().catch(() => null);
    return fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    setErrorMessage(null);
    const nextErrors: typeof fieldErrors = {};
    if (!values.name.trim()) nextErrors.name = t.productForm.nameRequired;
    if (!values.category.trim()) nextErrors.category = t.productForm.categoryRequired;
    if (!values.shortDescription.trim())
      nextErrors.shortDescription = t.productForm.shortDescriptionRequired;
    if (!values.description.trim()) nextErrors.description = t.productForm.descriptionRequired;
    if (values.priceCents == null || values.priceCents < 0)
      nextErrors.price = t.productForm.priceRequired;
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      setErrorMessage(t.productForm.requiredFieldsMissing);
      if (nextErrors.name) nameRef.current?.focus();
      else if (nextErrors.description) descriptionRef.current?.focus();
      else {
        setAdvancedOpen(true);
        requestAnimationFrame(() => advancedSummaryRef.current?.focus());
      }
      return;
    }
    if (!values.images.main) {
      setStatus("error");
      setErrorMessage(t.productForm.mainImageRequired);
      return;
    }
    if (values.compareAtPriceCents != null && values.compareAtPriceCents <= values.priceCents) {
      setStatus("error");
      setErrorMessage(t.productForm.compareAtPriceTooLow);
      return;
    }

    try {
      const response = await authorizedFetch(
        mode === "create" ? "/api/v1/admin/products" : `/api/v1/admin/products/${productId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          body: JSON.stringify(buildPayload())
        }
      );
      const payload = (await response.json()) as {
        success: boolean;
        data?: { id: string };
        error?: { message: string };
      };
      if (!payload.success) {
        setStatus("error");
        setErrorMessage(payload.error?.message ?? t.productForm.couldNotSaveProduct);
        return;
      }
      setStatus("saved");
      const id = payload.data?.id ?? productId;
      if (id) onSaved?.(id);
      if (mode === "create" && id) {
        router.push(`/products/edit/?id=${encodeURIComponent(id)}`);
      }
    } catch {
      setStatus("error");
      setErrorMessage(t.productForm.networkErrorProductNotSaved);
    }
  }

  async function handleGenerateContent() {
    const missingName = !values.name.trim();
    const missingDescription = !values.description.trim();
    if (missingName || missingDescription) {
      setFieldErrors((current) => ({
        ...current,
        name: missingName ? t.productForm.nameRequiredForAi : current.name,
        description: missingDescription
          ? t.productForm.descriptionRequiredForAi
          : current.description
      }));
      setGenerationStatus("error");
      setGenerationMessage(t.productForm.aiNeedsEssentials);
      (missingName ? nameRef.current : descriptionRef.current)?.focus();
      return;
    }

    generationControllerRef.current?.abort();
    const controller = new AbortController();
    generationControllerRef.current = controller;
    setGenerationStatus("generating");
    setGenerationMessage(t.productForm.aiGenerating);
    setErrorMessage(null);

    try {
      const response = await authorizedFetch("/api/v1/admin/products/generate-content", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim(),
          locale: adminLocale
        })
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: GeneratedProductContent;
        error?: { code?: string; message?: string };
      };
      if (!payload.success || !payload.data) {
        setGenerationStatus("error");
        setGenerationMessage(
          payload.error?.code === "AI_NOT_CONFIGURED"
            ? t.productForm.aiNotConfigured
            : t.productForm.aiGenerationFailed
        );
        return;
      }

      const generated = payload.data;
      setValuesBeforeGeneration({
        category: values.category,
        subcategory: values.subcategory,
        shortDescription: values.shortDescription,
        tags: values.tags,
        highlights: values.highlights,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription
      });
      setValues((current) => ({
        ...current,
        category: generated.category ?? current.category,
        subcategory: generated.subcategory ?? current.subcategory,
        shortDescription: generated.shortDescription,
        tags: generated.tags.join(", "),
        highlights: generated.highlights.join("\n"),
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription
      }));
      setFieldErrors((current) => ({
        ...current,
        category: undefined,
        shortDescription: undefined
      }));
      setGenerationStatus("success");
      setGenerationMessage(t.productForm.aiGenerationComplete);
      setAdvancedOpen(true);
      void loadCategories();
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setGenerationStatus("error");
      setGenerationMessage(t.productForm.aiGenerationFailed);
    } finally {
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
    }
  }

  function undoGeneratedContent() {
    if (!valuesBeforeGeneration) return;
    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    setValues((current) => ({ ...current, ...valuesBeforeGeneration }));
    setValuesBeforeGeneration(null);
    setGenerationStatus("idle");
    setGenerationMessage(t.productForm.aiChangesUndone);
  }

  async function handleFileSelected(file: File) {
    setUploading(true);
    setErrorMessage(null);
    try {
      const sigResponse = await authorizedFetch("/api/v1/admin/uploads/signature", {
        method: "POST"
      });
      const sigPayload = (await sigResponse.json()) as {
        success: boolean;
        data?: {
          cloudName: string;
          apiKey: string;
          timestamp: number;
          folder: string;
          signature: string;
        };
        error?: { message: string };
      };
      if (!sigPayload.success || !sigPayload.data) {
        setErrorMessage(sigPayload.error?.message ?? t.productForm.imageUploadsNotConfigured);
        return;
      }
      const { cloudName, apiKey, timestamp, folder, signature } = sigPayload.data;
      const form = new FormData();
      form.set("file", file);
      form.set("api_key", apiKey);
      form.set("timestamp", String(timestamp));
      form.set("folder", folder);
      form.set("signature", signature);
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: form
        }
      );
      const uploadPayload = (await uploadResponse.json()) as {
        secure_url?: string;
        error?: { message?: string };
      };
      if (!uploadResponse.ok || !uploadPayload.secure_url) {
        setErrorMessage(uploadPayload.error?.message ?? t.productForm.imageUploadFailed);
        return;
      }
      setValues((current) =>
        current.images.main
          ? {
              ...current,
              images: {
                ...current.images,
                gallery: [...current.images.gallery, uploadPayload.secure_url as string]
              }
            }
          : {
              ...current,
              images: { main: uploadPayload.secure_url as string, gallery: current.images.gallery }
            }
      );
    } catch {
      setErrorMessage(t.productForm.networkErrorImageNotUploaded);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setValues((current) => {
      if (current.images.main === url) {
        const [nextMain, ...rest] = current.images.gallery;
        return { ...current, images: { main: nextMain ?? "", gallery: rest } };
      }
      return {
        ...current,
        images: {
          ...current.images,
          gallery: current.images.gallery.filter((item) => item !== url)
        }
      };
    });
  }

  function makeMainImage(url: string) {
    setValues((current) => ({
      ...current,
      images: {
        main: url,
        gallery: [current.images.main, ...current.images.gallery].filter(
          (item) => item && item !== url
        )
      }
    }));
  }

  async function handleDelete() {
    if (!productId) return;
    setDeleting(true);
    try {
      const response = await authorizedFetch(`/api/v1/admin/products/${productId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: { deleted: boolean; softDeleted: boolean };
      };
      if (!payload.success) {
        setErrorMessage(t.productForm.couldNotDeleteProduct);
        return;
      }
      router.push("/products/");
    } catch {
      setErrorMessage(t.productForm.networkErrorProductNotDeleted);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const allImages = [values.images.main, ...values.images.gallery].filter(Boolean);

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="product-form grid gap-6 pb-16 lg:grid-cols-2"
    >
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger lg:col-span-2"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <FormSection
        title={t.productForm.essentialInfoSection}
        description={t.productForm.essentialInfoDescription}
        className="lg:col-span-2"
      >
        <div className="grid gap-5">
          <label className={labelClass}>
            <span className={labelTextClass}>{t.productForm.nameLabel}</span>
            <input
              ref={nameRef}
              required
              disabled={generationStatus === "generating"}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "product-name-error" : "product-name-hint"}
              autoComplete="off"
              className={inputClass}
              value={values.name}
              onChange={(event) => {
                set("name", event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
            />
            <span id="product-name-hint" className="text-xs text-ink-subtle">
              {t.productForm.nameHint}
            </span>
            {fieldErrors.name ? (
              <span id="product-name-error" className="text-xs text-danger">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>

          <label className={labelClass}>
            <span className={labelTextClass}>{t.productForm.descriptionLabel}</span>
            <textarea
              ref={descriptionRef}
              required
              disabled={generationStatus === "generating"}
              rows={7}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description ? "product-description-error" : "product-description-hint"
              }
              className={`${inputClass} min-h-44 resize-none py-3 leading-6`}
              value={values.description}
              onChange={(event) => {
                set("description", event.target.value);
                setFieldErrors((current) => ({ ...current, description: undefined }));
              }}
            />
            <span id="product-description-hint" className="text-xs text-ink-subtle">
              {t.productForm.descriptionHint}
            </span>
            {fieldErrors.description ? (
              <span id="product-description-error" className="text-xs text-danger">
                {fieldErrors.description}
              </span>
            ) : null}
          </label>

          <div className="grid gap-3 rounded-lg border border-accent/30 bg-accent-soft/60 p-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white"
              aria-hidden
            >
              <Sparkles size={19} />
            </span>
            <div className="grid min-w-0 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">{t.productForm.aiAssistantTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  {t.productForm.aiAssistantDescription}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={generationStatus === "generating"}
                  onClick={() => void handleGenerateContent()}
                  className="focus-ring inline-flex min-h-11 min-w-52 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generationStatus === "generating" ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles size={16} aria-hidden />
                  )}
                  {generationStatus === "generating"
                    ? t.productForm.aiGeneratingButton
                    : generationStatus === "success"
                      ? t.productForm.aiGenerateAgain
                      : t.productForm.aiGenerateButton}
                </button>
                {valuesBeforeGeneration ? (
                  <button
                    type="button"
                    onClick={undoGeneratedContent}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink-muted hover:bg-surface-hover hover:text-ink"
                  >
                    <Undo2 size={15} aria-hidden />
                    {t.productForm.undoAiChanges}
                  </button>
                ) : null}
              </div>
              <div
                aria-live="polite"
                className="flex min-h-5 items-center gap-1.5 text-xs text-ink-muted"
              >
                {generationStatus === "success" ? (
                  <CheckCircle2 size={14} className="text-success" aria-hidden />
                ) : null}
                {generationStatus === "error" ? (
                  <AlertTriangle size={14} className="text-danger" aria-hidden />
                ) : null}
                <span>{generationMessage ?? t.productForm.aiPrivacyHint}</span>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title={t.productForm.priceSection}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={labelTextClass}>
              {t.productForm.priceLabel.replace("{currency}", storeCurrency)}
            </span>
            <MoneyInput
              value={values.priceCents}
              currency={storeCurrency}
              locale={moneyLocale}
              className={inputClass}
              onValueChange={(value) => set("priceCents", value ?? 0)}
            />
            {fieldErrors.price ? (
              <span className="text-xs text-danger">{fieldErrors.price}</span>
            ) : null}
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>{t.productForm.compareAtPriceLabel}</span>
            <MoneyInput
              value={values.compareAtPriceCents}
              currency={storeCurrency}
              locale={moneyLocale}
              className={inputClass}
              onValueChange={setCompareAtPrice}
            />
            <span className="text-xs text-ink-subtle">{t.productForm.compareAtPriceHint}</span>
          </label>
        </div>
      </FormSection>

      <FormSection title={t.productForm.inventorySection}>
        <div className="grid gap-3">
          <label className={labelClass}>
            <span className={labelTextClass}>{t.productForm.stockLabel}</span>
            <input
              required
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              className={inputClass}
              value={values.stock}
              onChange={(event) =>
                set("stock", Math.max(0, Number(event.target.value.replace(/[^0-9]/g, "")) || 0))
              }
            />
          </label>
          <span className="text-xs text-ink-subtle">{t.productForm.inventoryHint}</span>
        </div>
      </FormSection>

      <FormSection
        title={t.productForm.imagesSection}
        description={t.productForm.imagesDescription}
      >
        <div className="flex flex-wrap gap-3">
          {allImages.map((url) => (
            <div
              key={url}
              className="group relative h-24 w-24 overflow-hidden rounded-md border border-border"
            >
              {/* Plain <img>, not next/image - admin-managed, arbitrary remote URLs */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {url === values.images.main ? (
                <span className="absolute left-1 top-1 rounded bg-ink/80 p-1 text-surface">
                  <Star size={11} aria-hidden />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeMainImage(url)}
                  className="focus-ring absolute left-1 top-1 min-h-9 min-w-9 rounded bg-ink/70 p-2 text-surface sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={t.productForm.makeMainImage}
                >
                  <Star size={11} aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="focus-ring absolute right-1 top-1 min-h-9 min-w-9 rounded bg-ink/70 p-2 text-surface sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={t.productForm.removeImage}
              >
                <X size={11} aria-hidden />
              </button>
              <span
                className="absolute bottom-1 right-1 text-ink-subtle opacity-0 group-hover:opacity-100"
                aria-hidden
              >
                <GripVertical size={12} />
              </span>
            </div>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="focus-ring grid h-24 w-24 place-items-center gap-1 rounded-md border-2 border-dashed border-border-strong text-xs font-medium text-ink-muted hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <ImagePlus size={18} aria-hidden />
            )}
            {uploading ? t.productForm.uploading : t.productForm.addImage}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
              event.target.value = "";
            }}
          />
        </div>
      </FormSection>

      <FormSection
        title={t.productForm.storefrontSection}
        description={t.productForm.storefrontDescription}
        className="lg:col-span-2"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={labelTextClass}>{t.productForm.statusLabel}</span>
            {/* Native ownership is intentional: the operating-system popup is acceptable for this three-option field. */}
            <select
              className={inputClass}
              value={values.visibility}
              onChange={(event) =>
                set("visibility", event.target.value as ProductFormValues["visibility"])
              }
            >
              <option value="draft">{t.productsPage.statusDraft}</option>
              <option value="visible">{t.productsPage.statusPublished}</option>
              <option value="hidden">{t.productsPage.statusArchived}</option>
            </select>
            <span className="text-xs text-ink-subtle">{t.productForm.statusHint}</span>
          </label>
          <div className="grid content-start gap-3 rounded-md border border-border bg-bg p-3">
            <span className={labelTextClass}>{t.productForm.catalogBadgesLabel}</span>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={values.featured}
                  onChange={(event) => set("featured", event.target.checked)}
                />
                {t.productForm.featured}
              </label>
              <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={values.isNew}
                  onChange={(event) => set("isNew", event.target.checked)}
                />
                {t.productForm.newArrival}
              </label>
              <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={values.isDeal}
                  onChange={(event) => set("isDeal", event.target.checked)}
                />
                {t.productForm.onSale}
              </label>
            </div>
          </div>
          {values.featured ? (
            <label className={`${labelClass} sm:col-span-2`}>
              <span className={labelTextClass}>{t.productForm.featuredPositionLabel}</span>
              {/* Native ownership is intentional for the compact fixed set of hero positions. */}
              <select
                className={`${inputClass} max-w-xs`}
                value={values.featuredPosition == null ? "" : String(values.featuredPosition)}
                onChange={(event) =>
                  set("featuredPosition", event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">{t.productForm.featuredPositionAutomatic}</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
              <span className="text-xs leading-5 text-ink-muted">
                {t.productForm.featuredPositionHint}
              </span>
            </label>
          ) : null}
        </div>
      </FormSection>

      <details
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        className="group rounded-lg border border-border bg-surface lg:col-span-2"
      >
        <summary
          ref={advancedSummaryRef}
          className="focus-ring flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-lg px-5 py-4 hover:bg-surface-hover [&::-webkit-details-marker]:hidden"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-ink-muted">
            <Sparkles size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              {t.productForm.advancedOptionsTitle}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
              {t.productForm.advancedOptionsDescription}
            </span>
          </span>
          <ChevronDown
            size={17}
            className="shrink-0 text-ink-subtle transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="grid gap-7 border-t border-border px-5 py-5">
          <div className="grid gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                {t.productForm.organizationSection}
              </h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {t.productForm.organizationDescription}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={labelClass}>
                <span className={labelTextClass}>{t.productForm.categoryLabel}</span>
                <CategorySelect
                  value={values.category}
                  options={categories}
                  loading={categoryStatus === "loading"}
                  error={categoryStatus === "error"}
                  invalid={Boolean(fieldErrors.category)}
                  onOpen={() => void loadCategories()}
                  onRetry={() => {
                    setCategoryStatus("idle");
                    void loadCategories();
                  }}
                  onValueChange={(value) => {
                    set("category", value);
                    setFieldErrors((current) => ({ ...current, category: undefined }));
                  }}
                  ariaLabel={t.productForm.categoryLabel}
                  labels={{
                    placeholder: t.productForm.categoryPlaceholder,
                    search: t.productForm.searchCategories,
                    loading: t.productForm.loadingCategories,
                    error: t.productForm.categoriesLoadError,
                    empty: t.productForm.categoriesEmpty,
                    noResults: t.productForm.categoriesNoResults,
                    retry: t.productForm.retryCategories
                  }}
                />
                {fieldErrors.category ? (
                  <span className="text-xs text-danger">{fieldErrors.category}</span>
                ) : null}
              </div>
              <label className={labelClass}>
                <span className={labelTextClass}>{t.productForm.subcategoryLabel}</span>
                <input
                  className={inputClass}
                  value={values.subcategory}
                  onChange={(event) => set("subcategory", event.target.value)}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                <span className={labelTextClass}>{t.productForm.brandLabel}</span>
                <input
                  className={inputClass}
                  value={values.brand}
                  onChange={(event) => set("brand", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                {t.productForm.generatedCopySection}
              </h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {t.productForm.generatedCopyDescription}
              </p>
            </div>
            <label className={labelClass}>
              <span className={labelTextClass}>{t.productForm.shortDescriptionLabel}</span>
              <input
                required
                aria-invalid={Boolean(fieldErrors.shortDescription)}
                aria-describedby={
                  fieldErrors.shortDescription ? "product-short-description-error" : undefined
                }
                maxLength={300}
                className={inputClass}
                value={values.shortDescription}
                onChange={(event) => {
                  set("shortDescription", event.target.value);
                  setFieldErrors((current) => ({ ...current, shortDescription: undefined }));
                }}
              />
              <span className="text-right text-xs text-ink-subtle">
                {values.shortDescription.length}/300
              </span>
              {fieldErrors.shortDescription ? (
                <span id="product-short-description-error" className="text-xs text-danger">
                  {fieldErrors.shortDescription}
                </span>
              ) : null}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                <span className={labelTextClass}>{t.productForm.tagsLabel}</span>
                <input
                  className={inputClass}
                  value={values.tags}
                  onChange={(event) => set("tags", event.target.value)}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>{t.productForm.highlightsLabel}</span>
                <textarea
                  rows={4}
                  className={`${inputClass} min-h-28 resize-none py-3`}
                  value={values.highlights}
                  onChange={(event) => set("highlights", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.productForm.technicalSection}</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {t.productForm.technicalDescription}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                <span className={labelTextClass}>{t.productForm.slugLabel}</span>
                <input
                  className={inputClass}
                  value={values.slug}
                  placeholder={t.productForm.slugPlaceholder}
                  onChange={(event) => set("slug", event.target.value)}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>{t.productForm.skuLabel}</span>
                <input
                  className={inputClass}
                  value={values.sku}
                  placeholder={t.productForm.skuPlaceholder}
                  onChange={(event) => set("sku", event.target.value)}
                />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>{t.productForm.lowStockThresholdLabel}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  className={inputClass}
                  value={values.lowStockThreshold}
                  onChange={(event) =>
                    set(
                      "lowStockThreshold",
                      Math.max(0, Number(event.target.value.replace(/[^0-9]/g, "")) || 0)
                    )
                  }
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.productForm.seoSection}</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {t.productForm.seoDescription}
              </p>
            </div>
            <label className={labelClass}>
              <span className={labelTextClass}>{t.productForm.seoTitleLabel}</span>
              <input
                maxLength={160}
                className={inputClass}
                placeholder={values.name ? `${values.name} | ${config.brand.name}` : ""}
                value={values.seoTitle}
                onChange={(event) => set("seoTitle", event.target.value)}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>{t.productForm.seoDescriptionLabel}</span>
              <textarea
                rows={3}
                maxLength={300}
                className={`${inputClass} min-h-24 resize-none py-3`}
                placeholder={values.shortDescription.slice(0, 150)}
                value={values.seoDescription}
                onChange={(event) => set("seoDescription", event.target.value)}
              />
            </label>
            <p className="rounded-md border border-border bg-bg p-3 text-xs leading-5 text-ink-subtle">
              {t.productForm.previewLabel}{" "}
              <span className="font-medium text-ink-muted">
                {values.seoTitle || (values.name ? `${values.name} | ${config.brand.name}` : "...")}
              </span>
              {" — "}
              /products/{values.slug || "..."}
            </p>
          </div>
        </div>
      </details>

      <StickyFormActions>
        <button
          type="submit"
          disabled={status === "saving"}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "saving" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          {mode === "create" ? t.productsPage.createProduct : t.productForm.saveChanges}
        </button>
        {status === "saved" ? (
          <span className="text-sm text-success">{t.productForm.saved}</span>
        ) : null}

        {mode === "edit" ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="focus-ring ml-auto inline-flex min-h-11 items-center gap-2 rounded-md border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            <Trash2 size={15} aria-hidden />
            {t.common.delete}
          </button>
        ) : null}
      </StickyFormActions>

      <ConfirmDialog
        open={confirmingDelete}
        title={t.productForm.deleteThisProductTitle}
        description={t.productForm.deleteThisProductDescription}
        confirmLabel={t.productForm.confirmDelete}
        tone="danger"
        pending={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </form>
  );
}
