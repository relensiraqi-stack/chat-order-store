// Prices a cart from stored data only. Shared by checkout, the counter-sale
// form and the quote the checkout page shows, so all three agree.

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export interface PricedOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}
export interface PricedGroup {
  id: string;
  name: string;
  kind: "single" | "multi";
  required: boolean;
  maxSelect: number | null;
  options: PricedOption[];
}
export interface PricedProduct {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  trackStock: boolean;
  stock: number;
  groups: PricedGroup[];
}
export interface CartLine {
  productId: string;
  quantity: number;
  optionIds: string[];
}
export interface PricedLine {
  productId: string;
  name: string;
  /** "Size: Whole", one per group with a pick. */
  options: string[];
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  stockTracked: boolean;
}

export function priceLines(
  products: Map<string, PricedProduct>,
  lines: CartLine[],
): { lines: PricedLine[]; subtotalCents: number } {
  if (lines.length === 0) throw new OrderError("The cart is empty.");
  const wanted = new Map<string, number>();
  const priced = lines.map((line) => {
    const product = products.get(line.productId);
    if (!product) throw new OrderError("An item is no longer sold.", 409);
    if (!product.available)
      throw new OrderError(`${product.name} is unavailable.`, 409);
    const picked = new Set(line.optionIds);
    const known = new Set(
      product.groups.flatMap((g) => g.options.map((o) => o.id)),
    );
    for (const id of picked)
      if (!known.has(id))
        throw new OrderError(`An option of ${product.name} has changed.`, 409);
    let unit = product.priceCents;
    const labels: string[] = [];
    for (const group of product.groups) {
      const chosen = group.options.filter((o) => picked.has(o.id));
      if (group.required && chosen.length === 0)
        throw new OrderError(`Choose ${group.name} for ${product.name}.`);
      if (group.kind === "single" && chosen.length > 1)
        throw new OrderError(`Choose one ${group.name} for ${product.name}.`);
      if (
        group.kind === "multi" &&
        group.maxSelect !== null &&
        chosen.length > group.maxSelect
      )
        throw new OrderError(
          `Choose at most ${group.maxSelect} ${group.name} for ${product.name}.`,
        );
      if (chosen.length > 0)
        labels.push(`${group.name}: ${chosen.map((o) => o.name).join(", ")}`);
      for (const o of chosen) unit += o.priceDeltaCents;
    }
    unit = Math.max(0, unit);
    wanted.set(product.id, (wanted.get(product.id) ?? 0) + line.quantity);
    return {
      productId: product.id,
      name: product.name,
      options: labels,
      unitPriceCents: unit,
      quantity: line.quantity,
      lineTotalCents: unit * line.quantity,
      stockTracked: product.trackStock,
    };
  });
  for (const [id, quantity] of wanted) {
    const product = products.get(id)!;
    if (!product.trackStock) continue;
    if (product.stock <= 0)
      throw new OrderError(`${product.name} is out of stock.`, 409);
    if (product.stock < quantity)
      throw new OrderError(
        `Only ${product.stock} of ${product.name} left in stock.`,
        409,
      );
  }
  return {
    lines: priced,
    subtotalCents: priced.reduce((sum, l) => sum + l.lineTotalCents, 0),
  };
}

export interface PromoRule {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minSubtotalCents: number | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  endsAt: string | null;
}

/** The discount a code gives on this subtotal, or an error saying why not. */
export function promoDiscount(
  promo: PromoRule | undefined,
  subtotalCents: number,
  now: Date,
): number {
  if (!promo || !promo.active)
    throw new OrderError("That promo code isn't valid.", 409);
  if (promo.endsAt && now.toISOString().slice(0, 10) > promo.endsAt)
    throw new OrderError("That promo code has ended.", 409);
  if (promo.maxUses !== null && promo.uses >= promo.maxUses)
    throw new OrderError("That promo code has been used up.", 409);
  if (promo.minSubtotalCents !== null && subtotalCents < promo.minSubtotalCents)
    throw new OrderError("The order is below this code's minimum.", 409);
  const raw =
    promo.kind === "percent"
      ? Math.round((subtotalCents * promo.value) / 10000)
      : promo.value;
  return Math.min(raw, subtotalCents);
}

export function totals({
  subtotalCents,
  discountCents,
  feeCents,
  taxBps,
}: {
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  taxBps: number;
}) {
  const taxCents = Math.round((subtotalCents * taxBps) / 10000);
  return {
    subtotalCents,
    discountCents,
    feeCents,
    taxCents,
    totalCents: subtotalCents - discountCents + feeCents + taxCents,
  };
}
