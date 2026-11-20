import { createFileRoute } from "@tanstack/react-router";
import { checkoutInput, placeOrder } from "@/server/orders";
import { errorResponse, notFound } from "@/server/http";
import { publishedStore } from "@/server/storefront";

// Public: places an order. Every price is read again from the store's data.
export const Route = createFileRoute("/s/$slug/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const store = await publishedStore(params.slug);
        if (!store) return notFound();
        try {
          const input = checkoutInput.parse(await request.json());
          const placed = await placeOrder(store, input, "online");
          return Response.json(
            { number: placed.number, token: placed.token },
            { status: 201 },
          );
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
