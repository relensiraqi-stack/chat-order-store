import type { ReactNode } from "react";
import { Badge } from "@/client/components/ui/badge";
import { formatMoney, formatWhen } from "@/client/lib/money";

export interface ReceiptData {
  number: number;
  status: string;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  service: "pickup" | "delivery";
  address: string;
  scheduledFor: string;
  note: string;
  currency: string;
  subtotalCents: number;
  feeCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  promoCode: string | null;
  payment: { kind: string; label: string; instructions: string; requireProof: boolean };
  items: { name: string; options: string[]; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
  store: { name: string; slug: string; phone: string };
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "Unpaid",
  proof_submitted: "Proof submitted",
  paid: "Paid",
};

export function OrderStatusBadge({ status, testId }: { status: string; testId?: string }) {
  const variant = status === "cancelled" ? "destructive" : status === "completed" ? "secondary" : "soft";
  return (
    <Badge variant={variant} data-testid={testId}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, testId }: { status: string; testId?: string }) {
  const variant = status === "paid" ? "secondary" : status === "proof_submitted" ? "soft" : "outline";
  return (
    <Badge variant={variant} data-testid={testId}>
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** The order as both the customer and the store see it. */
export function Receipt({ order, paymentExtra }: { order: ReceiptData; paymentExtra?: ReactNode }) {
  const money = (cents: number) => formatMoney(cents, order.currency);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Order</span>
        <OrderStatusBadge status={order.status} testId="order-status" />
        <span className="ml-2 text-muted-foreground">Payment</span>
        <PaymentStatusBadge status={order.paymentStatus} testId="payment-status" />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <ul data-testid="receipt-items" className="divide-y divide-border">
          {order.items.map((item, i) => (
            <li key={i} className="flex gap-3 px-4 py-3 text-sm">
              <span className="w-8 text-muted-foreground tabular-nums">{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                {item.options.map((o) => (
                  <p key={o} className="text-muted-foreground">{o}</p>
                ))}
              </div>
              <span className="tabular-nums">{money(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
          <Line label="Items" value={money(order.subtotalCents)} />
          {order.discountCents > 0 ? (
            <Line label={order.promoCode ? `Discount (${order.promoCode})` : "Discount"} value={`-${money(order.discountCents)}`} />
          ) : null}
          {order.service === "delivery" ? <Line label="Delivery" value={money(order.feeCents)} /> : null}
          {order.taxCents > 0 ? <Line label="Tax" value={money(order.taxCents)} /> : null}
          <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="order-total">{money(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section data-testid="receipt-service" className="grid gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm sm:grid-cols-2">
        <Detail label="Customer">
          {order.customerName}
          <br />
          {order.customerPhone}
        </Detail>
        <Detail label={order.service === "delivery" ? "Delivery" : "Pickup"}>
          {formatWhen(order.scheduledFor)}
          {order.service === "delivery" ? (
            <>
              <br />
              <span className="whitespace-pre-line">{order.address}</span>
            </>
          ) : null}
        </Detail>
        {order.note ? <Detail label="Note">{order.note}</Detail> : null}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <Detail label="Payment">{order.payment.label}</Detail>
        {order.payment.instructions ? (
          <p data-testid="payment-instructions" className="rounded-lg bg-muted px-3 py-2 whitespace-pre-line">
            {order.payment.instructions}
          </p>
        ) : null}
        {paymentExtra}
      </section>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
      <p>{children}</p>
    </div>
  );
}

/** The plain-text order a customer sends the store in a chat. */
export function orderMessage(order: ReceiptData, link: string) {
  const money = (cents: number) => formatMoney(cents, order.currency);
  const lines = [`${order.store.name}: Order #${order.number}`, ""];
  for (const item of order.items) {
    lines.push(`${item.quantity} × ${item.name} — ${money(item.lineTotalCents)}`);
    for (const o of item.options) lines.push(`   ${o}`);
  }
  lines.push("", `Items: ${money(order.subtotalCents)}`);
  if (order.discountCents > 0) lines.push(`Discount${order.promoCode ? ` (${order.promoCode})` : ""}: -${money(order.discountCents)}`);
  if (order.service === "delivery") lines.push(`Delivery: ${money(order.feeCents)}`);
  if (order.taxCents > 0) lines.push(`Tax: ${money(order.taxCents)}`);
  lines.push(`Total: ${money(order.totalCents)}`, "");
  lines.push(`Name: ${order.customerName}`, `Phone: ${order.customerPhone}`);
  lines.push(`${order.service === "delivery" ? "Delivery" : "Pickup"}: ${formatWhen(order.scheduledFor)}`);
  if (order.service === "delivery") lines.push(`Address: ${order.address}`);
  if (order.note) lines.push(`Note: ${order.note}`);
  lines.push(`Payment: ${order.payment.label}`, "", link);
  return lines.join("\n");
}

/** A chat link to the store's number with the message filled in. */
export function chatLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
