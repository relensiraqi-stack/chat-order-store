import { describe, expect, it } from "vitest";
import { OrderError, priceLines, promoDiscount, totals } from "./pricing";

const loaf = {
  id: "p1",
  name: "Loaf",
  priceCents: 900,
  available: true,
  trackStock: true,
  stock: 2,
  groups: [
    {
      id: "g1",
      name: "Size",
      kind: "single" as const,
      required: true,
      maxSelect: null,
      options: [
        { id: "whole", name: "Whole", priceDeltaCents: 0 },
        { id: "half", name: "Half", priceDeltaCents: -400 },
      ],
    },
    {
      id: "g2",
      name: "Extras",
      kind: "multi" as const,
      required: false,
      maxSelect: 2,
      options: [
        { id: "butter", name: "Butter", priceDeltaCents: 150 },
        { id: "jam", name: "Jam", priceDeltaCents: 100 },
        { id: "honey", name: "Honey", priceDeltaCents: 125 },
      ],
    },
  ],
};
const catalog = new Map([[loaf.id, loaf]]);

describe("priceLines", () => {
  it("adds option prices and labels the picks", () => {
    const r = priceLines(catalog, [
      { productId: "p1", quantity: 2, optionIds: ["whole", "butter", "jam"] },
    ]);
    expect(r.subtotalCents).toBe(2300);
    expect(r.lines[0]!.options).toEqual(["Size: Whole", "Extras: Butter, Jam"]);
  });
  it("enforces required groups, limits and stock", () => {
    expect(() =>
      priceLines(catalog, [{ productId: "p1", quantity: 1, optionIds: [] }]),
    ).toThrow(/Choose Size/);
    expect(() =>
      priceLines(catalog, [
        { productId: "p1", quantity: 1, optionIds: ["whole", "butter", "jam", "honey"] },
      ]),
    ).toThrow(/at most 2/);
    expect(() =>
      priceLines(catalog, [{ productId: "p1", quantity: 3, optionIds: ["half"] }]),
    ).toThrow(OrderError);
  });
  it("refuses unavailable products", () => {
    const off = new Map([["p1", { ...loaf, available: false }]]);
    expect(() =>
      priceLines(off, [{ productId: "p1", quantity: 1, optionIds: ["whole"] }]),
    ).toThrow(/unavailable/);
  });
});

describe("promos and totals", () => {
  const promo = {
    code: "WELCOME10",
    kind: "percent" as const,
    value: 1000,
    minSubtotalCents: 1000,
    maxUses: 1,
    uses: 0,
    active: true,
    endsAt: "2026-12-31",
  };
  const now = new Date("2026-11-20T10:00:00Z");
  it("discounts and never past the subtotal", () => {
    expect(promoDiscount(promo, 1575, now)).toBe(158);
    expect(promoDiscount({ ...promo, kind: "fixed", value: 99999 }, 1575, now)).toBe(1575);
  });
  it("refuses below minimum, used up, ended or inactive", () => {
    expect(() => promoDiscount(promo, 900, now)).toThrow(/minimum/);
    expect(() => promoDiscount({ ...promo, uses: 1 }, 1575, now)).toThrow(/used up/);
    expect(() => promoDiscount(promo, 1575, new Date("2027-01-01"))).toThrow(/ended/);
    expect(() => promoDiscount({ ...promo, active: false }, 1575, now)).toThrow();
  });
  it("taxes the items subtotal", () => {
    expect(
      totals({ subtotalCents: 1575, discountCents: 158, feeCents: 450, taxBps: 800 }),
    ).toMatchObject({ taxCents: 126, totalCents: 1993 });
  });
});
