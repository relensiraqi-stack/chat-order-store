import { createFileRoute } from "@tanstack/react-router";
import { submitProof } from "@/server/orders";
import { errorResponse } from "@/server/http";
import { OrderError } from "@/server/pricing";

// Public: the customer's payment proof for their order.
export const Route = createFileRoute("/s/$slug/api/o/$token/proof")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const form = await request.formData().catch(() => null);
          const file = form?.get("file");
          if (!(file instanceof File)) throw new OrderError("Choose a file.");
          return Response.json(await submitProof(params.slug, params.token, file));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
