import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Inbox, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { OrderStatusBadge, PaymentStatusBadge } from "@/client/components/store/Receipt";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatMoney, formatWhen } from "@/client/lib/money";
import { getOrders } from "@/serverFunctions/orders";

const search = z.object({
  status: z.enum(["pending", "confirmed", "ready", "completed", "cancelled"]).optional().catch(undefined),
  payment: z.enum(["unpaid", "proof_submitted", "paid"]).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/stores/$storeId/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getOrders({
      data: {
        storeId: params.storeId,
        status: deps.status,
        paymentStatus: deps.payment,
        q: deps.q || undefined,
        page: deps.page ?? 1,
      },
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Orders · ${loaderData.store.name}` }] : [] }),
  errorComponent: MemberError,
  component: OrdersPage,
});

const STATUS_ITEMS = [
  { value: "all", label: "Any status" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const PAYMENT_ITEMS = [
  { value: "all", label: "Any payment" },
  { value: "unpaid", label: "Unpaid" },
  { value: "proof_submitted", label: "Proof submitted" },
  { value: "paid", label: "Paid" },
];

function OrdersPage() {
  const { store, orders, total, page, pageSize } = Route.useLoaderData();
  const filters = Route.useSearch();
  const { storeId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const [q, setQ] = useState(filters.q ?? "");
  const storePath = `/s/${store.slug}`;
  const storeUrl = typeof window === "undefined" ? storePath : `${window.location.origin}${storePath}`;

  useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const apply = () =>
      navigate({ search: (s) => ({ ...s, q: q || undefined, page: undefined }), replace: true });
    if (!q) {
      void apply();
      return;
    }
    const timer = setTimeout(() => void apply(), 250);
    return () => clearTimeout(timer);
  }, [q, filters.q, navigate]);

  const filtered = Boolean(filters.status || filters.payment || filters.q);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <StoreShell storeId={storeId}>
      <PageHeader
        title={store.name}
        description={
          <span className="inline-flex items-center gap-1">
            {store.published ? storePath : `${storePath} · unpublished`}
          </span>
        }
        actions={
          <>
            {store.published ? (
              <>
                <CopyButton value={storeUrl} successMessage="Store link copied" label="Copy link" />
                <a href={storePath} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                  <ExternalLink aria-hidden />
                  Open
                </a>
              </>
            ) : null}
            <Link to="/stores/$storeId/orders/new" params={{ storeId }} className={buttonVariants()}>
              <Plus aria-hidden />
              New order
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Input
          data-testid="order-search"
          aria-label="Search orders"
          placeholder="Number, name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-60"
        />
        <SimpleSelect
          label="Order status"
          testId="filter-status"
          items={STATUS_ITEMS}
          value={filters.status ?? "all"}
          onChange={(v) => navigate({ search: (s) => ({ ...s, status: v === "all" ? undefined : (v as typeof s.status), page: undefined }) })}
          className="w-40"
        />
        <SimpleSelect
          label="Payment status"
          testId="filter-payment"
          items={PAYMENT_ITEMS}
          value={filters.payment ?? "all"}
          onChange={(v) => navigate({ search: (s) => ({ ...s, payment: v === "all" ? undefined : (v as typeof s.payment), page: undefined }) })}
          className="w-44"
        />
      </div>

      {orders.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No orders match" description="Change the search or filters." />
        ) : (
          <EmptyState icon={Inbox} title="No orders yet" description="Orders placed at the store link, and ones you enter, show up here." />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">For</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} data-testid="order-row">
                  <TableCell className="font-medium">
                    <Link to="/stores/$storeId/orders/$orderId" params={{ storeId, orderId: order.id }} className="hover:underline">
                      #{order.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    <div>{formatWhen(order.scheduledFor)}</div>
                    <div className="text-xs text-muted-foreground">{order.service === "delivery" ? "Delivery" : "Pickup"}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(order.totalCents, order.currency)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ search: (s) => ({ ...s, page: page - 1 }) })}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate({ search: (s) => ({ ...s, page: page + 1 }) })}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </StoreShell>
  );
}
