import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { categories, optionGroups, options, products } from "@/db/schema";
import { OrderError, type PricedProduct } from "./pricing";
import { ownedStore } from "./stores";

const id = z.string().uuid();
const cents = z.number().int().min(0).max(100_000_00);

export const categoryInput = z
  .object({ storeId: id, name: z.string().trim().min(1, "Name is required").max(60) })
  .strict();
export const categoryIdInput = z.object({ storeId: id, categoryId: id }).strict();
export const moveInput = z
  .object({ storeId: id, itemId: id, direction: z.enum(["up", "down"]) })
  .strict();
export const newProductInput = z
  .object({ storeId: id, name: z.string().trim().min(1, "Name is required").max(120), priceCents: cents })
  .strict();
export const productIdInput = z.object({ storeId: id, productId: id }).strict();
export const updateProductInput = z
  .object({
    storeId: id,
    productId: id,
    name: z.string().trim().min(1, "Name is required").max(120),
    description: z.string().trim().max(2000),
    priceCents: cents,
    categoryId: id.nullable(),
    available: z.boolean(),
    trackStock: z.boolean(),
    stock: z.number().int().min(0).max(1_000_000),
  })
  .strict();
export const groupInput = z
  .object({
    storeId: id,
    productId: id,
    name: z.string().trim().min(1, "Name is required").max(60),
    kind: z.enum(["single", "multi"]),
    required: z.boolean(),
    maxSelect: z.number().int().min(1).max(50).nullable(),
  })
  .strict();
export const groupIdInput = z.object({ storeId: id, productId: id, groupId: id }).strict();
export const optionInput = z
  .object({
    storeId: id,
    productId: id,
    groupId: id,
    name: z.string().trim().min(1, "Name is required").max(60),
    priceDeltaCents: z.number().int().min(-100_000_00).max(100_000_00),
  })
  .strict();
export const optionIdInput = z
  .object({ storeId: id, productId: id, optionId: id })
  .strict();

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function listCatalog(userId: string, storeId: string) {
  const store = await ownedStore(userId, storeId);
  const [cats, prods] = await Promise.all([
    db.select().from(categories).where(eq(categories.storeId, storeId)).orderBy(asc(categories.position), asc(categories.name)),
    db.select().from(products).where(eq(products.storeId, storeId)).orderBy(asc(products.position), asc(products.createdAt)),
  ]);
  return { store, categories: cats, products: prods };
}

async function nextPosition(table: typeof categories | typeof products, storeId: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${table.position}), -1)` })
    .from(table)
    .where(eq(table.storeId, storeId));
  return (row?.max ?? -1) + 1;
}

export async function createCategory(userId: string, input: z.infer<typeof categoryInput>) {
  await ownedStore(userId, input.storeId);
  const position = await nextPosition(categories, input.storeId);
  await db.insert(categories).values({ id: crypto.randomUUID(), storeId: input.storeId, name: input.name, position });
  return { ok: true };
}

export async function deleteCategory(userId: string, input: z.infer<typeof categoryIdInput>) {
  await ownedStore(userId, input.storeId);
  await db.batch([
    db.update(products).set({ categoryId: null }).where(and(eq(products.storeId, input.storeId), eq(products.categoryId, input.categoryId))),
    db.delete(categories).where(and(eq(categories.id, input.categoryId), eq(categories.storeId, input.storeId))),
  ]);
  return { ok: true };
}

/** Swaps an item with its neighbour, renumbering the list so positions stay distinct. */
export async function move(userId: string, kind: "category" | "product", input: z.infer<typeof moveInput>) {
  await ownedStore(userId, input.storeId);
  const table = kind === "category" ? categories : products;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.storeId, input.storeId))
    .orderBy(asc(table.position), kind === "category" ? asc(categories.name) : asc(products.createdAt));
  const ids = rows.map((r) => r.id);
  const at = ids.indexOf(input.itemId);
  const to = input.direction === "up" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= ids.length) return { ok: true };
  [ids[at], ids[to]] = [ids[to]!, ids[at]!];
  const [first, ...rest] = ids.map((rowId, position) =>
    db.update(table).set({ position }).where(and(eq(table.id, rowId), eq(table.storeId, input.storeId))),
  );
  await db.batch([first!, ...rest]);
  return { ok: true };
}

export async function createProduct(userId: string, input: z.infer<typeof newProductInput>) {
  await ownedStore(userId, input.storeId);
  const productId = crypto.randomUUID();
  const position = await nextPosition(products, input.storeId);
  await db.insert(products).values({ id: productId, storeId: input.storeId, name: input.name, priceCents: input.priceCents, position });
  return { id: productId };
}

async function ownedProduct(userId: string, storeId: string, productId: string) {
  await ownedStore(userId, storeId).catch(() => {
    throw new OrderError("Product not found", 404);
  });
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)));
  if (!product) throw new OrderError("Product not found", 404);
  return product;
}

async function groupsFor(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, PricedProduct["groups"]>();
  const groups = await db
    .select()
    .from(optionGroups)
    .where(inArray(optionGroups.productId, productIds))
    .orderBy(asc(optionGroups.position));
  const opts = groups.length
    ? await db
        .select()
        .from(options)
        .where(inArray(options.groupId, groups.map((g) => g.id)))
        .orderBy(asc(options.position))
    : [];
  const byProduct = new Map<string, PricedProduct["groups"]>();
  for (const g of groups) {
    const list = byProduct.get(g.productId) ?? [];
    list.push({
      id: g.id,
      name: g.name,
      kind: g.kind,
      required: g.required,
      maxSelect: g.kind === "multi" ? g.maxSelect : null,
      options: opts
        .filter((o) => o.groupId === g.id)
        .map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents })),
    });
    byProduct.set(g.productId, list);
  }
  return byProduct;
}

export async function getProduct(userId: string, input: z.infer<typeof productIdInput>) {
  const product = await ownedProduct(userId, input.storeId, input.productId);
  const [store, groups, cats] = await Promise.all([
    ownedStore(userId, input.storeId),
    groupsFor([product.id]),
    db.select().from(categories).where(eq(categories.storeId, input.storeId)).orderBy(asc(categories.position)),
  ]);
  return { store, product, groups: groups.get(product.id) ?? [], categories: cats };
}

export async function updateProduct(userId: string, { storeId, productId, ...fields }: z.infer<typeof updateProductInput>) {
  await ownedProduct(userId, storeId, productId);
  if (fields.categoryId) {
    const [cat] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, fields.categoryId), eq(categories.storeId, storeId)));
    if (!cat) throw new OrderError("Category not found", 404);
  }
  await db.update(products).set(fields).where(and(eq(products.id, productId), eq(products.storeId, storeId)));
  return { ok: true };
}

export async function deleteProduct(userId: string, input: z.infer<typeof productIdInput>) {
  const product = await ownedProduct(userId, input.storeId, input.productId);
  await db.delete(products).where(and(eq(products.id, product.id), eq(products.storeId, input.storeId)));
  if (product.imageKey) await env.files.delete(product.imageKey);
  return { ok: true };
}

export async function setProductImage(userId: string, storeId: string, productId: string, file: File) {
  const product = await ownedProduct(userId, storeId, productId);
  if (!IMAGE_TYPES.includes(file.type)) throw new OrderError("Use a PNG, JPEG, WebP or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) throw new OrderError("Images can be up to 5 MB.");
  const key = `stores/${storeId}/products/${productId}/${crypto.randomUUID()}`;
  await env.files.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await db.update(products).set({ imageKey: key, imageType: file.type }).where(eq(products.id, productId));
  if (product.imageKey) await env.files.delete(product.imageKey);
  return { ok: true };
}

export async function removeProductImage(userId: string, input: z.infer<typeof productIdInput>) {
  const product = await ownedProduct(userId, input.storeId, input.productId);
  await db.update(products).set({ imageKey: null, imageType: null }).where(eq(products.id, product.id));
  if (product.imageKey) await env.files.delete(product.imageKey);
  return { ok: true };
}

export async function addGroup(userId: string, { storeId, productId, ...g }: z.infer<typeof groupInput>) {
  await ownedProduct(userId, storeId, productId);
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${optionGroups.position}), -1)` })
    .from(optionGroups)
    .where(eq(optionGroups.productId, productId));
  await db.insert(optionGroups).values({
    id: crypto.randomUUID(),
    productId,
    ...g,
    maxSelect: g.kind === "multi" ? g.maxSelect : null,
    position: (row?.max ?? -1) + 1,
  });
  return { ok: true };
}

export async function deleteGroup(userId: string, input: z.infer<typeof groupIdInput>) {
  await ownedProduct(userId, input.storeId, input.productId);
  await db.delete(optionGroups).where(and(eq(optionGroups.id, input.groupId), eq(optionGroups.productId, input.productId)));
  return { ok: true };
}

export async function addOption(userId: string, { storeId, productId, groupId, ...o }: z.infer<typeof optionInput>) {
  await ownedProduct(userId, storeId, productId);
  const [group] = await db.select({ id: optionGroups.id }).from(optionGroups).where(and(eq(optionGroups.id, groupId), eq(optionGroups.productId, productId)));
  if (!group) throw new OrderError("Option group not found", 404);
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${options.position}), -1)` })
    .from(options)
    .where(eq(options.groupId, groupId));
  await db.insert(options).values({ id: crypto.randomUUID(), groupId, ...o, position: (row?.max ?? -1) + 1 });
  return { ok: true };
}

export async function deleteOption(userId: string, input: z.infer<typeof optionIdInput>) {
  await ownedProduct(userId, input.storeId, input.productId);
  const groupIds = db.select({ id: optionGroups.id }).from(optionGroups).where(eq(optionGroups.productId, input.productId));
  await db.delete(options).where(and(eq(options.id, input.optionId), inArray(options.groupId, groupIds)));
  return { ok: true };
}

/** Every product of a store with its options, as the pricing rules read them. */
export async function pricingCatalog(storeId: string) {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.storeId, storeId))
    .orderBy(asc(products.position), asc(products.createdAt));
  const groups = await groupsFor(rows.map((r) => r.id));
  return rows.map((p) => ({
    ...p,
    groups: groups.get(p.id) ?? [],
  }));
}
