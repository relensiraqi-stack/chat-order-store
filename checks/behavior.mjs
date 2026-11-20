// Behavior: every frozen feature's main path, F001-F007.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import {
  PDF, PNG, addCategory, apiCheckout, configureStore, createProduct, createPromo, createStore, storeJson,
} from "./helpers.mjs";

const runtime = await startRuntime();
try {
  const owner = await (await runtime.context("owner")).newPage();

  // F001: a store with its checkout settings.
  await owner.goto("/");
  await runtime.assertBackLink(owner);
  const storeId = await createStore(owner, { name: "Harbor Street Bakery", slug: "harbor-bakery" });
  // Unpublished stores are not reachable.
  expect((await storeJson(runtime, "harbor-bakery")).status).toBe(404);
  await configureStore(owner, storeId, {
    description: "Sourdough, pastries and coffee beans, baked every morning.",
    phone: "+1 555 0100",
    published: true,
    open: true,
    pickup: true,
    delivery: true,
    deliveryFee: "4.50",
    tax: "8",
    methods: {
      bank: { enabled: true, label: "Bank transfer", instructions: "Pay to account 0042 1188 at Harbor Credit Union, reference your order number.", proof: true },
      cash: { enabled: true, label: "Cash on pickup" },
    },
  });

  // F002: categories, products with options, stock and a photo.
  await addCategory(owner, storeId, "Breads");
  await addCategory(owner, storeId, "Pastries");
  const loafId = await createProduct(owner, storeId, {
    name: "Sourdough loaf", price: "9.00", category: "Breads", stock: 3,
    description: "Naturally leavened, 36-hour ferment.",
    groups: [
      { name: "Size", required: true, options: [["Whole", "0"], ["Half", "-4.00"]] },
      { name: "Extras", multi: true, max: 2, options: [["Butter", "1.50"], ["Jam", "1.00"], ["Honey", "1.25"]] },
    ],
  });
  await owner.getByTestId("photo-input").setInputFiles({ name: "loaf.png", mimeType: "image/png", buffer: PNG });
  await expect(owner.getByTestId("product-photo")).toBeVisible();
  const croissantId = await createProduct(owner, storeId, { name: "Almond croissant", price: "4.25", category: "Pastries" });
  await createProduct(owner, storeId, { name: "Seeded rye", price: "8.00", category: "Breads", stock: 0 });
  await owner.goto(`/stores/${storeId}/products`);
  await expect(owner.getByTestId("product-row").filter({ hasText: "Seeded rye" })).toContainText("Sold out");
  await expect(owner.getByTestId("product-row").filter({ hasText: "Sourdough loaf" })).toContainText("3 left");

  // F007: a promo code.
  await createPromo(owner, storeId, { code: "welcome10", value: "10", min: "10.00", limit: 50 });

  // F003 request-level: the public catalog and its refusals.
  const pub = await storeJson(runtime, "harbor-bakery");
  expect(pub.status).toBe(200);
  const catalog = await pub.json();
  expect(catalog.store.name).toBe("Harbor Street Bakery");
  expect(catalog.products.map((p) => p.name)).toContain("Sourdough loaf");
  const img = await runtime.fetch(`/s/harbor-bakery/img/${loafId}`);
  expect(img.status).toBe(200);
  expect(img.headers.get("content-type")).toContain("image/png");
  const tooMany = await apiCheckout(runtime, "harbor-bakery", {
    paymentMethodId: catalog.paymentMethods.find((m) => m.kind === "cash").id,
    items: [{ productId: croissantId, quantity: 1, optionIds: [] }, { productId: loafId, quantity: 5, optionIds: [catalog.products.find((p) => p.id === loafId).groups[0].options[0].id] }],
  });
  expect(tooMany.status).toBe(409);
  expect((await tooMany.json()).error).toMatch(/stock/i);
  const noSize = await apiCheckout(runtime, "harbor-bakery", {
    paymentMethodId: catalog.paymentMethods.find((m) => m.kind === "cash").id,
    items: [{ productId: loafId, quantity: 1, optionIds: [] }],
  });
  expect(noSize.status).toBe(400);

  // F003: a customer orders through the store link.
  const shopper = await (await runtime.context(null)).newPage();
  await shopper.goto("/s/harbor-bakery");
  await expect(shopper.getByRole("heading", { level: 1 })).toHaveText("Harbor Street Bakery");
  await expect(shopper.getByTestId("category-section").filter({ hasText: "Breads" })).toContainText("Sourdough loaf");
  await expect(shopper.getByTestId("product-card").filter({ hasText: "Seeded rye" })).toContainText("Sold out");
  await shopper.getByTestId("product-card").filter({ hasText: "Sourdough loaf" }).click();
  await shopper.getByTestId("add-to-cart").click();
  await expect(shopper.getByTestId("option-error")).toContainText("Size");
  await shopper.getByRole("radio", { name: "Whole" }).click();
  await shopper.getByRole("checkbox", { name: "Butter" }).click();
  await shopper.getByRole("checkbox", { name: "Jam" }).click();
  await expect(shopper.getByRole("checkbox", { name: "Honey" })).toBeDisabled();
  await expect(shopper.getByTestId("dialog-total")).toHaveText("$11.50");
  await shopper.getByTestId("add-to-cart").click();
  await shopper.getByTestId("product-card").filter({ hasText: "Almond croissant" }).click();
  await shopper.getByTestId("add-to-cart").click();
  await expect(shopper.getByTestId("cart-bar")).toContainText("2 items");
  await shopper.reload();
  await expect(shopper.getByTestId("cart-bar")).toContainText("2 items");
  await shopper.getByTestId("go-checkout").click();
  await shopper.waitForURL(/\/s\/harbor-bakery\/checkout$/);
  await expect(shopper.getByTestId("checkout-items")).toContainText("Sourdough loaf");
  await expect(shopper.getByTestId("checkout-items")).toContainText("Butter");
  await shopper.locator("#customer-name").fill("Dana Reyes");
  await shopper.locator("#customer-phone").fill("+1 555 0142");
  await shopper.getByRole("radio", { name: "Delivery" }).click();
  await shopper.locator("#scheduled-for").fill("2026-12-02T09:30");
  await shopper.locator("#note").fill("Please ring the side door.");
  await shopper.getByRole("radio", { name: "Bank transfer" }).click();
  await shopper.getByTestId("place-order").click();
  await expect(shopper.getByTestId("checkout-error")).toContainText("address");
  await shopper.locator("#address").fill("18 Pier Lane, Apt 3");
  await shopper.locator("#promo-code").fill("welcome10");
  await shopper.getByTestId("apply-promo").click();
  await expect(shopper.getByTestId("summary-discount")).toHaveText("-$1.58");
  await expect(shopper.getByTestId("summary-subtotal")).toHaveText("$15.75");
  await expect(shopper.getByTestId("summary-fee")).toHaveText("$4.50");
  await expect(shopper.getByTestId("summary-tax")).toHaveText("$1.26");
  await expect(shopper.getByTestId("summary-total")).toHaveText("$19.93");
  await Promise.all([
    shopper.waitForURL(/\/s\/harbor-bakery\/o\/[A-Za-z0-9_-]{20,}$/),
    shopper.getByTestId("place-order").click(),
  ]);

  // F004: the receipt and its chat message.
  const receiptPath = new URL(shopper.url()).pathname;
  await expect(shopper.getByRole("heading", { level: 1 })).toContainText("Order #1");
  await expect(shopper.getByTestId("order-total")).toHaveText("$19.93");
  await expect(shopper.getByTestId("order-status")).toHaveText("Pending");
  await expect(shopper.getByTestId("payment-status")).toHaveText("Unpaid");
  await expect(shopper.getByTestId("payment-instructions")).toContainText("Harbor Credit Union");
  await expect(shopper.getByTestId("receipt-items")).toContainText("Size: Whole");
  await expect(shopper.getByTestId("receipt-service")).toContainText("18 Pier Lane");
  const message = await shopper.getByTestId("order-message").textContent();
  for (const part of ["Order #1", "Sourdough loaf", "Dana Reyes", "Delivery", "Bank transfer", "$19.93"]) expect(message).toContain(part);
  const chat = await shopper.getByTestId("open-chat").getAttribute("href");
  expect(chat).toContain("15550100");
  expect(decodeURIComponent(chat)).toContain("Order #1");
  // Cart cleared after ordering.
  await shopper.goto("/s/harbor-bakery");
  await expect(shopper.getByTestId("cart-bar")).toHaveCount(0);

  // F006: proof of payment.
  await shopper.goto(receiptPath);
  await shopper.getByTestId("proof-input").setInputFiles({ name: "transfer.pdf", mimeType: "application/pdf", buffer: PDF });
  await shopper.getByTestId("upload-proof").click();
  await expect(shopper.getByTestId("payment-status")).toHaveText("Proof submitted");

  // F005: the owner's order dashboard.
  await apiCheckout(runtime, "harbor-bakery", {
    customerName: "Marcus Lee", customerPhone: "+1 555 0177",
    paymentMethodId: catalog.paymentMethods.find((m) => m.kind === "cash").id,
    items: [{ productId: croissantId, quantity: 3, optionIds: [] }],
  }).then((r) => expect(r.status).toBe(201));
  await owner.goto(`/stores/${storeId}`);
  await expect(owner.getByTestId("order-row")).toHaveCount(2);
  await expect(owner.getByTestId("order-row").first()).toContainText("#2");
  await expect(owner.getByTestId("order-row").first()).toContainText("Marcus Lee");
  await owner.getByTestId("order-search").fill("Dana");
  await expect(owner.getByTestId("order-row")).toHaveCount(1);
  await owner.getByTestId("order-search").fill("");
  await owner.getByTestId("filter-payment").click();
  await owner.getByRole("option", { name: "Proof submitted" }).click();
  await expect(owner.getByTestId("order-row")).toHaveCount(1);
  await owner.getByTestId("order-row").filter({ hasText: "#1" }).getByRole("link").click();
  await owner.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = owner.url().match(/\/orders\/([0-9a-f-]{36})$/)[1];
  await expect(owner.getByTestId("receipt-items")).toContainText("Extras: Butter, Jam");
  await expect(owner.getByTestId("receipt-service")).toContainText("Please ring the side door.");
  const proofHref = await owner.getByTestId("proof-link").getAttribute("href");
  const proof = await runtime.fetch(proofHref, { role: "owner" });
  expect(proof.status).toBe(200);
  expect(proof.headers.get("content-type")).toContain("application/pdf");
  // F006: reject, the customer uploads again, then the owner marks paid.
  await owner.getByTestId("reject-proof").click();
  await expect(owner.getByTestId("payment-status")).toHaveText("Unpaid");
  await shopper.goto(receiptPath);
  await shopper.getByTestId("proof-input").setInputFiles({ name: "transfer.png", mimeType: "image/png", buffer: PNG });
  await shopper.getByTestId("upload-proof").click();
  await expect(shopper.getByTestId("payment-status")).toHaveText("Proof submitted");
  await owner.reload();
  await owner.getByTestId("mark-paid").click();
  await expect(owner.getByTestId("payment-status")).toHaveText("Paid");
  for (const [action, status] of [["Confirm", "Confirmed"], ["Mark ready", "Ready"], ["Complete", "Completed"]]) {
    await owner.getByRole("button", { name: action, exact: true }).click();
    await expect(owner.getByTestId("order-status")).toHaveText(status);
  }
  await expect(owner.getByTestId("cancel-order")).toHaveCount(0);
  await shopper.reload();
  await expect(shopper.getByTestId("order-status")).toHaveText("Completed");
  await expect(shopper.getByTestId("payment-status")).toHaveText("Paid");

  // F002: checkout took one loaf from stock; edits leave past orders alone.
  await owner.goto(`/stores/${storeId}/products/${loafId}`);
  await expect(owner.locator("#product-stock")).toHaveValue("2");
  await owner.locator("#product-name").fill("Country sourdough");
  await owner.getByTestId("save-product").click();
  await expect(owner.getByText("Product saved")).toBeVisible();
  await shopper.reload();
  await expect(shopper.getByTestId("receipt-items")).toContainText("Sourdough loaf");

  // F005: a counter sale entered by hand, then cancelled: stock and promo use come back.
  await owner.goto(`/stores/${storeId}/orders/new`);
  await owner.getByTestId("product-card").filter({ hasText: "Country sourdough" }).click();
  await owner.getByRole("radio", { name: "Whole" }).click();
  await owner.getByTestId("add-to-cart").click();
  await owner.getByTestId("product-card").filter({ hasText: "Almond croissant" }).click();
  await owner.getByTestId("add-to-cart").click();
  await owner.locator("#customer-name").fill("Priya Nair");
  await owner.locator("#customer-phone").fill("+1 555 0190");
  await owner.locator("#scheduled-for").fill("2026-12-03T12:00");
  await owner.getByRole("radio", { name: "Cash on pickup" }).click();
  await owner.locator("#promo-code").fill("WELCOME10");
  await owner.getByTestId("apply-promo").click();
  await expect(owner.getByTestId("summary-total")).toHaveText("$12.98");
  await Promise.all([
    owner.waitForURL(/\/orders\/[0-9a-f-]{36}$/),
    owner.getByTestId("place-order").click(),
  ]);
  await expect(owner.getByRole("heading", { level: 1 })).toContainText("Order #3");
  const counterSale = new URL(owner.url()).pathname;
  await owner.goto(`/stores/${storeId}/promos`);
  await expect(owner.getByTestId("promo-row").filter({ hasText: "WELCOME10" })).toContainText("2 / 50");
  await owner.goto(`/stores/${storeId}/products/${loafId}`);
  await expect(owner.locator("#product-stock")).toHaveValue("1");
  await owner.goto(counterSale);
  await expect(owner.getByRole("heading", { level: 1 })).toContainText("Order #3");
  await owner.getByTestId("mark-paid").click();
  await expect(owner.getByTestId("payment-status")).toHaveText("Paid");
  await owner.getByTestId("cancel-order").click();
  await owner.getByTestId("confirm-cancel").click();
  await expect(owner.getByTestId("order-status")).toHaveText("Cancelled");
  await owner.goto(`/stores/${storeId}/products/${loafId}`);
  await expect(owner.locator("#product-stock")).toHaveValue("2");
  await owner.goto(`/stores/${storeId}/promos`);
  await expect(owner.getByTestId("promo-row").filter({ hasText: "WELCOME10" })).toContainText("1 / 50");

  // F001: a closed store refuses orders.
  await configureStore(owner, storeId, { open: false });
  const closed = await apiCheckout(runtime, "harbor-bakery", {
    paymentMethodId: catalog.paymentMethods.find((m) => m.kind === "cash").id,
    items: [{ productId: croissantId, quantity: 1, optionIds: [] }],
  });
  expect(closed.status).toBe(409);
  await shopper.goto("/s/harbor-bakery");
  await expect(shopper.getByTestId("store-closed")).toBeVisible();
  await configureStore(owner, storeId, { open: true });

  // A phone-sized visitor can browse and add to the cart.
  const phone = await (await runtime.context(null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/s/harbor-bakery");
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText("Harbor Street Bakery");
  await phone.getByTestId("product-card").filter({ hasText: "Almond croissant" }).tap();
  await phone.getByTestId("add-to-cart").tap();
  await expect(phone.getByTestId("cart-bar")).toBeVisible();
  await expect(phone.getByTestId("go-checkout")).toBeInViewport();

  // The dashboard with real orders on it.
  await owner.goto(`/stores/${storeId}`);
  await expect(owner.getByTestId("order-row")).toHaveCount(3);
  await runtime.assertBackLink(owner);
  await runtime.screenshot(owner);
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
