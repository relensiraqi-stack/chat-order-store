import { createFileRoute } from "@tanstack/react-router";
import { quote, quoteInput } from "@/server/orders";
import { errorResponse, notFound } from "@/server/http";
import { publishedStore } from "@/server/storefront";
import { publicQuote } from "@/serverFunctions/orders";

// Public: prices a cart the way checkout will.
export const Route = createFileRoute("/s/$slug/api/quote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const store = await publishedStore(params.slug);
        if (!store) return notFound();
        try {
          const input = quoteInput.parse(await request.json());
          return Response.json(publicQuote(await quote(store, input)));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
