import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { products, stores } from "@/db/schema";
import { notFound } from "@/server/http";

// Public: a product photo of a published store. Its owner also sees photos
// of hidden products and unpublished stores.
export const Route = createFileRoute("/s/$slug/img/$productId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [row] = await db
          .select({ key: products.imageKey, type: products.imageType, available: products.available, published: stores.published, ownerId: stores.ownerId })
          .from(products)
          .innerJoin(stores, eq(stores.id, products.storeId))
          .where(and(eq(products.id, params.productId), eq(stores.slug, params.slug)));
        if (!row?.key) return notFound();
        if (!row.published || !row.available) {
          const user = await getEveryAppUser(request, env);
          if (user?.id !== row.ownerId) return notFound();
        }
        const object = await env.files.get(row.key);
        if (!object) return notFound();
        return new Response(object.body, {
          headers: {
            "content-type": row.type ?? "application/octet-stream",
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
