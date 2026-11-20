import { createFileRoute, useRouter } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/client/components/CopyButton";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { Receipt } from "@/client/components/store/Receipt";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/client/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { errorMessage, formatWhen } from "@/client/lib/money";
import { getOrder, setOrderStatus, setPaymentStatus } from "@/serverFunctions/orders";

export const Route = createFileRoute("/stores/$storeId/orders/$orderId")({
  loader: ({ params }) => getOrder({ data: params }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Order #${loaderData.number}` }] : [] }),
  errorComponent: MemberError,
  component: OrderPage,
});

const NEXT = {
  pending: { status: "confirmed", label: "Confirm" },
  confirmed: { status: "ready", label: "Mark ready" },
  ready: { status: "completed", label: "Complete" },
} as const;

function OrderPage() {
  const order = Route.useLoaderData();
  const { storeId, orderId } = Route.useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  const next = NEXT[order.status as keyof typeof NEXT];
  const open = order.status !== "completed" && order.status !== "cancelled";
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/s/${order.store.slug}/o/${order.token}`;

  return (
    <StoreShell storeId={storeId}>
      <PageHeader
        title={`Order #${order.number}`}
        description={`${order.source === "manual" ? "Entered by hand" : "Online"} · ${formatWhen(order.createdAt.replace(" ", "T") + "Z")}`}
        backLink={<BackLink to="/stores/$storeId" params={{ storeId }}>Orders</BackLink>}
        actions={
          <>
            {link ? <CopyButton value={link} successMessage="Customer link copied" label="Copy customer link" /> : null}
            {next ? (
              <Button pending={busy === "next"} onClick={() => run("next", () => setOrderStatus({ data: { storeId, orderId, status: next.status } }))}>
                {next.label}
              </Button>
            ) : null}
            {open ? (
              <Button variant="outline" data-testid="cancel-order" onClick={() => setConfirmCancel(true)}>
                Cancel order
              </Button>
            ) : null}
          </>
        }
      />
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Receipt
        order={order}
        paymentExtra={
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {order.hasProof ? (
              <a href={`/files/proof/${orderId}`} target="_blank" rel="noreferrer" data-testid="proof-link" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <FileText aria-hidden />
                View proof
              </a>
            ) : null}
            {order.paymentStatus !== "paid" ? (
              <Button size="sm" data-testid="mark-paid" pending={busy === "paid"} onClick={() => run("paid", () => setPaymentStatus({ data: { storeId, orderId, action: "paid" } }))}>
                Mark paid
              </Button>
            ) : null}
            {order.paymentStatus === "proof_submitted" ? (
              <Button size="sm" variant="outline" data-testid="reject-proof" pending={busy === "reject"} onClick={() => run("reject", () => setPaymentStatus({ data: { storeId, orderId, action: "reject" } }))}>
                Reject proof
              </Button>
            ) : null}
          </div>
        }
      />
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.number}?</AlertDialogTitle>
            <AlertDialogDescription>Tracked stock and any promo code use are given back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="confirm-cancel"
              onClick={() => {
                setConfirmCancel(false);
                void run("cancel", () => setOrderStatus({ data: { storeId, orderId, status: "cancelled" } }));
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StoreShell>
  );
}
