import { createFileRoute } from "@tanstack/react-router";
import { storefront } from "@/server/storefront";
import { notFound } from "@/server/http";

// Public: a published store's catalog, for its store link.
export const Route = createFileRoute("/s/$slug/api/store")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const data = await storefront(params.slug);
        return data
          ? Response.json(data, { headers: { "cache-control": "no-store" } })
          : notFound();
      },
    },
  },
});
