// Authorization: private paths, public surface, ownership, admin, no sign-in of its own (X001).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { PDF, apiCheckout, configureStore, createProduct, createStore, storeJson } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/admin"]);

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();

  // The owner (an org admin) and a member each have a store.
  const aId = await createStore(owner, { name: "Juniper Florist", slug: "juniper-florist" });
  await configureStore(owner, aId, { published: true, pickup: true, methods: { bank: { enabled: true, label: "Bank transfer", instructions: "Account 7781", proof: true } } });
  const roseId = await createProduct(owner, aId, { name: "Rose bouquet", price: "35.00" });
  const hiddenId = await createProduct(owner, aId, { name: "Wedding arch", price: "400.00" });
  await owner.getByTestId("switch-available").click();
  await owner.getByTestId("save-product").click();
  await expect(owner.getByText("Product saved")).toBeVisible();

  const bId = await createStore(member, { name: "Corner Bike Repair", slug: "corner-bikes" });
  await expect(member.getByRole("heading", { level: 1 })).toHaveText("Corner Bike Repair");

  // Public surface: published catalog only, no merchant-only fields, no unavailable products.
  expect((await storeJson(runtime, "corner-bikes")).status).toBe(404);
  const pub = await storeJson(runtime, "juniper-florist");
  expect(pub.status).toBe(200);
  const body = await pub.text();
  expect(body).toContain("Rose bouquet");
  expect(body).not.toContain("Wedding arch");
  expect(body).not.toMatch(/ownerId|owner_id|@|nextOrder/);
  const catalog = JSON.parse(body);
  const placed = await apiCheckout(runtime, "juniper-florist", {
    paymentMethodId: catalog.paymentMethods[0].id,
    items: [{ productId: roseId, quantity: 1, optionIds: [] }],
  });
  expect(placed.status).toBe(201);
  const { token } = await placed.json();
  const hidden = await apiCheckout(runtime, "juniper-florist", {
    paymentMethodId: catalog.paymentMethods[0].id,
    items: [{ productId: hiddenId, quantity: 1, optionIds: [] }],
  });
  expect(hidden.status).toBe(409);
  // An order is readable only with its token, and only under its store.
  expect((await runtime.fetch(`/s/juniper-florist/api/o/${token}`)).status).toBe(200);
  expect((await runtime.fetch(`/s/juniper-florist/api/o/${"x".repeat(token.length)}`)).status).toBe(404);
  expect((await runtime.fetch(`/s/corner-bikes/api/o/${token}`)).status).toBe(404);
  const proofForm = new FormData();
  proofForm.append("file", new Blob([PDF], { type: "application/pdf" }), "p.pdf");
  expect((await runtime.fetch(`/s/juniper-florist/api/o/${token}/proof`, { method: "POST", body: proofForm })).status).toBe(200);
  const notAllowed = new FormData();
  notAllowed.append("file", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html");
  expect((await runtime.fetch(`/s/juniper-florist/api/o/${token}/proof`, { method: "POST", body: notAllowed })).status).toBe(400);
  const orderId = (await (await runtime.database()).prepare("select id from orders where token = ?").bind(token).first()).id;

  // Private paths refuse anonymous visitors and other organizations.
  for (const role of [undefined, "outsider"]) {
    for (const path of [`/stores/${aId}`, `/stores/${aId}/settings`, `/files/proof/${orderId}`]) {
      expect([401, 403, 302, 303]).toContain((await runtime.fetch(path, role ? { role } : {})).status);
    }
  }

  // One member cannot read another's store, orders, products or proofs.
  await member.goto(`/stores/${aId}`);
  await expect(member.getByText("Store not found")).toBeVisible();
  await expect(member.getByText("Juniper Florist")).toHaveCount(0);
  await member.goto(`/stores/${aId}/orders/${orderId}`);
  await expect(member.getByText("Order not found")).toBeVisible();
  await expect(member.getByText("Dana Reyes")).toHaveCount(0);
  await member.goto(`/stores/${aId}/products/${roseId}`);
  await expect(member.getByText("Product not found")).toBeVisible();
  expect((await runtime.fetch(`/files/proof/${orderId}`, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(`/files/proof/${orderId}`, { role: "owner" })).status).toBe(200);
  // The member's own store list holds only their store.
  await member.goto("/");
  await expect(member.getByTestId("store-card")).toHaveCount(1);
  await expect(member.getByTestId("store-card")).toContainText("Corner Bike Repair");

  // ...nor change them, even by rewriting a request to name the other store.
  await member.goto(`/stores/${bId}/settings`);
  await member.route("**/_serverFn/**", async (route) => {
    const data = route.request().postData();
    await route.continue(data ? { postData: data.replaceAll(bId, aId) } : {});
  });
  await member.locator("#store-name").fill("Taken Over");
  await member.getByTestId("save-settings").click();
  await expect(member.getByTestId("form-error")).toBeVisible();
  await member.unroute("**/_serverFn/**");
  const db = await runtime.database();
  expect((await db.prepare("select name from stores where id = ?").bind(aId).first()).name).toBe("Juniper Florist");
  // ...nor move another store's order along.
  await configureStore(member, bId, { published: true, pickup: true, methods: { cash: { enabled: true, label: "Cash" } } });
  const tubeId = await createProduct(member, bId, { name: "Inner tube", price: "6.00" });
  const bCatalog = await (await storeJson(runtime, "corner-bikes")).json();
  const bPlaced = await apiCheckout(runtime, "corner-bikes", { paymentMethodId: bCatalog.paymentMethods[0].id, items: [{ productId: tubeId, quantity: 1, optionIds: [] }] });
  const bOrderId = (await db.prepare("select id from orders where token = ?").bind((await bPlaced.json()).token).first()).id;
  await member.goto(`/stores/${bId}/orders/${bOrderId}`);
  await member.route("**/_serverFn/**", async (route) => {
    const data = route.request().postData();
    await route.continue(data ? { postData: data.replaceAll(bOrderId, orderId).replaceAll(bId, aId) } : {});
  });
  await member.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(member.getByTestId("form-error")).toBeVisible();
  await member.getByTestId("mark-paid").click();
  await expect(member.getByTestId("form-error")).toBeVisible();
  await member.unroute("**/_serverFn/**");
  const aOrder = await db.prepare("select status, payment_status from orders where id = ?").bind(orderId).first();
  expect(aOrder).toEqual({ status: "pending", payment_status: "proof_submitted" });

  // Admin-only: members can't see or unpublish all stores; admins can.
  await member.goto("/admin");
  await expect(member.getByText("Only admins can open this page.")).toBeVisible();
  await expect(member.getByText("Juniper Florist")).toHaveCount(0);
  expect((await storeJson(runtime, "corner-bikes")).status).toBe(200);
  await owner.goto("/admin");
  const row = owner.getByTestId("admin-store-row").filter({ hasText: "Corner Bike Repair" });
  await expect(row).toBeVisible();
  await row.getByTestId("unpublish").click();
  await expect(row).toContainText("Unpublished");
  expect((await storeJson(runtime, "corner-bikes")).status).toBe(404);

  // The app has no sign-in of its own (X001): the Gateway handles it.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/logout", "/account"]) {
    const res = await runtime.fetch(path, { role: "owner" });
    expect(res.status).toBe(404);
  }
  await owner.goto("/");
  await expect(owner.locator('input[type="password"]')).toHaveCount(0);
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
