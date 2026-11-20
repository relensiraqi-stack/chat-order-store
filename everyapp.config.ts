import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB, env.files), never the file.
export default defineEveryApp({
  id: "chat-order-store",
  name: "Chat Order Store",
  description:
    "Online stores with a shareable link where customers order, pay by transfer or cash, and send the order to you in a chat.",
  resources: {
    d1: ["DB"],
    // Product photos and customers' payment proofs.
    r2: ["files"],
  },
  // Members run stores. Customers aren't members: they reach a published
  // store's link, its checkout and their own order link, all under /s/.
  public: [
    { path: "/s/:slug", methods: ["GET"] },
    { path: "/s/:slug/checkout", methods: ["GET"] },
    { path: "/s/:slug/o/:token", methods: ["GET"] },
    { path: "/s/:slug/img/:productId", methods: ["GET"] },
    { path: "/s/:slug/api/store", methods: ["GET"] },
    { path: "/s/:slug/api/o/:token", methods: ["GET"] },
    { path: "/s/:slug/api/quote", methods: ["POST"] },
    { path: "/s/:slug/api/checkout", methods: ["POST"] },
    { path: "/s/:slug/api/o/:token/proof", methods: ["POST"] },
  ],
  // The scripts and styles the store pages load, and the icon.
  publicAssets: ["/assets/**", "/icon.svg"],
});
