import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { paymentMethods, stores, users } from "@/db/schema";
import { OrderError } from "./pricing";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters for the link")
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letters, numbers and dashes");

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => {
    try {
      new Intl.NumberFormat("en", { style: "currency", currency: code });
      return /^[A-Z]{3}$/.test(code);
    } catch {
      return false;
    }
  }, "Use a three-letter currency code such as USD");

export const createStoreInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    slug: slugSchema,
    currency: currencySchema,
  })
  .strict();

const methodInput = z
  .object({
    id: z.string().uuid(),
    label: z.string().trim().min(1, "Each payment method needs a label").max(60),
    instructions: z.string().trim().max(1000),
    requireProof: z.boolean(),
    enabled: z.boolean(),
  })
  .strict();

export const updateStoreInput = z
  .object({
    storeId: z.string().uuid(),
    name: z.string().trim().min(1, "Name is required").max(80),
    slug: slugSchema,
    description: z.string().trim().max(1000),
    currency: currencySchema,
    phone: z.string().trim().max(32),
    isOpen: z.boolean(),
    published: z.boolean(),
    pickupEnabled: z.boolean(),
    deliveryEnabled: z.boolean(),
    deliveryFeeCents: z.number().int().min(0).max(100_000_00),
    taxBps: z.number().int().min(0).max(10000),
    methods: z.array(methodInput).max(3),
  })
  .strict();

export const storeIdInput = z.object({ storeId: z.string().uuid() }).strict();

export type Store = typeof stores.$inferSelect;

export function listStores(userId: string) {
  return db
    .select()
    .from(stores)
    .where(eq(stores.ownerId, userId))
    .orderBy(asc(stores.createdAt), asc(stores.id));
}

/** The store if this member owns it; otherwise "not found", never "forbidden". */
export async function ownedStore(userId: string, storeId: string): Promise<Store> {
  const [store] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.ownerId, userId)));
  if (!store) throw new OrderError("Store not found", 404);
  return store;
}

const DEFAULT_METHODS = [
  { kind: "bank", label: "Bank transfer", requireProof: true },
  { kind: "qr", label: "QR payment", requireProof: true },
  { kind: "cash", label: "Cash on delivery", requireProof: false },
] as const;

async function slugTaken(slug: string, exceptId?: string) {
  const [row] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.slug, slug));
  return Boolean(row && row.id !== exceptId);
}

export async function createStore(
  userId: string,
  input: z.infer<typeof createStoreInput>,
) {
  if (await slugTaken(input.slug))
    throw new OrderError("Another store uses that link.", 409);
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(stores).values({ id, ownerId: userId, ...input }),
    db.insert(paymentMethods).values(
      DEFAULT_METHODS.map((m) => ({ id: crypto.randomUUID(), storeId: id, ...m })),
    ),
  ]);
  return { id };
}

export async function getStoreSettings(userId: string, storeId: string) {
  const store = await ownedStore(userId, storeId);
  const methods = await listMethods(storeId);
  return { store, methods };
}

export function listMethods(storeId: string) {
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.storeId, storeId))
    .orderBy(asc(paymentMethods.kind));
}

export async function updateStore(
  userId: string,
  { storeId, methods, ...fields }: z.infer<typeof updateStoreInput>,
) {
  await ownedStore(userId, storeId);
  if (await slugTaken(fields.slug, storeId))
    throw new OrderError("Another store uses that link.", 409);
  await db.batch([
    db.update(stores).set(fields).where(and(eq(stores.id, storeId), eq(stores.ownerId, userId))),
    ...methods.map(({ id, ...m }) =>
      db
        .update(paymentMethods)
        .set(m)
        .where(and(eq(paymentMethods.id, id), eq(paymentMethods.storeId, storeId))),
    ),
  ]);
  return { ok: true };
}

/** Every store in the workspace, for admins. */
export function listAllStores() {
  return db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      published: stores.published,
      ownerEmail: users.email,
    })
    .from(stores)
    .innerJoin(users, eq(users.id, stores.ownerId))
    .orderBy(desc(stores.createdAt));
}

export async function unpublishStore(storeId: string) {
  await db.update(stores).set({ published: false }).where(eq(stores.id, storeId));
  return { ok: true };
}
