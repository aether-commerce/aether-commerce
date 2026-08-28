import type { CategoryMerchandisingWrite, CategorySectionUpdate } from "@aether-commerce/schemas";
import type { Env } from "../types";
import { getStoreId } from "./store-categories";

type SectionRow = {
  store_id: string;
  enabled: number;
  eyebrow: string | null;
  title: string | null;
  description: string | null;
};

type ConfigRow = {
  id: string;
  store_id: string;
  category_id: string;
  enabled: number;
  position: number;
  display_name: string | null;
  description: string | null;
  visual_type: "icon" | "image" | "none";
  icon_key: string | null;
  image_url: string | null;
  slug: string;
  name: string;
  is_hidden: number;
  product_count: number;
};

export type StorefrontCategorySection = {
  section: { enabled: boolean; eyebrow: string | null; title: string | null; description: string | null };
  categories: Array<{
    id: string;
    slug: string;
    displayName: string;
    description: string | null;
    visual: { type: "icon"; key: string } | { type: "image"; url: string } | { type: "none" };
    productCount: number;
  }>;
};

export type AdminCategoryMerchandising = {
  id: string;
  slug: string;
  name: string;
  isHidden: boolean;
  productCount: number;
  config: null | {
    id: string;
    enabled: boolean;
    position: number;
    displayName: string | null;
    description: string | null;
    visualType: "icon" | "image" | "none";
    iconKey: string | null;
    imageUrl: string | null;
  };
};

const emptySection: StorefrontCategorySection["section"] = { enabled: false, eyebrow: null, title: null, description: null };

function sectionFromRow(row: SectionRow | null): StorefrontCategorySection["section"] {
  return row ? { enabled: Boolean(row.enabled), eyebrow: row.eyebrow, title: row.title, description: row.description } : emptySection;
}

function visualFromRow(row: Pick<ConfigRow, "visual_type" | "icon_key" | "image_url">): StorefrontCategorySection["categories"][number]["visual"] {
  if (row.visual_type === "image" && row.image_url) return { type: "image", url: row.image_url };
  if (row.visual_type === "none") return { type: "none" };
  return { type: "icon", key: row.icon_key || "sparkles" };
}

async function readSection(env: Env, storeId: string) {
  return env.DB.prepare("select store_id, enabled, eyebrow, title, description from storefront_category_sections where store_id = ?")
    .bind(storeId)
    .first<SectionRow>();
}

const configSelect = `select m.id, m.store_id, m.category_id, m.enabled, m.position, m.display_name, m.description, m.visual_type, m.icon_key, m.image_url,
  c.slug, c.name, c.is_hidden, count(p.id) as product_count
  from storefront_category_configs m
  join store_categories c on c.id = m.category_id and c.store_id = m.store_id
  left join products p on p.store_category_id = c.id and p.store_id = c.store_id and p.visibility = 'visible'`;

/** Public, theme-neutral DTO. It uses one grouped query for all selected categories and public product counts. */
export async function getStorefrontCategorySection(env: Env): Promise<StorefrontCategorySection> {
  const storeId = getStoreId(env);
  const [sectionRow, configs] = await Promise.all([
    readSection(env, storeId),
    env.DB.prepare(`${configSelect} where m.store_id = ? and m.enabled = 1 and c.is_hidden = 0 group by m.id order by m.position asc, c.name collate nocase asc`)
      .bind(storeId)
      .all<ConfigRow>()
  ]);
  const section = sectionFromRow(sectionRow);
  if (!section.enabled) return { section, categories: [] };
  return {
    section,
    categories: (configs.results ?? []).map((row) => ({
      id: row.category_id,
      slug: row.slug,
      displayName: row.display_name || row.name,
      description: row.description,
      visual: visualFromRow(row),
      productCount: Number(row.product_count) || 0
    }))
  };
}

/** Admin view deliberately includes unselected and catalog-hidden categories so merchandising can be managed without duplicating catalog data. */
export async function getAdminStorefrontCategoryMerchandising(env: Env) {
  const storeId = getStoreId(env);
  const [sectionRow, rows] = await Promise.all([
    readSection(env, storeId),
    env.DB.prepare(`select c.id as category_id, c.slug, c.name, c.is_hidden, count(p.id) as product_count,
      m.id, m.store_id, m.enabled, m.position, m.display_name, m.description, m.visual_type, m.icon_key, m.image_url
      from store_categories c
      left join storefront_category_configs m on m.category_id = c.id and m.store_id = c.store_id
      left join products p on p.store_category_id = c.id and p.store_id = c.store_id and p.visibility = 'visible'
      where c.store_id = ?
      group by c.id
      order by case when m.id is null then 1 else 0 end, m.position asc, c.sort_order asc, c.name collate nocase asc`)
      .bind(storeId)
      .all<ConfigRow>()
  ]);
  const categories: AdminCategoryMerchandising[] = (rows.results ?? []).map((row) => ({
    id: row.category_id,
    slug: row.slug,
    name: row.name,
    isHidden: Boolean(row.is_hidden),
    productCount: Number(row.product_count) || 0,
    config: row.id
      ? { id: row.id, enabled: Boolean(row.enabled), position: row.position, displayName: row.display_name, description: row.description, visualType: row.visual_type, iconKey: row.icon_key, imageUrl: row.image_url }
      : null
  }));
  return { section: sectionFromRow(sectionRow), categories };
}

export async function updateStorefrontCategorySection(env: Env, input: CategorySectionUpdate) {
  const storeId = getStoreId(env);
  const existing = await readSection(env, storeId);
  const next = {
    enabled: input.enabled ?? Boolean(existing?.enabled ?? 1),
    eyebrow: input.eyebrow === undefined ? existing?.eyebrow ?? null : input.eyebrow,
    title: input.title === undefined ? existing?.title ?? null : input.title,
    description: input.description === undefined ? existing?.description ?? null : input.description
  };
  await env.DB.prepare(`insert into storefront_category_sections (store_id, enabled, eyebrow, title, description, created_at, updated_at)
    values (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    on conflict(store_id) do update set enabled = excluded.enabled, eyebrow = excluded.eyebrow, title = excluded.title, description = excluded.description, updated_at = CURRENT_TIMESTAMP`)
    .bind(storeId, next.enabled ? 1 : 0, next.eyebrow, next.title, next.description)
    .run();
  return { enabled: next.enabled, eyebrow: next.eyebrow, title: next.title, description: next.description };
}

async function getConfig(env: Env, categoryId: string, storeId = getStoreId(env)) {
  return env.DB.prepare(`${configSelect} where m.store_id = ? and m.category_id = ? group by m.id`).bind(storeId, categoryId).first<ConfigRow>();
}

function configForAdmin(row: ConfigRow) {
  return { id: row.id, enabled: Boolean(row.enabled), position: row.position, displayName: row.display_name, description: row.description, visualType: row.visual_type, iconKey: row.icon_key, imageUrl: row.image_url };
}

export async function addStorefrontCategory(env: Env, categoryId: string, input: CategoryMerchandisingWrite = {}) {
  const storeId = getStoreId(env);
  const category = await env.DB.prepare("select id from store_categories where id = ? and store_id = ?").bind(categoryId, storeId).first<{ id: string }>();
  if (!category) return null;
  const existing = await getConfig(env, categoryId, storeId);
  if (existing) return configForAdmin(existing);
  const last = await env.DB.prepare("select coalesce(max(position), -1) as value from storefront_category_configs where store_id = ?").bind(storeId).first<{ value: number }>();
  const visualType = input.visualType ?? "icon";
  const iconKey = visualType === "icon" ? input.iconKey ?? "sparkles" : null;
  const imageUrl = visualType === "image" ? input.imageUrl ?? null : null;
  await env.DB.prepare(`insert into storefront_category_configs (id, store_id, category_id, enabled, position, display_name, description, visual_type, icon_key, image_url, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
    .bind(`scfg_${crypto.randomUUID()}`, storeId, categoryId, input.enabled === false ? 0 : 1, Number(last?.value ?? -1) + 1, input.displayName ?? null, input.description ?? null, visualType, iconKey, imageUrl)
    .run();
  return configForAdmin((await getConfig(env, categoryId, storeId))!);
}

export async function updateStorefrontCategory(env: Env, categoryId: string, input: CategoryMerchandisingWrite) {
  const storeId = getStoreId(env);
  const existing = await getConfig(env, categoryId, storeId);
  if (!existing) return null;
  const visualType = input.visualType ?? existing.visual_type;
  const iconKey = visualType === "icon" ? (input.iconKey === undefined ? existing.icon_key || "sparkles" : input.iconKey) : null;
  const imageUrl = visualType === "image" ? (input.imageUrl === undefined ? existing.image_url : input.imageUrl) : null;
  await env.DB.prepare(`update storefront_category_configs set enabled = ?, display_name = ?, description = ?, visual_type = ?, icon_key = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
    where store_id = ? and category_id = ?`)
    .bind(input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0, input.displayName === undefined ? existing.display_name : input.displayName, input.description === undefined ? existing.description : input.description, visualType, iconKey, imageUrl, storeId, categoryId)
    .run();
  return configForAdmin((await getConfig(env, categoryId, storeId))!);
}

export async function resetStorefrontCategory(env: Env, categoryId: string) {
  const storeId = getStoreId(env);
  const existing = await getConfig(env, categoryId, storeId);
  if (!existing) return null;
  await env.DB.prepare(`update storefront_category_configs set enabled = 1, display_name = null, description = null, visual_type = 'icon', icon_key = 'sparkles', image_url = null, updated_at = CURRENT_TIMESTAMP
    where store_id = ? and category_id = ?`).bind(storeId, categoryId).run();
  return configForAdmin((await getConfig(env, categoryId, storeId))!);
}

export async function reorderStorefrontCategories(env: Env, categoryIds: string[]) {
  const storeId = getStoreId(env);
  const rows = await env.DB.prepare("select category_id from storefront_category_configs where store_id = ? order by position asc").bind(storeId).all<{ category_id: string }>();
  const currentIds = (rows.results ?? []).map((row) => row.category_id);
  if (categoryIds.length !== currentIds.length || new Set(categoryIds).size !== categoryIds.length || categoryIds.some((id) => !currentIds.includes(id))) return false;
  await env.DB.batch(categoryIds.map((categoryId, position) => env.DB.prepare("update storefront_category_configs set position = ?, updated_at = CURRENT_TIMESTAMP where store_id = ? and category_id = ?").bind(position, storeId, categoryId)));
  return true;
}

export async function removeStorefrontCategory(env: Env, categoryId: string) {
  const result = await env.DB.prepare("delete from storefront_category_configs where store_id = ? and category_id = ?").bind(getStoreId(env), categoryId).run();
  return result.meta.changes > 0;
}
