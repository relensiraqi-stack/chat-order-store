import type { Storefront } from "@/server/storefront";

/** JSON from one of a store link's public routes; an Error with its message otherwise. */
export async function storeApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? "Something went wrong.");
  return body as T;
}

export async function loadStorefront(slug: string): Promise<Storefront | null> {
  const response = await fetch(`/s/${encodeURIComponent(slug)}/api/store`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("The store couldn't be loaded.");
  return (await response.json()) as Storefront;
}

export const postJson = <T,>(path: string, body: unknown) =>
  storeApi<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
