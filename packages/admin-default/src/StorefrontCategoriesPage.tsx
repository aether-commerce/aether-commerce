"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageIcon, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { RequireAdminAuth } from "./RequireAdminAuth";
import { useAdminConfig } from "./AetherAdminProvider";
import { useAdminLanguage } from "./AdminLanguageProvider";

type Config = { id: string; enabled: boolean; position: number; displayName: string | null; description: string | null; visualType: "icon" | "image" | "none"; iconKey: string | null; imageUrl: string | null };
type Category = { id: string; slug: string; name: string; isHidden: boolean; productCount: number; config: Config | null };
type Payload = { section: { enabled: boolean; eyebrow: string | null; title: string | null; description: string | null }; categories: Category[] };
const iconOptions = ["smartphone", "laptop", "headphones", "tablet", "watch", "glasses", "sofa", "lamp", "sports", "sparkles"] as const;

export function StorefrontCategoriesPage() {
  const { apiBaseUrl } = useAdminConfig();
  const { locale } = useAdminLanguage();
  const { getToken } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [form, setForm] = useState({ displayName: "", description: "", visualType: "icon" as Config["visualType"], iconKey: "sparkles", imageUrl: "", enabled: true });
  const copy = locale === "es"
    ? { title: "Categorías destacadas", description: "Elige, ordena y presenta categorías del catálogo sin modificar su estructura ni sus URLs.", section: "Contenido de la sección", enabled: "Mostrar la sección", eyebrow: "Etiqueta", heading: "Título", sectionDescription: "Descripción", save: "Guardar cambios", selected: "Categorías seleccionadas", available: "Categorías del catálogo", add: "Agregar", products: "productos visibles", empty: "Todavía no has seleccionado categorías para mostrar.", edit: "Editar", remove: "Quitar", reset: "Restaurar valores", moveUp: "Subir", moveDown: "Bajar", visible: "Visible", hidden: "Oculta", visual: "Recurso visual", icon: "Icono", image: "Imagen", none: "Sin recurso", imageUrl: "URL de imagen HTTPS", shownTitle: "Título mostrado", categoryDescription: "Descripción", cancel: "Cancelar", saveCategory: "Guardar categoría", removeTitle: "¿Quitar esta categoría destacada?", removeDescription: "La categoría y sus productos permanecerán en el catálogo.", confirmRemove: "Quitar", saved: "Cambios guardados.", failed: "No se pudieron guardar los cambios.", retry: "Reintentar" }
    : { title: "Featured categories", description: "Choose, order, and present catalog categories without changing their structure or URLs.", section: "Section content", enabled: "Show section", eyebrow: "Eyebrow", heading: "Title", sectionDescription: "Description", save: "Save changes", selected: "Selected categories", available: "Catalog categories", add: "Add", products: "visible products", empty: "No categories have been selected to show yet.", edit: "Edit", remove: "Remove", reset: "Restore defaults", moveUp: "Move up", moveDown: "Move down", visible: "Visible", hidden: "Hidden", visual: "Visual resource", icon: "Icon", image: "Image", none: "No visual", imageUrl: "HTTPS image URL", shownTitle: "Displayed title", categoryDescription: "Description", cancel: "Cancel", saveCategory: "Save category", removeTitle: "Remove this featured category?", removeDescription: "The category and its products will remain in the catalog.", confirmRemove: "Remove", saved: "Changes saved.", failed: "Changes could not be saved.", retry: "Retry" };

  const authHeaders = useCallback(async () => {
    const token = await getToken().catch(() => null);
    return token ? { authorization: `Bearer ${token}` } : {};
  }, [getToken]);
  const request = useCallback(async (path: string, init?: RequestInit) => fetch(`${apiBaseUrl}/api/v1/admin/storefront/category-section${path}`, { ...init, headers: { "content-type": "application/json", ...(await authHeaders()), ...(init?.headers ?? {}) } }), [apiBaseUrl, authHeaders]);
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await request("");
      const payload = await response.json() as { success?: boolean; data?: Payload };
      if (!response.ok || !payload.success || !payload.data) throw new Error("load failed");
      setData(payload.data);
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => data?.categories.filter((category) => category.config).sort((a, b) => (a.config?.position ?? 0) - (b.config?.position ?? 0)) ?? [], [data]);
  const available = useMemo(() => data?.categories.filter((category) => !category.config) ?? [], [data]);
  function updateData(updater: (current: Payload) => Payload) { setData((current) => current ? updater(current) : current); }
  function startEdit(category: Category) {
    const config = category.config;
    if (!config) return;
    setEditing(category);
    setForm({ displayName: config.displayName ?? category.name, description: config.description ?? "", visualType: config.visualType, iconKey: config.iconKey ?? "sparkles", imageUrl: config.imageUrl ?? "", enabled: config.enabled });
  }
  async function saveSection() {
    if (!data) return;
    setSaving(true); setMessage(null);
    try {
      const response = await request("", { method: "PUT", body: JSON.stringify(data.section) });
      if (!response.ok) throw new Error("save failed");
      setMessage(copy.saved);
    } catch { setMessage(copy.failed); } finally { setSaving(false); }
  }
  async function add(category: Category) {
    setSaving(true); setMessage(null);
    try {
      const response = await request("/categories", { method: "POST", body: JSON.stringify({ categoryId: category.id, visualType: "icon", iconKey: "sparkles" }) });
      const payload = await response.json() as { success?: boolean; data?: Config };
      if (!response.ok || !payload.success || !payload.data) throw new Error("add failed");
      updateData((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, config: payload.data as Config } : item) }));
      setMessage(copy.saved);
    } catch { setMessage(copy.failed); } finally { setSaving(false); }
  }
  async function saveCategory() {
    if (!editing) return;
    setSaving(true); setMessage(null);
    try {
      const payload = { displayName: form.displayName.trim() || null, description: form.description.trim() || null, visualType: form.visualType, iconKey: form.visualType === "icon" ? form.iconKey : null, imageUrl: form.visualType === "image" ? form.imageUrl.trim() || null : null, enabled: form.enabled };
      const response = await request(`/categories/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      const result = await response.json() as { success?: boolean; data?: Config };
      if (!response.ok || !result.success || !result.data) throw new Error("save failed");
      updateData((current) => ({ ...current, categories: current.categories.map((item) => item.id === editing.id ? { ...item, config: result.data as Config } : item) }));
      setEditing(null); setMessage(copy.saved);
    } catch { setMessage(copy.failed); } finally { setSaving(false); }
  }
  async function move(category: Category, direction: -1 | 1) {
    const index = selected.findIndex((item) => item.id === category.id);
    const next = index + direction;
    if (next < 0 || next >= selected.length) return;
    const reordered = [...selected]; [reordered[index], reordered[next]] = [reordered[next] as Category, reordered[index] as Category];
    const ids = reordered.map((item) => item.id);
    updateData((current) => ({ ...current, categories: current.categories.map((item) => ({ ...item, config: item.config ? { ...item.config, position: ids.indexOf(item.id) } : null })) }));
    const response = await request("/categories/reorder", { method: "POST", body: JSON.stringify({ categoryIds: ids }) });
    if (!response.ok) { setMessage(copy.failed); await load(); }
  }
  async function toggle(category: Category) {
    if (!category.config) return;
    const response = await request(`/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !category.config.enabled }) });
    const result = await response.json() as { success?: boolean; data?: Config };
    if (response.ok && result.success && result.data) updateData((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, config: result.data as Config } : item) })); else setMessage(copy.failed);
  }
  async function reset(category: Category) {
    const response = await request(`/categories/${category.id}/reset`, { method: "POST", body: "{}" });
    const result = await response.json() as { success?: boolean; data?: Config };
    if (response.ok && result.success && result.data) updateData((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, config: result.data as Config } : item) })); else setMessage(copy.failed);
  }
  async function remove() {
    if (!removing) return;
    setSaving(true);
    const response = await request(`/categories/${removing.id}`, { method: "DELETE" });
    if (response.ok) updateData((current) => ({ ...current, categories: current.categories.map((item) => item.id === removing.id ? { ...item, config: null } : item) })); else setMessage(copy.failed);
    setRemoving(null); setSaving(false);
  }

  return <RequireAdminAuth><main id="main-content" className="admin-shell py-8"><PageHeader title={copy.title} description={copy.description} />
    {status === "loading" ? <p className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-ink-muted">Loading...</p> : null}
    {status === "error" ? <div className="mt-6"><ErrorState title={copy.failed} action={<button type="button" onClick={() => void load()} className="focus-ring rounded-md border border-border-strong px-3 py-2 text-sm font-semibold">{copy.retry}</button>} /></div> : null}
    {status === "ready" && data ? <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-6"><FormSection title={copy.section}><label className="flex items-center justify-between gap-4 text-sm font-medium text-ink"><span>{copy.enabled}</span><button type="button" role="switch" aria-checked={data.section.enabled} onClick={() => updateData((current) => ({ ...current, section: { ...current.section, enabled: !current.section.enabled } }))} className="focus-ring rounded-md border border-border-strong px-3 py-2 text-sm font-semibold hover:bg-surface-hover">{data.section.enabled ? copy.visible : copy.hidden}</button></label><label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.eyebrow}</span><input value={data.section.eyebrow ?? ""} onChange={(event) => updateData((current) => ({ ...current, section: { ...current.section, eyebrow: event.target.value || null } }))} className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink" /></label><label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.heading}</span><input value={data.section.title ?? ""} onChange={(event) => updateData((current) => ({ ...current, section: { ...current.section, title: event.target.value || null } }))} className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink" /></label><label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.sectionDescription}</span><textarea rows={3} value={data.section.description ?? ""} onChange={(event) => updateData((current) => ({ ...current, section: { ...current.section, description: event.target.value || null } }))} className="focus-ring resize-none rounded-md border border-border bg-surface px-3 py-2 text-ink" /></label><button type="button" disabled={saving} onClick={() => void saveSection()} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{saving ? "…" : copy.save}</button></FormSection>
        <section className="rounded-lg border border-border bg-surface"><div className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold text-ink">{copy.selected}</h2></div>{selected.length === 0 ? <EmptyState icon={ImageIcon} title={copy.empty} description={copy.description} /> : <div className="divide-y divide-border">{selected.map((category, index) => <div key={category.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-semibold text-ink">{category.config?.displayName || category.name}</p><p className="text-xs text-ink-muted">{category.productCount} {copy.products} · {category.slug}</p></div><button type="button" onClick={() => void toggle(category)} className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-md border border-border-strong px-2.5 text-xs font-semibold text-ink hover:bg-surface-hover">{category.config?.enabled ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}{category.config?.enabled ? copy.visible : copy.hidden}</button><div className="flex items-center"><button type="button" disabled={index === 0} aria-label={copy.moveUp} onClick={() => void move(category, -1)} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-30"><ArrowUp size={16} aria-hidden /></button><button type="button" disabled={index === selected.length - 1} aria-label={copy.moveDown} onClick={() => void move(category, 1)} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-30"><ArrowDown size={16} aria-hidden /></button></div><button type="button" aria-label={`${copy.edit} ${category.name}`} onClick={() => startEdit(category)} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover"><Pencil size={16} aria-hidden /></button><button type="button" aria-label={`${copy.remove} ${category.name}`} onClick={() => setRemoving(category)} className="focus-ring rounded-md p-2 text-danger hover:bg-danger/10"><Trash2 size={16} aria-hidden /></button></div>)}</div>}</section></div>
      <div className="grid content-start gap-6"><FormSection title={editing ? `${copy.edit}: ${editing.name}` : copy.available}>{editing ? <><label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.shownTitle}</span><input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink" /></label><label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.categoryDescription}</span><textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="focus-ring resize-none rounded-md border border-border bg-surface px-3 py-2 text-ink" /></label><fieldset className="grid gap-2"><legend className="text-sm font-medium text-ink-muted">{copy.visual}</legend><div className="flex flex-wrap gap-2">{(["icon", "image", "none"] as const).map((type) => <button key={type} type="button" aria-pressed={form.visualType === type} onClick={() => setForm((current) => ({ ...current, visualType: type }))} className="focus-ring min-h-9 rounded-md border border-border-strong px-3 text-sm text-ink hover:bg-surface-hover data-[active=true]:bg-accent-soft" data-active={form.visualType === type}>{type === "icon" ? copy.icon : type === "image" ? copy.image : copy.none}</button>)}</div></fieldset>{form.visualType === "icon" ? <fieldset className="grid gap-2"><legend className="text-sm font-medium text-ink-muted">{copy.icon}</legend><div className="flex flex-wrap gap-2">{iconOptions.map((key) => <button key={key} type="button" aria-pressed={form.iconKey === key} onClick={() => setForm((current) => ({ ...current, iconKey: key }))} className="focus-ring min-h-9 rounded-md border border-border-strong px-2.5 text-xs text-ink hover:bg-surface-hover data-[active=true]:bg-accent-soft" data-active={form.iconKey === key}>{key}</button>)}</div></fieldset> : null}{form.visualType === "image" ? <label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.imageUrl}</span><input type="url" value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink" /></label> : null}<label className="flex items-center justify-between gap-4 text-sm font-medium text-ink"><span>{copy.visible}</span><button type="button" role="switch" aria-checked={form.enabled} onClick={() => setForm((current) => ({ ...current, enabled: !current.enabled }))} className="focus-ring rounded-md border border-border-strong px-3 py-2 text-sm font-semibold hover:bg-surface-hover">{form.enabled ? copy.visible : copy.hidden}</button></label><div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void saveCategory()} className="focus-ring min-h-10 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{saving ? "…" : copy.saveCategory}</button><button type="button" onClick={() => setEditing(null)} className="focus-ring min-h-10 rounded-md border border-border-strong px-3 text-sm font-semibold text-ink hover:bg-surface-hover">{copy.cancel}</button><button type="button" onClick={() => editing && void reset(editing)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink-muted hover:bg-surface-hover"><RotateCcw size={15} aria-hidden />{copy.reset}</button></div></> : <div className="grid gap-2">{available.map((category) => <div key={category.id} className="flex items-center gap-3 rounded-md border border-border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{category.name}</p><p className="text-xs text-ink-muted">{category.productCount} {copy.products}</p></div><button type="button" disabled={saving} onClick={() => void add(category)} className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-md border border-border-strong px-2.5 text-xs font-semibold text-ink hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} aria-hidden />{copy.add}</button></div>)}</div>}</FormSection>{message ? <p role="status" className="text-sm text-ink-muted">{message}</p> : null}</div>
    </div> : null}
    <ConfirmDialog open={Boolean(removing)} title={copy.removeTitle} description={copy.removeDescription} confirmLabel={copy.confirmRemove} tone="danger" pending={saving} onConfirm={() => void remove()} onCancel={() => setRemoving(null)} />
  </main></RequireAdminAuth>;
}
