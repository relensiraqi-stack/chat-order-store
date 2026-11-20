import { createFileRoute } from "@tanstack/react-router";
import { publicOrder } from "@/server/orders";
import { notFound } from "@/server/http";

// Public: one order, to whoever holds its link.
export const Route = createFileRoute("/s/$slug/api/o/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const order = await publicOrder(params.slug, params.token);
        return order
          ? Response.json(order, { headers: { "cache-control": "no-store" } })
          : notFound();
      },
    },
  },
});
