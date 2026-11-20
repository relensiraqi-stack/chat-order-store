import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { promos } from "@/db/schema";
import { OrderError } from "./pricing";
import { ownedStore } from "./stores";

const id = z.string().uuid();

export const promoInput = z
  .object({
    storeId: id,
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "Use 3 to 32 letters, numbers, dashes or underscores"),
    kind: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1),
    minSubtotalCents: z.number().int().min(0).nullable(),
    maxUses: z.number().int().min(1).nullable(),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict()
  .refine((p) => p.kind !== "percent" || p.value <= 10000, "A percentage can be at most 100");

export const promoIdInput = z.object({ storeId: id, promoId: id }).strict();
export const promoActiveInput = z
  .object({ storeId: id, promoId: id, active: z.boolean() })
  .strict();

export async function listPromos(userId: string, storeId: string) {
  const store = await ownedStore(userId, storeId);
  const rows = await db
    .select()
    .from(promos)
    .where(eq(promos.storeId, storeId))
    .orderBy(desc(promos.createdAt));
  return { store, promos: rows };
}

export async function createPromo(userId: string, { storeId, ...p }: z.infer<typeof promoInput>) {
  await ownedStore(userId, storeId);
  const [taken] = await db
    .select({ id: promos.id })
    .from(promos)
    .where(and(eq(promos.storeId, storeId), eq(promos.code, p.code)));
  if (taken) throw new OrderError("This store already has that code.", 409);
  await db.insert(promos).values({ id: crypto.randomUUID(), storeId, ...p });
  return { ok: true };
}

export async function setPromoActive(userId: string, input: z.infer<typeof promoActiveInput>) {
  await ownedStore(userId, input.storeId);
  await db
    .update(promos)
    .set({ active: input.active })
    .where(and(eq(promos.id, input.promoId), eq(promos.storeId, input.storeId)));
  return { ok: true };
}

export async function deletePromo(userId: string, input: z.infer<typeof promoIdInput>) {
  await ownedStore(userId, input.storeId);
  await db
    .delete(promos)
    .where(and(eq(promos.id, input.promoId), eq(promos.storeId, input.storeId)));
  return { ok: true };
}
