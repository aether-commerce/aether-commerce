import type { Env } from "../types";
import { slugify } from "./products-admin";
import { clearCatalogCache } from "./catalog";

export type StoreCategory = {
  id: string;
  storeId: string;
  slug: string;
  name: string;
  sortOrder: number;
  isHidden: boolean;
  isSystem: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

type StoreCategoryRow = {
  id: string;
  store_id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_hidden: number;
  is_system: number;
  product_count: number;
  created_at: string;
  updated_at: string;
};

export type StoreCategoryInput = { name: string; slug?: string | undefined; isHidden?: boolean | undefined };
export type StoreCategoryPatch = { name?: string | undefined; slug?: string | undefined; isHidden?: boolean | undefined };

/** The reference deployment uses store_default; clients can select a store through a binding. */
export function getStoreId(env: Env) {
  return env.STORE_ID?.trim() || "store_default";
}

function toCategory(row: StoreCategoryRow): StoreCategory {
  return {
    id: row.id,
    storeId: row.store_id,
    slug: row.slug,
    name: row.name,
    sortOrder: row.sort_order,
    isHidden: Boolean(row.is_hidden),
    isSystem: Boolean(row.is_system),
    productCount: row.product_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const categorySelect = `select c.id, c.store_id, c.slug, c.name, c.sort_order, c.is_hidden, c.is_system,
  count(p.id) as product_count, c.created_at, c.updated_at
  from store_categories c left join products p on p.store_category_id = c.id and p.store_id = c.store_id`;

export async function listStoreCategories(env: Env, includeHidden = true, storeId = getStoreId(env)): Promise<StoreCategory[]> {
  const where = includeHidden ? "where c.store_id = ?" : "where c.store_id = ? and c.is_hidden = 0";
  const rows = await env.DB.prepare(`${categorySelect} ${where} group by c.id order by c.sort_order asc, c.name collate nocase asc`)
    .bind(storeId)
    .all<StoreCategoryRow>();
  return (rows.results ?? []).map(toCategory);
}

async function slugIsAvailable(env: Env, storeId: string, slug: string, exceptId?: string) {
  const row = await env.DB.prepare("select id from store_categories where store_id = ? and slug = ?").bind(storeId, slug).first<{ id: string }>();
  return !row || row.id === exceptId;
}

async function uniqueCategorySlug(env: Env, storeId: string, desired: string, exceptId?: string) {
  const root = slugify(desired) || "categoria";
  let candidate = root;
  let suffix = 2;
  while (!(await slugIsAvailable(env, storeId, candidate, exceptId))) candidate = `${root}-${suffix++}`;
  return candidate;
}

export async function createStoreCategory(env: Env, input: StoreCategoryInput, storeId = getStoreId(env)): Promise<StoreCategory> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");
  const slug = await uniqueCategorySlug(env, storeId, input.slug || name);
  const id = `cat_${crypto.randomUUID()}`;
  const last = await env.DB.prepare("select coalesce(max(sort_order), 0) as value from store_categories where store_id = ?").bind(storeId).first<{ value: number }>();
  await env.DB.prepare(
    "insert into store_categories (id, store_id, slug, name, sort_order, is_hidden, is_system, created_at, updated_at) values (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
  )
    .bind(id, storeId, slug, name, (last?.value ?? 0) + 1, input.isHidden ? 1 : 0)
    .run();
  return (await getStoreCategory(env, id, storeId))!;
}

export async function getStoreCategory(env: Env, id: string, storeId = getStoreId(env)): Promise<StoreCategory | null> {
  const row = await env.DB.prepare(`${categorySelect} where c.id = ? and c.store_id = ? group by c.id`).bind(id, storeId).first<StoreCategoryRow>();
  return row ? toCategory(row) : null;
}

export async function updateStoreCategory(env: Env, id: string, input: StoreCategoryPatch, storeId = getStoreId(env)): Promise<StoreCategory | null> {
  const existing = await getStoreCategory(env, id, storeId);
  if (!existing) return null;
  const name = input.name?.trim() || existing.name;
  const slug = input.slug === undefined ? existing.slug : await uniqueCategorySlug(env, storeId, input.slug || name, id);
  await env.DB.prepare(
    "update store_categories set name = ?, slug = ?, is_hidden = ?, updated_at = CURRENT_TIMESTAMP where id = ? and store_id = ?"
  )
    .bind(name, slug, input.isHidden === undefined ? (existing.isHidden ? 1 : 0) : input.isHidden ? 1 : 0, id, storeId)
    .run();
  await env.DB.prepare("update products set category = ? where store_category_id = ? and store_id = ?").bind(slug, id, storeId).run();
  await clearCatalogCache(env);
  return getStoreCategory(env, id, storeId);
}

export async function reorderStoreCategories(env: Env, ids: string[], storeId = getStoreId(env)) {
  const categories = await listStoreCategories(env, true, storeId);
  if (ids.length !== categories.length || new Set(ids).size !== ids.length || ids.some((id) => !categories.some((category) => category.id === id))) return false;
  await env.DB.batch(ids.map((id, index) => env.DB.prepare("update store_categories set sort_order = ?, updated_at = CURRENT_TIMESTAMP where id = ? and store_id = ?").bind(index, id, storeId)));
  await clearCatalogCache(env);
  return true;
}

export async function deleteStoreCategory(env: Env, id: string, reassignToId?: string, storeId = getStoreId(env)): Promise<"deleted" | "has_products" | "not_found" | "invalid_target" | "system"> {
  const category = await getStoreCategory(env, id, storeId);
  if (!category) return "not_found";
  if (category.isSystem) return "system";
  if (category.productCount > 0) {
    const target = reassignToId ? await getStoreCategory(env, reassignToId, storeId) : null;
    if (!target || target.id === id) return reassignToId ? "invalid_target" : "has_products";
    await env.DB.prepare("update products set store_category_id = ?, category = ? where store_category_id = ? and store_id = ?").bind(target.id, target.slug, id, storeId).run();
  }
  await env.DB.prepare("delete from store_categories where id = ? and store_id = ?").bind(id, storeId).run();
  await clearCatalogCache(env);
  return "deleted";
}

export type StoreProvisioningInput = { storeId: string; storeName: string; packageId?: string | null | undefined };

/** Creates a store and copies package categories as mutable store-owned rows. */
export async function createStoreFromPackage(env: Env, input: StoreProvisioningInput) {
  const packageId = input.packageId ?? null;
  const storeId = input.storeId.trim();
  if (!storeId || !input.storeName.trim()) throw new Error("Store id and name are required.");
  const existing = await env.DB.prepare("select id from stores where id = ?").bind(storeId).first<{ id: string }>();
  if (existing) throw new Error("Store already exists.");
  const categories = packageId
    ? await env.DB.prepare("select id, slug, name, sort_order, is_hidden, is_system from package_categories where package_id = ? order by sort_order asc, name collate nocase asc")
        .bind(packageId)
        .all<{ id: string; slug: string; name: string; sort_order: number; is_hidden: number; is_system: number }>()
    : { results: [] as Array<{ id: string; slug: string; name: string; sort_order: number; is_hidden: number; is_system: number }> };
  await env.DB.batch([
    env.DB.prepare("insert into stores (id, package_id, name) values (?, ?, ?)").bind(storeId, packageId, input.storeName.trim()),
    ...((categories.results ?? []).map((category) =>
      env.DB.prepare("insert into store_categories (id, store_id, slug, name, sort_order, is_hidden, is_system) values (?, ?, ?, ?, ?, ?, ?)")
        .bind(`cat_${storeId}_${category.id}`, storeId, category.slug, category.name, category.sort_order, category.is_hidden, category.is_system)
    )),
    ...((categories.results ?? []).length === 0
      ? [env.DB.prepare("insert into store_categories (id, store_id, slug, name, sort_order, is_hidden, is_system) values (?, ?, 'sin-categoria', 'Sin categoría', 0, 0, 1)").bind(`cat_${storeId}_uncategorized`, storeId)]
      : [])
  ]);
  return { storeId, packageId, categoryCount: categories.results?.length || 1 };
}
