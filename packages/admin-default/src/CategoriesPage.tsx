"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { ArrowDown, ArrowUp, Check, FolderTree, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { RequireAdminAuth } from "./RequireAdminAuth";
import { useAdminConfig } from "./AetherAdminProvider";
import { useAdminLanguage } from "./AdminLanguageProvider";

type Category = { id: string; slug: string; name: string; isHidden: boolean; isSystem: boolean; productCount: number; sortOrder: number };

export function CategoriesPage() {
  const { apiBaseUrl } = useAdminConfig();
  const { locale } = useAdminLanguage();
  const { getToken } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const copy = locale === "es"
    ? { title: "Categorías", description: "Organiza el catálogo de esta tienda. Los paquetes solo aportan una plantilla inicial.", add: "Agregar categoría", name: "Nombre", slug: "Slug opcional", hidden: "Oculta", visible: "Visible", products: "productos", empty: "Aún no hay categorías", emptyDescription: "Agrega la primera categoría para comenzar el catálogo.", remove: "Eliminar", edit: "Editar", saveEdit: "Guardar edición", cancelEdit: "Cancelar edición", moveUp: "Subir categoría", moveDown: "Bajar categoría", deleteTitle: "¿Eliminar esta categoría?", deleteDescription: "Los productos deben reasignarse a otra categoría antes de eliminarla.", confirmDelete: "Eliminar", saved: "Categoría guardada." }
    : { title: "Categories", description: "Organize this store's catalog. Packages only provide an initial template.", add: "Add category", name: "Name", slug: "Optional slug", hidden: "Hidden", visible: "Visible", products: "products", empty: "No categories yet", emptyDescription: "Add the first category to start building the catalog.", remove: "Delete", edit: "Edit", saveEdit: "Save edit", cancelEdit: "Cancel edit", moveUp: "Move category up", moveDown: "Move category down", deleteTitle: "Delete this category?", deleteDescription: "Products must be reassigned to another category before deletion.", confirmDelete: "Delete", saved: "Category saved." };

  const authHeaders = useCallback(async () => {
    const token = await getToken().catch(() => null);
    return token ? { authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/categories`, { headers: await authHeaders() });
      const payload = (await response.json()) as { success: boolean; data?: Category[] };
      if (!payload.success || !payload.data) throw new Error("load failed");
      setCategories(payload.data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [apiBaseUrl, authHeaders]);

  useEffect(() => { void load(); }, [load]);

  async function createCategory() {
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/categories`, { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ name, slug: slug || undefined }) });
      const payload = (await response.json()) as { success: boolean; data?: Category };
      if (!payload.success || !payload.data) throw new Error("save failed");
      setCategories((current) => [...current, payload.data as Category]);
      setName("");
      setSlug("");
      setMessage(copy.saved);
    } catch {
      setMessage(locale === "es" ? "No se pudo guardar la categoría." : "Could not save the category.");
    } finally { setSaving(false); }
  }

  async function toggle(category: Category) {
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/categories/${category.id}`, { method: "PATCH", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ isHidden: !category.isHidden }) });
    const payload = (await response.json()) as { success: boolean; data?: Category };
    if (payload.success && payload.data) setCategories((current) => current.map((item) => item.id === category.id ? payload.data as Category : item));
  }

  async function saveEdit() {
    if (!editing || !editName.trim()) return;
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/categories/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ name: editName.trim() }) });
    const payload = (await response.json()) as { success: boolean; data?: Category };
    if (payload.success && payload.data) setCategories((current) => current.map((item) => item.id === editing.id ? payload.data as Category : item));
    setEditing(null);
  }

  async function move(category: Category, direction: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[next]] = [reordered[next] as Category, reordered[index] as Category];
    setCategories(reordered);
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/categories/reorder`, { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ ids: reordered.map((item) => item.id) }) });
    if (!response.ok) await load();
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/categories/${deleting.id}`, { method: "DELETE", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({}) });
    if (response.ok) setCategories((current) => current.filter((item) => item.id !== deleting.id));
    setDeleting(null);
    setSaving(false);
  }

  return <RequireAdminAuth>
    <main id="main-content" className="admin-shell py-8">
      <PageHeader title={copy.title} description={copy.description} secondaryActions={<a href="/categories/storefront/" className="focus-ring inline-flex min-h-10 items-center rounded-md border border-border-strong px-3 text-sm font-semibold text-ink hover:bg-surface-hover">{locale === "es" ? "Categorías destacadas" : "Featured categories"}</a>} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-lg border border-border bg-surface">
          {status === "loading" ? <p className="p-6 text-sm text-ink-muted">Loading...</p> : status === "error" ? <ErrorState title="Could not load categories" action={<button type="button" onClick={() => void load()} className="focus-ring rounded-md border border-border-strong px-3 py-2 text-sm font-semibold">Retry</button>} /> : categories.length === 0 ? <EmptyState icon={FolderTree} title={copy.empty} description={copy.emptyDescription} /> : <div className="divide-y divide-border">
            {categories.map((category, index) => <div key={category.id} className="flex items-center gap-3 p-4">
              <GripVertical size={16} className="text-ink-subtle" aria-hidden />
              <div className="min-w-0 flex-1">{editing?.id === category.id ? <div className="flex gap-2"><input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label={copy.name} className="focus-ring min-h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-ink" /><button type="button" onClick={() => void saveEdit()} aria-label={copy.saveEdit} className="focus-ring rounded-md p-2 text-success hover:bg-success/10"><Check size={16} aria-hidden /></button><button type="button" onClick={() => setEditing(null)} aria-label={copy.cancelEdit} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover"><X size={16} aria-hidden /></button></div> : <p className="font-semibold text-ink">{category.name}</p>}<p className="text-xs text-ink-muted">{category.slug} · {category.productCount} {copy.products}</p></div>
              <div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={() => void move(category, -1)} aria-label={copy.moveUp} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-30"><ArrowUp size={15} aria-hidden /></button><button type="button" disabled={index === categories.length - 1} onClick={() => void move(category, 1)} aria-label={copy.moveDown} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-30"><ArrowDown size={15} aria-hidden /></button></div>
              {!category.isSystem && editing?.id !== category.id ? <button type="button" onClick={() => { setEditing(category); setEditName(category.name); }} aria-label={`${copy.edit} ${category.name}`} className="focus-ring rounded-md p-2 text-ink-muted hover:bg-surface-hover"><Pencil size={16} aria-hidden /></button> : null}
              <button type="button" onClick={() => void toggle(category)} className="focus-ring rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover">{category.isHidden ? copy.hidden : copy.visible}</button>
              {!category.isSystem ? <button type="button" onClick={() => setDeleting(category)} aria-label={`${copy.remove} ${category.name}`} className="focus-ring rounded-md p-2 text-danger hover:bg-danger/10"><Trash2 size={16} aria-hidden /></button> : null}
            </div>)}
          </div>}
        </section>
        <FormSection title={copy.add}>
          <label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.name}</span><input value={name} onChange={(event) => setName(event.target.value)} className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink" /></label>
          <label className="grid gap-1 text-sm"><span className="font-medium text-ink-muted">{copy.slug}</span><input value={slug} onChange={(event) => setSlug(event.target.value)} className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink" /></label>
          <button type="button" disabled={saving || !name.trim()} onClick={() => void createCategory()} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} aria-hidden />{saving ? "..." : copy.add}</button>
          {message ? <p role="status" className="text-sm text-ink-muted">{message}</p> : null}
        </FormSection>
      </div>
      <ConfirmDialog open={Boolean(deleting)} title={copy.deleteTitle} description={copy.deleteDescription} confirmLabel={copy.confirmDelete} tone="danger" pending={saving} onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
    </main>
  </RequireAdminAuth>;
}
