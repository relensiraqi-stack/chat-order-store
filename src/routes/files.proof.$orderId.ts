import { createFileRoute } from "@tanstack/react-router";
import { requireEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { proofFile } from "@/server/orders";
import { notFound } from "@/server/http";

// Private: an order's payment proof, for the store's owner only.
export const Route = createFileRoute("/files/proof/$orderId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await requireEveryAppUser(request, env);
        const file = await proofFile(user.id, params.orderId);
        if (!file) return notFound();
        return new Response(file.body, {
          headers: {
            "content-type": file.type,
            "content-disposition": "inline",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
          },
        });
      },
    },
  },
});
