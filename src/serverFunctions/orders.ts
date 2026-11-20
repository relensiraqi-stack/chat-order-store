import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { pricingCatalog } from "@/server/catalog";
import * as orders from "@/server/orders";
import { listMethods, ownedStore } from "@/server/stores";

export const getOrders = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => orders.listOrdersInput.parse(data))
  .handler(({ data, context: { user } }) => orders.listOrders(user.id, data));

export const getOrder = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => orders.orderIdInput.parse(data))
  .handler(({ data, context: { user } }) => orders.getOrder(user.id, data));

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => orders.setStatusInput.parse(data))
  .handler(({ data, context: { user } }) => orders.setStatus(user.id, data));

export const setPaymentStatus = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => orders.paymentInput.parse(data))
  .handler(({ data, context: { user } }) => orders.setPayment(user.id, data));

const storeOnly = z.object({ storeId: z.string().uuid() }).strict();

/** The store's whole catalog and methods, for entering an order by hand. */
export const getCounterCatalog = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => storeOnly.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const store = await ownedStore(user.id, data.storeId);
    const [catalog, methods] = await Promise.all([
      pricingCatalog(store.id),
      listMethods(store.id),
    ]);
    return { store, products: catalog, methods: methods.filter((m) => m.enabled) };
  });

export const quoteCounterOrder = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => orders.quoteInput.extend(storeOnly.shape).strict().parse(data))
  .handler(async ({ data: { storeId, ...input }, context: { user } }) => {
    const store = await ownedStore(user.id, storeId);
    const q = await orders.quote(store, input);
    return publicQuote(q);
  });

export const createCounterOrder = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => orders.checkoutInput.extend(storeOnly.shape).strict().parse(data))
  .handler(async ({ data: { storeId, ...input }, context: { user } }) => {
    const store = await ownedStore(user.id, storeId);
    const placed = await orders.placeOrder(store, input, "manual");
    return { id: placed.id, number: placed.number };
  });

export function publicQuote(q: Awaited<ReturnType<typeof orders.quote>>) {
  return {
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    feeCents: q.feeCents,
    taxCents: q.taxCents,
    totalCents: q.totalCents,
    promoCode: q.promo?.code ?? null,
  };
}
