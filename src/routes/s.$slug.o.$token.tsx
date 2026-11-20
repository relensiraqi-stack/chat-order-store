import { createFileRoute, useRouter } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import { Receipt, chatLink, orderMessage, type ReceiptData } from "@/client/components/store/Receipt";
import { StoreError, StoreLoading, StoreMissing } from "@/client/components/store/StoreStates";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { errorMessage } from "@/client/lib/money";
import { storeApi } from "@/client/store/api";

// A customer's order, at its private link.
export const Route = createFileRoute("/s/$slug/o/$token")({
  ssr: false,
  loader: async ({ params }) => {
    const response = await fetch(`/s/${encodeURIComponent(params.slug)}/api/o/${encodeURIComponent(params.token)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("The order couldn't be loaded.");
    return (await response.json()) as ReceiptData;
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Order #${loaderData.number} · ${loaderData.store.name}` }] : [] }),
  pendingComponent: StoreLoading,
  errorComponent: StoreError,
  component: OrderPage,
});

function OrderPage() {
  const order = Route.useLoaderData();
  if (!order) return <StoreMissing title="Order not found" />;
  const link = typeof window === "undefined" ? "" : window.location.href;
  const message = orderMessage(order, link);
  const chat = chatLink(order.store.phone, message);
  const wantsProof = order.payment.kind !== "cash" && order.status !== "cancelled";

  return (
    <AppShell>
      <PageHeader title={`Order #${order.number}`} description={order.store.name} />
      <Receipt
        order={order}
        paymentExtra={
          wantsProof && order.paymentStatus === "unpaid" ? (
            <ProofUpload required={order.payment.requireProof} />
          ) : wantsProof && order.paymentStatus === "proof_submitted" ? (
            <p className="text-muted-foreground">Proof sent. The store will confirm your payment.</p>
          ) : null
        }
      />
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Send the order to the store</h2>
        <pre data-testid="order-message" className="overflow-x-auto rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm whitespace-pre-wrap">
          {message}
        </pre>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={message} successMessage="Order copied" label="Copy message" />
          {chat ? (
            <a href={chat} target="_blank" rel="noreferrer" data-testid="open-chat" className={buttonVariants()}>
              <MessageCircle aria-hidden />
              Send in chat
            </a>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function ProofUpload({ required }: { required: boolean }) {
  const { slug, token } = Route.useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function upload() {
    if (!file) return setError("Choose a file.");
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await storeApi(`/s/${slug}/api/o/${token}/proof`, { method: "POST", body: form });
      await router.invalidate({ filter: (match) => match.routeId === Route.id });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="font-medium">{required ? "Upload your payment proof" : "Upload a payment proof (optional)"}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="file"
          data-testid="proof-input"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-xs"
        />
        <Button data-testid="upload-proof" pending={pending} onClick={upload}>
          Upload
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">An image or PDF, up to 10 MB.</p>
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
