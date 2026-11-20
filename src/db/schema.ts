import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** Members the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

export const stores = sqliteTable(
  "stores",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    currency: text("currency").notNull().default("USD"),
    phone: text("phone").notNull().default(""),
    isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    pickupEnabled: integer("pickup_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    deliveryEnabled: integer("delivery_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    /** Tax in basis points: 825 is 8.25%. */
    taxBps: integer("tax_bps").notNull().default(0),
    /** The number the store's next order gets. */
    nextOrderNo: integer("next_order_no").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("stores_slug_unique").on(t.slug),
    index("stores_owner_idx").on(t.ownerId),
  ],
);

export const paymentMethods = sqliteTable(
  "payment_methods",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["bank", "qr", "cash"] }).notNull(),
    label: text("label").notNull(),
    instructions: text("instructions").notNull().default(""),
    requireProof: integer("require_proof", { mode: "boolean" })
      .notNull()
      .default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("payment_methods_store_kind").on(t.storeId, t.kind)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("categories_store_idx").on(t.storeId)],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    imageKey: text("image_key"),
    imageType: text("image_type"),
    available: integer("available", { mode: "boolean" })
      .notNull()
      .default(true),
    trackStock: integer("track_stock", { mode: "boolean" })
      .notNull()
      .default(false),
    stock: integer("stock").notNull().default(0),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("products_store_idx").on(t.storeId),
    // Checkout's decrement fails the whole batch rather than oversell.
    check("products_stock_nonnegative", sql`${t.stock} >= 0`),
  ],
);

export const optionGroups = sqliteTable(
  "option_groups",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["single", "multi"] }).notNull(),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    /** For multi groups: how many may be picked; null is no limit. */
    maxSelect: integer("max_select"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("option_groups_product_idx").on(t.productId)],
);

export const options = sqliteTable(
  "options",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceDeltaCents: integer("price_delta_cents").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("options_group_idx").on(t.groupId)],
);

export const promos = sqliteTable(
  "promos",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    /** Stored upper-case, so codes match whatever case a customer types. */
    code: text("code").notNull(),
    kind: text("kind", { enum: ["percent", "fixed"] }).notNull(),
    /** Percent: basis points. Fixed: cents. */
    value: integer("value").notNull(),
    minSubtotalCents: integer("min_subtotal_cents"),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    endsAt: text("ends_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("promos_store_code").on(t.storeId, t.code),
    check(
      "promos_uses_within_limit",
      sql`${t.uses} >= 0 AND (${t.maxUses} IS NULL OR ${t.uses} <= ${t.maxUses})`,
    ),
  ],
);

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "ready",
  "completed",
  "cancelled",
] as const;
export const PAYMENT_STATUSES = ["unpaid", "proof_submitted", "paid"] as const;

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** The secret in the customer's order link. */
    token: text("token").notNull(),
    source: text("source", { enum: ["online", "manual"] }).notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    service: text("service", { enum: ["pickup", "delivery"] }).notNull(),
    address: text("address").notNull().default(""),
    scheduledFor: text("scheduled_for").notNull(),
    note: text("note").notNull().default(""),
    paymentMethodId: text("payment_method_id"),
    paymentKind: text("payment_kind", {
      enum: ["bank", "qr", "cash"],
    }).notNull(),
    paymentLabel: text("payment_label").notNull(),
    paymentInstructions: text("payment_instructions").notNull().default(""),
    requireProof: integer("require_proof", { mode: "boolean" })
      .notNull()
      .default(false),
    currency: text("currency").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    feeCents: integer("fee_cents").notNull(),
    discountCents: integer("discount_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    promoId: text("promo_id"),
    promoCode: text("promo_code"),
    status: text("status", { enum: ORDER_STATUSES })
      .notNull()
      .default("pending"),
    paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES })
      .notNull()
      .default("unpaid"),
    proofKey: text("proof_key"),
    proofType: text("proof_type"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("orders_store_number").on(t.storeId, t.number),
    uniqueIndex("orders_token").on(t.token),
    index("orders_store_created").on(t.storeId, t.createdAt),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    name: text("name").notNull(),
    /** "Size: Whole" lines, as they were when ordered. */
    optionsText: text("options_text").notNull().default("[]"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    stockTracked: integer("stock_tracked", { mode: "boolean" })
      .notNull()
      .default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);
