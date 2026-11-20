import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as promos from "@/server/promos";

export const getPromos = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ storeId: z.string().uuid() }).strict().parse(data))
  .handler(({ data, context: { user } }) => promos.listPromos(user.id, data.storeId));

export const createPromo = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => promos.promoInput.parse(data))
  .handler(({ data, context: { user } }) => promos.createPromo(user.id, data));

export const setPromoActive = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => promos.promoActiveInput.parse(data))
  .handler(({ data, context: { user } }) => promos.setPromoActive(user.id, data));

export const deletePromo = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => promos.promoIdInput.parse(data))
  .handler(({ data, context: { user } }) => promos.deletePromo(user.id, data));
