import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as catalog from "@/server/catalog";
import { OrderError } from "@/server/pricing";

export const getCatalog = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ storeId: z.string().uuid() }).strict().parse(data))
  .handler(({ data, context: { user } }) => catalog.listCatalog(user.id, data.storeId));

export const createCategory = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.categoryInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.createCategory(user.id, data));

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.categoryIdInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.deleteCategory(user.id, data));

export const moveCategory = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.moveInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.move(user.id, "category", data));

export const moveProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.moveInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.move(user.id, "product", data));

export const createProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.newProductInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.createProduct(user.id, data));

export const getProduct = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.productIdInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.getProduct(user.id, data));

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.updateProductInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.updateProduct(user.id, data));

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.productIdInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.deleteProduct(user.id, data));

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new OrderError("Choose an image.");
    const ids = catalog.productIdInput.parse({
      storeId: data.get("storeId"),
      productId: data.get("productId"),
    });
    const file = data.get("file");
    if (!(file instanceof File)) throw new OrderError("Choose an image.");
    return { ...ids, file };
  })
  .handler(({ data, context: { user } }) =>
    catalog.setProductImage(user.id, data.storeId, data.productId, data.file),
  );

export const removeProductImage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.productIdInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.removeProductImage(user.id, data));

export const addGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.groupInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.addGroup(user.id, data));

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.groupIdInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.deleteGroup(user.id, data));

export const addOption = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.optionInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.addOption(user.id, data));

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => catalog.optionIdInput.parse(data))
  .handler(({ data, context: { user } }) => catalog.deleteOption(user.id, data));
