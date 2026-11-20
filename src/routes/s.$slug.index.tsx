import { Link, createFileRoute } from "@tanstack/react-router";
import { ImageOff, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { ProductDialog } from "@/client/components/store/ProductDialog";
import { StoreError, StoreLoading, StoreMissing } from "@/client/components/store/StoreStates";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { buttonVariants } from "@/client/components/ui/button";
import { formatMoney } from "@/client/lib/money";
import { loadStorefront } from "@/client/store/api";
import { addItem, useCart } from "@/client/store/cart";
import type { ProductView } from "@/client/store/types";

// A store's public page. It runs in the browser: the cart lives there.
export const Route = createFileRoute("/s/$slug/")({
  ssr: false,
  loader: ({ params }) => loadStorefront(params.slug),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.store.name }] : [] }),
  pendingComponent: StoreLoading,
  errorComponent: StoreError,
  component: StorePage,
});

function StorePage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { items, setItems } = useCart(slug);
  const [open, setOpen] = useState<ProductView | null>(null);
  if (!data) return <StoreMissing />;
  const { store } = data;

  const sections = [
    ...data.categories.map((c) => ({ id: c.id, name: c.name, products: data.products.filter((p) => p.categoryId === c.id) })),
    { id: "other", name: data.categories.length ? "More" : "Menu", products: data.products.filter((p) => !p.categoryId || !data.categories.some((c) => c.id === p.categoryId)) },
  ].filter((s) => s.products.length > 0);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const total = items.reduce((n, i) => n + i.quantity * i.unitPriceCents, 0);

  return (
    <AppShell>
      <PageHeader title={store.name} description={store.description || undefined} />
      {!store.isOpen ? (
        <Alert data-testid="store-closed">
          <AlertDescription>This store is closed right now.</AlertDescription>
        </Alert>
      ) : null}
      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing for sale yet.</p>
      ) : null}
      {sections.map((section) => (
        <section key={section.id} data-testid="category-section" className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{section.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.products.map((product) => (
              <button
                key={product.id}
                type="button"
                data-testid="product-card"
                disabled={product.soldOut || !store.isOpen}
                onClick={() => setOpen(product)}
                className="flex gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImageOff className="size-5" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{product.name}</p>
                  {product.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                  ) : null}
                  <p className="text-sm tabular-nums">
                    {formatMoney(product.priceCents, store.currency)}
                    {product.soldOut ? <span className="ml-2 text-destructive">Sold out</span> : null}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      <ProductDialog
        product={open}
        currency={store.currency}
        onClose={() => setOpen(null)}
        onAdd={(item) => {
          setItems(addItem(items, item));
          setOpen(null);
          toast.success(`Added ${item.name}`);
        }}
      />

      {count > 0 ? (
        <div data-testid="cart-bar" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-10">
            <span className="flex items-center gap-2 text-sm">
              <ShoppingBag className="size-4" aria-hidden />
              {count} {count === 1 ? "item" : "items"} · {formatMoney(total, store.currency)}
            </span>
            <Link to="/s/$slug/checkout" params={{ slug }} data-testid="go-checkout" className={buttonVariants()}>
              Checkout
            </Link>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
