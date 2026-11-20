import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { OrderForm } from "@/client/components/store/OrderForm";
import { StoreError, StoreLoading, StoreMissing } from "@/client/components/store/StoreStates";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { loadStorefront, postJson } from "@/client/store/api";
import { clearCart, useCart } from "@/client/store/cart";
import type { Quote } from "@/client/store/types";

export const Route = createFileRoute("/s/$slug/checkout")({
  ssr: false,
  loader: ({ params }) => loadStorefront(params.slug),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Checkout · ${loaderData.store.name}` }] : [] }),
  pendingComponent: StoreLoading,
  errorComponent: StoreError,
  component: CheckoutPage,
});

function CheckoutPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { items, setItems } = useCart(slug);
  const navigate = useNavigate();
  if (!data) return <StoreMissing />;
  const { store } = data;
  const ready = store.isOpen && (store.pickupEnabled || store.deliveryEnabled) && data.paymentMethods.length > 0;

  return (
    <AppShell>
      <PageHeader
        title="Checkout"
        description={store.name}
        backLink={<BackLink to="/s/$slug" params={{ slug }}>Back to the store</BackLink>}
      />
      {!ready ? (
        <Alert data-testid="store-closed">
          <AlertDescription>This store isn't taking orders right now.</AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your cart is empty.{" "}
          <Link to="/s/$slug" params={{ slug }} className="text-primary underline-offset-4 hover:underline">
            Browse the store
          </Link>
        </p>
      ) : (
        <OrderForm
          currency={store.currency}
          items={items}
          onItemsChange={setItems}
          pickup={store.pickupEnabled}
          delivery={store.deliveryEnabled}
          deliveryFeeCents={store.deliveryFeeCents}
          methods={data.paymentMethods}
          getQuote={(request) => postJson<Quote>(`/s/${slug}/api/quote`, request)}
          submitLabel="Place order"
          submit={async (details) => {
            const placed = await postJson<{ token: string }>(`/s/${slug}/api/checkout`, details);
            clearCart(slug);
            await navigate({ to: "/s/$slug/o/$token", params: { slug, token: placed.token } });
          }}
        />
      )}
    </AppShell>
  );
}
