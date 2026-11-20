import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { OrderError } from "@/server/pricing";
import * as stores from "@/server/stores";
import { rememberUser } from "@/server/users";

// Every function runs behind ensureUserMiddleware: `context.user` is the
// member the Gateway signed in, and each query checks they own the store.
export const getStores = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => ({
    stores: await stores.listStores(user.id),
    isAdmin: isAdmin(user),
  }));

export const createStore = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => stores.createStoreInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await rememberUser(user);
    return stores.createStore(user.id, data);
  });

export const getStoreSettings = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => stores.storeIdInput.parse(data))
  .handler(({ data, context: { user } }) =>
    stores.getStoreSettings(user.id, data.storeId),
  );

export const updateStore = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => stores.updateStoreInput.parse(data))
  .handler(({ data, context: { user } }) => stores.updateStore(user.id, data));

export const getAllStores = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) =>
    isAdmin(user)
      ? { allowed: true as const, stores: await stores.listAllStores() }
      : { allowed: false as const, stores: [] },
  );

export const unpublishStore = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => stores.storeIdInput.parse(data))
  .handler(({ data, context: { user } }) => {
    if (!isAdmin(user)) throw new OrderError("Only admins can do that.", 404);
    return stores.unpublishStore(data.storeId);
  });
