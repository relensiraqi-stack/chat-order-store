import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { OrderForm } from "@/client/components/store/OrderForm";
import { ProductDialog, type DialogProduct } from "@/client/components/store/ProductDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { formatMoney } from "@/client/lib/money";
import { addItem } from "@/client/store/cart";
import type { CartItem } from "@/client/store/types";
import { createCounterOrder, getCounterCatalog, quoteCounterOrder } from "@/serverFunctions/orders";

// An order taken by phone or at the counter, priced by checkout's rules.
export const Route = createFileRoute("/stores/$storeId/orders/new")({
  loader: ({ params }) => getCounterCatalog({ data: params }),
  head: () => ({ meta: [{ title: "New order" }] }),
  errorComponent: MemberError,
  component: NewOrderPage,
});

function NewOrderPage() {
  const { store, products, methods } = Route.useLoaderData();
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState<DialogProduct | null>(null);
  const sellable = products.filter((p) => p.available);
  const ready = (store.pickupEnabled || store.deliveryEnabled) && methods.length > 0;

  return (
    <StoreShell storeId={storeId}>
      <PageHeader title="New order" description={store.name} backLink={<BackLink to="/stores/$storeId" params={{ storeId }}>Orders</BackLink>} />
      {!ready ? (
        <Alert>
          <AlertDescription>Turn on pickup or delivery and a payment method in Settings first.</AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Products</h2>
            {sellable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products for sale yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {sellable.map((p) => {
                  const soldOut = p.trackStock && p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid="product-card"
                      disabled={soldOut}
                      onClick={() =>
                        setOpen({ ...p, imageUrl: p.imageKey ? `/s/${store.slug}/img/${p.id}` : null })
                      }
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-60"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {soldOut ? "Sold out" : formatMoney(p.priceCents, store.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          {items.length > 0 ? (
            <OrderForm
              currency={store.currency}
              items={items}
              onItemsChange={setItems}
              pickup={store.pickupEnabled}
              delivery={store.deliveryEnabled}
              deliveryFeeCents={store.deliveryFeeCents}
              methods={methods}
              getQuote={(request) => quoteCounterOrder({ data: { storeId, ...request } })}
              submitLabel="Create order"
              submit={async (details) => {
                const placed = await createCounterOrder({ data: { storeId, ...details } });
                await navigate({ to: "/stores/$storeId/orders/$orderId", params: { storeId, orderId: placed.id } });
              }}
            />
          ) : null}
        </>
      )}
      <ProductDialog
        product={open}
        currency={store.currency}
        onClose={() => setOpen(null)}
        onAdd={(item) => {
          setItems((current) => addItem(current, item));
          setOpen(null);
        }}
      />
    </StoreShell>
  );
}
