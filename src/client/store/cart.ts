import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "./types";

const keyFor = (slug: string) => `cart:${slug}`;

function read(slug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** The cart for one store, kept in this browser. */
export function useCart(slug: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => setItems(read(slug)), [slug]);
  const save = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      if (next.length) localStorage.setItem(keyFor(slug), JSON.stringify(next));
      else localStorage.removeItem(keyFor(slug));
    },
    [slug],
  );
  return { items, setItems: save };
}

export function clearCart(slug: string) {
  localStorage.removeItem(keyFor(slug));
}

/** Adds an item, merging with an identical line. */
export function addItem(items: CartItem[], item: Omit<CartItem, "key">): CartItem[] {
  const key = `${item.productId}:${[...item.optionIds].sort().join(",")}`;
  const existing = items.find((i) => i.key === key);
  if (existing)
    return items.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) } : i));
  return [...items, { ...item, key }];
}
