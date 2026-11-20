import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage, formatMoney } from "@/client/lib/money";
import type { CartItem, MethodView, Quote } from "@/client/store/types";

export interface OrderDetails {
  customerName: string;
  customerPhone: string;
  service: "pickup" | "delivery";
  address: string;
  scheduledFor: string;
  note: string;
  paymentMethodId: string;
  promoCode: string;
  items: { productId: string; quantity: number; optionIds: string[] }[];
}

type QuoteRequest = Pick<OrderDetails, "items" | "service" | "promoCode">;

/** Customer, service, payment and totals: the store's checkout and the counter-sale form. */
export function OrderForm({
  currency,
  items,
  onItemsChange,
  pickup,
  delivery,
  deliveryFeeCents,
  methods,
  getQuote,
  submit,
  submitLabel,
}: {
  currency: string;
  items: CartItem[];
  onItemsChange: (items: CartItem[]) => void;
  pickup: boolean;
  delivery: boolean;
  deliveryFeeCents: number;
  methods: MethodView[];
  getQuote: (request: QuoteRequest) => Promise<Quote>;
  submit: (details: OrderDetails) => Promise<void>;
  submitLabel: string;
}) {
  const [customerName, setName] = useState("");
  const [customerPhone, setPhone] = useState("");
  const [service, setService] = useState<"pickup" | "delivery">(pickup ? "pickup" : "delivery");
  const [address, setAddress] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethodId, setMethod] = useState("");
  const [promoDraft, setPromoDraft] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const lines = items.map(({ productId, quantity, optionIds }) => ({ productId, quantity, optionIds }));
  const linesKey = JSON.stringify(lines);

  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }
    let live = true;
    getQuote({ items: lines, service, promoCode })
      .then((q) => {
        if (!live) return;
        setQuote(q);
        setQuoteError(null);
      })
      .catch((cause) => {
        if (!live) return;
        if (promoCode) {
          setPromoError(errorMessage(cause));
          setPromoCode("");
        } else {
          setQuoteError(errorMessage(cause));
        }
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, service, promoCode]);

  function changeQuantity(key: string, by: number) {
    onItemsChange(
      items
        .map((i) => (i.key === key ? { ...i, quantity: Math.min(99, i.quantity + by) } : i))
        .filter((i) => i.quantity > 0),
    );
  }

  async function place() {
    setError(null);
    const missing =
      !customerName.trim() ? "Enter a name."
      : !customerPhone.trim() ? "Enter a phone number."
      : service === "delivery" && !address.trim() ? "Enter a delivery address."
      : !scheduledFor ? "Choose a date and time."
      : !paymentMethodId ? "Choose a payment method."
      : null;
    if (missing) return setError(missing);
    setPending(true);
    try {
      await submit({ customerName, customerPhone, service, address, scheduledFor, note, paymentMethodId, promoCode, items: lines });
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  const method = methods.find((m) => m.id === paymentMethodId);
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Items</h2>
        <ul data-testid="checkout-items" className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                {item.options.map((o) => (
                  <p key={o} className="text-sm text-muted-foreground">{o}</p>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`One less ${item.name}`} onClick={() => changeQuantity(item.key, -1)}>
                  {item.quantity === 1 ? <Trash2 /> : <Minus />}
                </Button>
                <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`One more ${item.name}`} onClick={() => changeQuantity(item.key, 1)}>
                  <Plus />
                </Button>
              </div>
              <span className="w-20 text-right text-sm tabular-nums">{money(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="customer-name" label="Name">
            <Input id="customer-name" value={customerName} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field id="customer-phone" label="Phone">
            <Input id="customer-phone" type="tel" value={customerPhone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Pickup or delivery</h2>
        <RadioGroup value={service} onValueChange={(v) => setService(v as "pickup" | "delivery")} className="sm:grid-cols-2">
          {pickup ? <Choice value="pickup" label="Pickup" detail="Free" /> : null}
          {delivery ? <Choice value="delivery" label="Delivery" detail={money(deliveryFeeCents)} /> : null}
        </RadioGroup>
        {service === "delivery" ? (
          <Field id="address" label="Delivery address">
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} autoComplete="street-address" />
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="scheduled-for" label="Date and time">
            <Input id="scheduled-for" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          </Field>
        </div>
        <Field id="note" label="Note (optional)">
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Payment</h2>
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment methods are turned on.</p>
        ) : (
          <RadioGroup value={paymentMethodId} onValueChange={(v) => setMethod(String(v))} className="sm:grid-cols-2">
            {methods.map((m) => (
              <Choice key={m.id} value={m.id} label={m.label} />
            ))}
          </RadioGroup>
        )}
        {method?.instructions ? (
          <p className="rounded-lg bg-muted px-4 py-3 text-sm whitespace-pre-line">{method.instructions}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Promo code</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPromoError(null);
            setPromoCode(promoDraft.trim());
          }}
        >
          <Input id="promo-code" aria-label="Promo code" value={promoDraft} onChange={(e) => setPromoDraft(e.target.value)} className="max-w-56" />
          <Button type="submit" variant="outline" data-testid="apply-promo">Apply</Button>
        </form>
        {promoError ? <p className="text-sm text-destructive" data-testid="promo-error">{promoError}</p> : null}
        {quote?.promoCode ? <p className="text-sm text-muted-foreground">{quote.promoCode} applied</p> : null}
      </section>

      <section className="space-y-3">
        <dl className="space-y-1.5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <Row label="Items" testId="summary-subtotal" value={quote ? money(quote.subtotalCents) : "—"} />
          {quote && quote.discountCents > 0 ? <Row label="Discount" testId="summary-discount" value={`-${money(quote.discountCents)}`} /> : null}
          <Row label={service === "delivery" ? "Delivery" : "Pickup"} testId="summary-fee" value={quote ? money(quote.feeCents) : "—"} />
          <Row label="Tax" testId="summary-tax" value={quote ? money(quote.taxCents) : "—"} />
          <div className="border-t border-border pt-1.5">
            <Row label="Total" testId="summary-total" value={quote ? money(quote.totalCents) : "—"} strong />
          </div>
        </dl>
        {quoteError ? (
          <Alert variant="destructive">
            <AlertDescription>{quoteError}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" data-testid="checkout-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button size="lg" className="w-full" data-testid="place-order" pending={pending} disabled={items.length === 0} onClick={place}>
          {submitLabel}
        </Button>
      </section>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Choice({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
      <RadioGroupItem value={value} aria-label={label} />
      <span className="flex-1 font-medium">{label}</span>
      {detail ? <span className="text-muted-foreground">{detail}</span> : null}
    </label>
  );
}

function Row({ label, value, testId, strong }: { label: string; value: string; testId: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums" data-testid={testId}>{value}</dd>
    </div>
  );
}
