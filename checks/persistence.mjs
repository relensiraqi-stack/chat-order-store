// Persistence: stores, products, orders and proofs survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { PNG, apiCheckout, configureStore, createProduct, createStore, storeJson } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  let owner = await (await runtime.context("owner")).newPage();
  const storeId = await createStore(owner, { name: "Tidewater Coffee", slug: "tidewater-coffee", currency: "EUR" });
  await configureStore(owner, storeId, { published: true, pickup: true, methods: { qr: { enabled: true, label: "QR payment", instructions: "Scan the code at the counter.", proof: true } } });
  const beansId = await createProduct(owner, storeId, { name: "House blend beans", price: "14.00", stock: 10 });
  const catalog = await (await storeJson(runtime, "tidewater-coffee")).json();
  const placed = await apiCheckout(runtime, "tidewater-coffee", {
    customerName: "Lena Brandt",
    paymentMethodId: catalog.paymentMethods[0].id,
    items: [{ productId: beansId, quantity: 2, optionIds: [] }],
  });
  expect(placed.status).toBe(201);
  const { token } = await placed.json();
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), "receipt.png");
  expect((await runtime.fetch(`/s/tidewater-coffee/api/o/${token}/proof`, { method: "POST", body: form })).status).toBe(200);

  await runtime.restart();

  owner = await (await runtime.context("owner")).newPage();
  await owner.goto(`/stores/${storeId}`);
  await expect(owner.getByTestId("order-row")).toHaveCount(1);
  await expect(owner.getByTestId("order-row")).toContainText("Lena Brandt");
  await owner.getByTestId("order-row").getByRole("link").click();
  await expect(owner.getByTestId("payment-status")).toHaveText("Proof submitted");
  const proof = await runtime.fetch(await owner.getByTestId("proof-link").getAttribute("href"), { role: "owner" });
  expect(proof.status).toBe(200);
  await owner.goto(`/stores/${storeId}/products/${beansId}`);
  await expect(owner.locator("#product-stock")).toHaveValue("8");
  const order = await (await runtime.fetch(`/s/tidewater-coffee/api/o/${token}`)).json();
  expect(order.number).toBe(1);
  expect(order.items[0].name).toBe("House blend beans");
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
