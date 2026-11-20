// Shared steps for the suites: each one drives the app the way a person does.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

/** Creates a store from the stores page and returns its id. */
export async function createStore(page, { name, slug, currency = "USD" }) {
  await page.goto("/");
  await page.getByTestId("new-store").click();
  await page.locator("#store-name").fill(name);
  await page.locator("#store-slug").fill(slug);
  await page.locator("#store-currency").fill(currency);
  await Promise.all([
    page.waitForURL(/\/stores\/[0-9a-f-]{36}$/),
    page.getByTestId("create-store").click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  return page.url().match(/\/stores\/([0-9a-f-]{36})/)[1];
}

async function setSwitch(page, testId, on) {
  const control = page.getByTestId(testId);
  if ((await control.getAttribute("aria-checked")) !== String(on)) await control.click();
  await expect(control).toHaveAttribute("aria-checked", String(on));
}

/** Opens checkout settings, sets what is given and saves. */
export async function configureStore(page, storeId, s) {
  await page.goto(`/stores/${storeId}/settings`);
  if (s.description !== undefined) await page.locator("#store-description").fill(s.description);
  if (s.phone !== undefined) await page.locator("#store-phone").fill(s.phone);
  if (s.open !== undefined) await setSwitch(page, "switch-open", s.open);
  if (s.published !== undefined) await setSwitch(page, "switch-published", s.published);
  if (s.pickup !== undefined) await setSwitch(page, "switch-pickup", s.pickup);
  if (s.delivery !== undefined) await setSwitch(page, "switch-delivery", s.delivery);
  if (s.deliveryFee !== undefined) await page.locator("#delivery-fee").fill(s.deliveryFee);
  if (s.tax !== undefined) await page.locator("#tax-percent").fill(s.tax);
  for (const [kind, m] of Object.entries(s.methods ?? {})) {
    const card = page.getByTestId(`method-${kind}`);
    await setSwitch(card.page(), `switch-method-${kind}`, m.enabled);
    if (m.label !== undefined) await card.getByLabel("Label").fill(m.label);
    if (m.instructions !== undefined) await card.getByLabel("Instructions").fill(m.instructions);
    if (m.proof !== undefined) await setSwitch(page, `switch-proof-${kind}`, m.proof);
  }
  await page.getByTestId("save-settings").click();
  await expect(page.getByText("Settings saved")).toBeVisible();
}

export async function addCategory(page, storeId, name) {
  if (!page.url().endsWith(`/stores/${storeId}/products`)) await page.goto(`/stores/${storeId}/products`);
  await page.locator("#category-name").fill(name);
  await page.getByTestId("add-category").click();
  await expect(page.getByTestId("category-row").filter({ hasText: name })).toBeVisible();
}

/** Creates a product and returns its id; leaves the browser on its page. */
export async function createProduct(page, storeId, p) {
  await page.goto(`/stores/${storeId}/products`);
  await page.getByTestId("new-product").click();
  await page.locator("#new-product-name").fill(p.name);
  await page.locator("#new-product-price").fill(p.price);
  await Promise.all([
    page.waitForURL(/\/products\/[0-9a-f-]{36}$/),
    page.getByTestId("create-product").click(),
  ]);
  const productId = page.url().match(/\/products\/([0-9a-f-]{36})$/)[1];
  if (p.description) await page.locator("#product-description").fill(p.description);
  if (p.category) {
    await page.getByTestId("product-category").click();
    await page.getByRole("option", { name: p.category }).click();
  }
  if (p.stock !== undefined) {
    await setSwitch(page, "switch-track-stock", true);
    await page.locator("#product-stock").fill(String(p.stock));
  }
  await page.getByTestId("save-product").click();
  await expect(page.getByText("Product saved")).toBeVisible();
  for (const g of p.groups ?? []) {
    await page.getByTestId("add-group").click();
    await page.locator("#group-name").fill(g.name);
    await page.getByRole("radio", { name: g.multi ? "Several" : "One" }).click();
    if (g.required) await setSwitch(page, "switch-group-required", true);
    if (g.max) await page.locator("#group-max").fill(String(g.max));
    await page.getByTestId("save-group").click();
    const card = page.getByTestId("option-group").filter({ hasText: g.name });
    await expect(card).toBeVisible();
    for (const [name, delta] of g.options) {
      await card.getByLabel("Option name").fill(name);
      await card.getByLabel("Price change").fill(delta);
      await card.getByTestId("add-option").click();
      await expect(card.getByTestId("option-row").filter({ hasText: name })).toBeVisible();
    }
  }
  return productId;
}

export async function createPromo(page, storeId, p) {
  await page.goto(`/stores/${storeId}/promos`);
  await page.getByTestId("new-promo").click();
  await page.locator("#promo-code").fill(p.code);
  await page.getByRole("radio", { name: p.fixed ? "Fixed amount" : "Percent" }).click();
  await page.locator("#promo-value").fill(p.value);
  if (p.min) await page.locator("#promo-min").fill(p.min);
  if (p.limit) await page.locator("#promo-limit").fill(String(p.limit));
  await page.getByTestId("save-promo").click();
  await expect(page.getByTestId("promo-row").filter({ hasText: p.code.toUpperCase() })).toBeVisible();
}

/** A JSON checkout through the public API. */
export async function apiCheckout(runtime, slug, body) {
  return runtime.fetch(`/s/${slug}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerName: "Dana Reyes",
      customerPhone: "+1 555 0142",
      service: "pickup",
      scheduledFor: "2026-12-02T09:30",
      note: "",
      promoCode: "",
      ...body,
    }),
  });
}

export async function storeJson(runtime, slug, role) {
  return runtime.fetch(`/s/${slug}/api/store`, role ? { role } : {});
}
