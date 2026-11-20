import { and, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  orderItems,
  orders,
  paymentMethods,
  products,
  promos,
  stores,
} from "@/db/schema";
import { pricingCatalog } from "./catalog";
import { OrderError, priceLines, promoDiscount, totals } from "./pricing";
import { ownedStore, type Store } from "./stores";

const id = z.string().uuid();
const lineSchema = z
  .object({
    productId: id,
    quantity: z.number().int().min(1).max(99),
    optionIds: z.array(id).max(30),
  })
  .strict();

export const quoteInput = z
  .object({
    items: z.array(lineSchema).max(50),
    service: z.enum(["pickup", "delivery"]),
    promoCode: z.string().trim().max(32).optional().default(""),
  })
  .strict();

export const checkoutInput = z
  .object({
    customerName: z.string().trim().min(1, "Enter your name").max(80),
    customerPhone: z.string().trim().min(3, "Enter a phone number").max(32),
    service: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(300).optional().default(""),
    scheduledFor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time"),
    note: z.string().trim().max(500).optional().default(""),
    paymentMethodId: id,
    promoCode: z.string().trim().max(32).optional().default(""),
    items: z.array(lineSchema).min(1, "The cart is empty").max(50),
  })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutInput>;
export type QuoteInput = z.infer<typeof quoteInput>;

async function promoFor(storeId: string, code: string) {
  const [promo] = await db
    .select()
    .from(promos)
    .where(and(eq(promos.storeId, storeId), eq(promos.code, code.toUpperCase())));
  return promo;
}

/** What an order would cost, by the same rules checkout applies. */
export async function quote(store: Store, input: QuoteInput, now = new Date()) {
  const catalog = new Map((await pricingCatalog(store.id)).map((p) => [p.id, p]));
  const priced = priceLines(catalog, input.items);
  let discountCents = 0;
  let promo: Awaited<ReturnType<typeof promoFor>> | undefined;
  if (input.promoCode) {
    promo = await promoFor(store.id, input.promoCode);
    discountCents = promoDiscount(promo, priced.subtotalCents, now);
  }
  const feeCents = input.service === "delivery" ? store.deliveryFeeCents : 0;
  return {
    lines: priced.lines,
    promo,
    ...totals({ subtotalCents: priced.subtotalCents, discountCents, feeCents, taxBps: store.taxBps }),
  };
}

export async function placeOrder(
  store: Store,
  input: CheckoutInput,
  source: "online" | "manual",
) {
  if (source === "online" && !store.isOpen)
    throw new OrderError("This store isn't taking orders right now.", 409);
  if (input.service === "pickup" && !store.pickupEnabled)
    throw new OrderError("Pickup isn't offered.", 409);
  if (input.service === "delivery" && !store.deliveryEnabled)
    throw new OrderError("Delivery isn't offered.", 409);
  if (input.service === "delivery" && !input.address)
    throw new OrderError("Enter a delivery address.");
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, input.paymentMethodId), eq(paymentMethods.storeId, store.id), eq(paymentMethods.enabled, true)));
  if (!method) throw new OrderError("Choose a payment method.", 409);

  const q = await quote(store, input);
  const orderId = crypto.randomUUID();
  const token = randomToken();
  const tracked = new Map<string, number>();
  for (const line of q.lines)
    if (line.stockTracked)
      tracked.set(line.productId, (tracked.get(line.productId) ?? 0) + line.quantity);

  try {
    await db.batch([
      db.update(stores).set({ nextOrderNo: sql`${stores.nextOrderNo} + 1` }).where(eq(stores.id, store.id)),
      db.insert(orders).values({
        id: orderId,
        storeId: store.id,
        number: sql`(select ${stores.nextOrderNo} - 1 from ${stores} where ${stores.id} = ${store.id})`,
        token,
        source,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        service: input.service,
        address: input.service === "delivery" ? input.address : "",
        scheduledFor: input.scheduledFor,
        note: input.note,
        paymentMethodId: method.id,
        paymentKind: method.kind,
        paymentLabel: method.label,
        paymentInstructions: method.instructions,
        requireProof: method.requireProof,
        currency: store.currency,
        subtotalCents: q.subtotalCents,
        feeCents: q.feeCents,
        discountCents: q.discountCents,
        taxCents: q.taxCents,
        totalCents: q.totalCents,
        promoId: q.promo?.id ?? null,
        promoCode: q.promo?.code ?? null,
      }),
      db.insert(orderItems).values(
        q.lines.map((line, position) => ({
          id: crypto.randomUUID(),
          orderId,
          productId: line.productId,
          name: line.name,
          optionsText: JSON.stringify(line.options),
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents,
          stockTracked: line.stockTracked,
          position,
        })),
      ),
      ...[...tracked].map(([productId, quantity]) =>
        db
          .update(products)
          .set({ stock: sql`${products.stock} - ${quantity}` })
          .where(and(eq(products.id, productId), eq(products.trackStock, true))),
      ),
      ...(q.promo
        ? [db.update(promos).set({ uses: sql`${promos.uses} + 1` }).where(eq(promos.id, q.promo.id))]
        : []),
    ]);
  } catch (error) {
    const text = String(error instanceof Error ? (error.cause ?? error.message) : error);
    if (text.includes("products_stock_nonnegative") || /CHECK/i.test(text) && text.includes("stock"))
      throw new OrderError("An item just sold out. Check stock and try again.", 409);
    if (text.includes("promos_uses_within_limit"))
      throw new OrderError("That promo code has been used up.", 409);
    throw error;
  }
  const [row] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, orderId));
  return { id: orderId, number: row!.number, token };
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

type OrderRow = typeof orders.$inferSelect;

async function withItems(order: OrderRow) {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.position);
  return {
    items: items.map((i) => ({
      name: i.name,
      options: JSON.parse(i.optionsText) as string[],
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.lineTotalCents,
    })),
  };
}

/** The fields a customer and the owner both see. */
function receipt(order: OrderRow, store: Pick<Store, "name" | "slug" | "phone">) {
  return {
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    service: order.service,
    address: order.address,
    scheduledFor: order.scheduledFor,
    note: order.note,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    feeCents: order.feeCents,
    discountCents: order.discountCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    promoCode: order.promoCode,
    payment: {
      kind: order.paymentKind,
      label: order.paymentLabel,
      instructions: order.paymentInstructions,
      requireProof: order.requireProof,
    },
    createdAt: order.createdAt,
    store: { name: store.name, slug: store.slug, phone: store.phone },
  };
}

export async function publicOrder(slug: string, token: string) {
  const found = await orderByToken(slug, token);
  if (!found) return null;
  return { ...receipt(found.order, found.store), ...(await withItems(found.order)) };
}

async function orderByToken(slug: string, token: string) {
  const [row] = await db
    .select({ order: orders, store: stores })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(and(eq(orders.token, token), eq(stores.slug, slug)));
  return row ?? null;
}

const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export async function submitProof(slug: string, token: string, file: File) {
  const found = await orderByToken(slug, token);
  if (!found) throw new OrderError("Order not found", 404);
  const { order, store } = found;
  if (!PROOF_TYPES.includes(file.type))
    throw new OrderError("Upload an image or a PDF.");
  if (file.size > MAX_PROOF_BYTES) throw new OrderError("Files can be up to 10 MB.");
  if (order.status === "cancelled") throw new OrderError("This order was cancelled.", 409);
  if (order.paymentKind === "cash" || order.paymentStatus !== "unpaid")
    throw new OrderError("This order isn't waiting for a payment proof.", 409);
  const key = `stores/${store.id}/proofs/${order.id}/${crypto.randomUUID()}`;
  await env.files.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const [updated] = await db
    .update(orders)
    .set({ paymentStatus: "proof_submitted", proofKey: key, proofType: file.type })
    .where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "unpaid")))
    .returning({ id: orders.id });
  if (!updated) {
    await env.files.delete(key);
    throw new OrderError("This order isn't waiting for a payment proof.", 409);
  }
  if (order.proofKey) await env.files.delete(order.proofKey);
  return { ok: true };
}

export const listOrdersInput = z
  .object({
    storeId: id,
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    q: z.string().trim().max(80).optional(),
    page: z.number().int().min(1).max(10000).default(1),
  })
  .strict();

const PAGE_SIZE = 20;

export async function listOrders(userId: string, input: z.infer<typeof listOrdersInput>) {
  const store = await ownedStore(userId, input.storeId);
  const where: SQL[] = [eq(orders.storeId, store.id)];
  if (input.status) where.push(eq(orders.status, input.status));
  if (input.paymentStatus) where.push(eq(orders.paymentStatus, input.paymentStatus));
  if (input.q) {
    const term = input.q.replace(/^#/, "");
    const pattern = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const match = [
      sql`${orders.customerName} like ${pattern} escape '\\'`,
      sql`${orders.customerPhone} like ${pattern} escape '\\'`,
    ];
    if (/^\d+$/.test(term)) match.push(eq(orders.number, Number(term)));
    where.push(or(...match)!);
  }
  const condition = and(...where);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        totalCents: orders.totalCents,
        currency: orders.currency,
        scheduledFor: orders.scheduledFor,
        service: orders.service,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(condition)
      .orderBy(desc(orders.number))
      .limit(PAGE_SIZE)
      .offset((input.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(orders).where(condition),
  ]);
  return { store, orders: rows, total: total?.n ?? 0, page: input.page, pageSize: PAGE_SIZE };
}

export const orderIdInput = z.object({ storeId: id, orderId: id }).strict();

async function ownedOrder(userId: string, storeId: string, orderId: string) {
  const store = await ownedStore(userId, storeId).catch(() => {
    throw new OrderError("Order not found", 404);
  });
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)));
  if (!order) throw new OrderError("Order not found", 404);
  return { store, order };
}

export async function getOrder(userId: string, input: z.infer<typeof orderIdInput>) {
  const { store, order } = await ownedOrder(userId, input.storeId, input.orderId);
  return {
    id: order.id,
    token: order.token,
    source: order.source,
    hasProof: Boolean(order.proofKey),
    proofType: order.proofType,
    ...receipt(order, store),
    ...(await withItems(order)),
  };
}

const NEXT: Record<string, (typeof ORDER_STATUSES)[number]> = {
  confirmed: "pending",
  ready: "confirmed",
  completed: "ready",
};

export const setStatusInput = orderIdInput
  .extend({ status: z.enum(["confirmed", "ready", "completed", "cancelled"]) })
  .strict();

export async function setStatus(userId: string, input: z.infer<typeof setStatusInput>) {
  const { order } = await ownedOrder(userId, input.storeId, input.orderId);
  if (input.status !== "cancelled") {
    const [done] = await db
      .update(orders)
      .set({ status: input.status })
      .where(and(eq(orders.id, order.id), eq(orders.status, NEXT[input.status]!)))
      .returning({ id: orders.id });
    if (!done) throw new OrderError("The order has moved on. Reload to see it.", 409);
    return { ok: true };
  }
  const items = await db
    .select({ productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), eq(orderItems.stockTracked, true)));
  // Each restore runs only while the order is still open, so a second
  // cancel (or a race with one) gives nothing back twice.
  const stillOpen = sql`exists (select 1 from ${orders} where ${orders.id} = ${order.id} and ${orders.status} not in ('completed', 'cancelled'))`;
  const restores = items
    .filter((i) => i.productId)
    .map((i) =>
      db
        .update(products)
        .set({ stock: sql`${products.stock} + ${i.quantity}` })
        .where(and(eq(products.id, i.productId!), eq(products.trackStock, true), stillOpen)),
    );
  const promoBack = order.promoId
    ? [db.update(promos).set({ uses: sql`max(${promos.uses} - 1, 0)` }).where(and(eq(promos.id, order.promoId), stillOpen))]
    : [];
  const cancel = db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending", "confirmed", "ready"])));
  await db.batch([...restores, ...promoBack, cancel] as unknown as [typeof cancel]);
  const [after] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, order.id));
  if (after?.status !== "cancelled") throw new OrderError("A completed order can't be cancelled.", 409);
  return { ok: true };
}

export const paymentInput = orderIdInput
  .extend({ action: z.enum(["paid", "reject"]) })
  .strict();

export async function setPayment(userId: string, input: z.infer<typeof paymentInput>) {
  const { order } = await ownedOrder(userId, input.storeId, input.orderId);
  if (input.action === "paid") {
    const [done] = await db
      .update(orders)
      .set({ paymentStatus: "paid" })
      .where(and(eq(orders.id, order.id), inArray(orders.paymentStatus, ["unpaid", "proof_submitted"])))
      .returning({ id: orders.id });
    if (!done) throw new OrderError("The order is already paid.", 409);
    return { ok: true };
  }
  const [done] = await db
    .update(orders)
    .set({ paymentStatus: "unpaid", proofKey: null, proofType: null })
    .where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "proof_submitted")))
    .returning({ id: orders.id });
  if (!done) throw new OrderError("There is no proof to reject.", 409);
  if (order.proofKey) await env.files.delete(order.proofKey);
  return { ok: true };
}

/** The proof file, for the store's owner only. */
export async function proofFile(userId: string, orderId: string) {
  const [row] = await db
    .select({ key: orders.proofKey, type: orders.proofType })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(and(eq(orders.id, orderId), eq(stores.ownerId, userId)));
  if (!row?.key) return null;
  const object = await env.files.get(row.key);
  if (!object) return null;
  return { body: object.body, type: row.type ?? "application/octet-stream" };
}

