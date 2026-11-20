export interface OptionView {
  id: string;
  name: string;
  priceDeltaCents: number;
}
export interface GroupView {
  id: string;
  name: string;
  kind: "single" | "multi";
  required: boolean;
  maxSelect: number | null;
  options: OptionView[];
}
export interface ProductView {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  categoryId: string | null;
  soldOut: boolean;
  imageUrl: string | null;
  groups: GroupView[];
}
export interface MethodView {
  id: string;
  kind: "bank" | "qr" | "cash";
  label: string;
  instructions: string;
  requireProof: boolean;
}
export interface CartItem {
  key: string;
  productId: string;
  quantity: number;
  optionIds: string[];
  /** For showing the cart; checkout prices it again from the store's data. */
  name: string;
  options: string[];
  unitPriceCents: number;
}
export interface Quote {
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  taxCents: number;
  totalCents: number;
  promoCode: string | null;
}
