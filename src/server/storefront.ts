// What anyone with a store's link may read. Nothing about the owner, other
// orders or hidden products leaves here.
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paymentMethods, stores } from "@/db/schema";
import { pricingCatalog } from "./catalog";

export async function publishedStore(slug: string) {
  const [store] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.slug, slug), eq(stores.published, true)));
  return store ?? null;
}

export async function storefront(slug: string) {
  const store = await publishedStore(slug);
  if (!store) return null;
  const [cats, catalog, methods] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.position), asc(categories.name)),
    pricingCatalog(store.id),
    db.select().from(paymentMethods).where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.enabled, true))).orderBy(asc(paymentMethods.kind)),
  ]);
  return {
    store: {
      name: store.name,
      slug: store.slug,
      description: store.description,
      currency: store.currency,
      phone: store.phone,
      isOpen: store.isOpen,
      pickupEnabled: store.pickupEnabled,
      deliveryEnabled: store.deliveryEnabled,
      deliveryFeeCents: store.deliveryFeeCents,
      taxBps: store.taxBps,
    },
    categories: cats,
    products: catalog
      .filter((p) => p.available)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        categoryId: p.categoryId,
        soldOut: p.trackStock && p.stock <= 0,
        stockLeft: p.trackStock ? p.stock : null,
        imageUrl: p.imageKey ? `/s/${store.slug}/img/${p.id}?v=${p.imageKey.slice(-8)}` : null,
        groups: p.groups,
      })),
    paymentMethods: methods.map((m) => ({
      id: m.id,
      kind: m.kind,
      label: m.label,
      instructions: m.instructions,
      requireProof: m.requireProof,
    })),
  };
}

export type Storefront = NonNullable<Awaited<ReturnType<typeof storefront>>>;
