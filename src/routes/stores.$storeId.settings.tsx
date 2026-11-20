import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/client/components/PageHeader";
import { SettingsCard, SettingsRow, SettingsSection } from "@/client/components/SettingsSection";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { centsToInput, errorMessage, parseMoney } from "@/client/lib/money";
import { getStoreSettings, updateStore } from "@/serverFunctions/stores";

export const Route = createFileRoute("/stores/$storeId/settings")({
  loader: ({ params }) => getStoreSettings({ data: params }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Settings · ${loaderData.store.name}` }] : [] }),
  errorComponent: MemberError,
  component: SettingsPage,
});

const KIND_TITLE = { bank: "Bank transfer", qr: "QR payment", cash: "Cash" } as const;

function SettingsPage() {
  const { store, methods: savedMethods } = Route.useLoaderData();
  const { storeId } = Route.useParams();
  const router = useRouter();
  const [name, setName] = useState(store.name);
  const [slug, setSlug] = useState(store.slug);
  const [description, setDescription] = useState(store.description);
  const [currency, setCurrency] = useState(store.currency);
  const [phone, setPhone] = useState(store.phone);
  const [isOpen, setIsOpen] = useState(store.isOpen);
  const [published, setPublished] = useState(store.published);
  const [pickupEnabled, setPickup] = useState(store.pickupEnabled);
  const [deliveryEnabled, setDelivery] = useState(store.deliveryEnabled);
  const [fee, setFee] = useState(centsToInput(store.deliveryFeeCents));
  const [tax, setTax] = useState(String(store.taxBps / 100));
  const [methods, setMethods] = useState(savedMethods);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canCheckout = (pickupEnabled || deliveryEnabled) && methods.some((m) => m.enabled);

  async function save() {
    const deliveryFeeCents = parseMoney(fee);
    if (deliveryFeeCents === null || deliveryFeeCents < 0) return setError("Enter a delivery fee such as 4.50.");
    const taxBps = parseMoney(tax);
    if (taxBps === null || taxBps < 0 || taxBps > 10000) return setError("Enter a tax rate between 0 and 100.");
    setPending(true);
    setError(null);
    try {
      await updateStore({
        data: {
          storeId,
          name,
          slug,
          description,
          currency,
          phone,
          isOpen,
          published,
          pickupEnabled,
          deliveryEnabled,
          deliveryFeeCents,
          taxBps,
          methods: methods.map(({ id, label, instructions, requireProof, enabled }) => ({ id, label, instructions, requireProof, enabled })),
        },
      });
      toast.success("Settings saved");
      await router.invalidate();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <StoreShell storeId={storeId}>
      <PageHeader title="Settings" description={store.name} />

      <SettingsSection title="Store">
        <SettingsCard>
          <SettingsRow label="Name" htmlFor="store-name">
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} className="sm:w-64" />
          </SettingsRow>
          <SettingsRow label="Link" htmlFor="store-slug">
            <span className="text-sm text-muted-foreground">/s/</span>
            <Input id="store-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="sm:w-56" />
          </SettingsRow>
          <SettingsRow label="Description" htmlFor="store-description" stacked>
            <Textarea id="store-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </SettingsRow>
          <SettingsRow label="Currency" htmlFor="store-currency">
            <Input id="store-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-24 uppercase" />
          </SettingsRow>
          <SettingsRow label="Chat number" description="Include the country code." htmlFor="store-phone">
            <Input id="store-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="sm:w-56" />
          </SettingsRow>
          <SettingsRow label="Published" description="Anyone with the link can see the store.">
            <Switch data-testid="switch-published" checked={published} onCheckedChange={setPublished} aria-label="Published" />
          </SettingsRow>
          <SettingsRow label="Open for orders">
            <Switch data-testid="switch-open" checked={isOpen} onCheckedChange={setIsOpen} aria-label="Open for orders" />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Pickup, delivery and tax">
        <SettingsCard>
          <SettingsRow label="Pickup">
            <Switch data-testid="switch-pickup" checked={pickupEnabled} onCheckedChange={setPickup} aria-label="Pickup" />
          </SettingsRow>
          <SettingsRow label="Delivery">
            <Switch data-testid="switch-delivery" checked={deliveryEnabled} onCheckedChange={setDelivery} aria-label="Delivery" />
          </SettingsRow>
          {deliveryEnabled ? (
            <SettingsRow label={`Delivery fee (${currency})`} htmlFor="delivery-fee">
              <Input id="delivery-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className="w-28" />
            </SettingsRow>
          ) : null}
          <SettingsRow label="Tax (%)" description="Charged on the items." htmlFor="tax-percent">
            <Input id="tax-percent" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} className="w-24" />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Payment methods">
        {methods.map((m, i) => {
          const update = (change: Partial<typeof m>) => setMethods((all) => all.map((x, j) => (j === i ? { ...x, ...change } : x)));
          return (
            <div key={m.id} data-testid={`method-${m.kind}`}>
              <SettingsCard>
                <SettingsRow label={KIND_TITLE[m.kind]}>
                  <Switch data-testid={`switch-method-${m.kind}`} checked={m.enabled} onCheckedChange={(enabled) => update({ enabled })} aria-label={`${KIND_TITLE[m.kind]} on`} />
                </SettingsRow>
                {m.enabled ? (
                  <>
                    <div className="grid gap-4 px-5 py-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`label-${m.kind}`}>Label</Label>
                        <Input id={`label-${m.kind}`} value={m.label} onChange={(e) => update({ label: e.target.value })} className="sm:w-64" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`instructions-${m.kind}`}>Instructions</Label>
                        <Textarea id={`instructions-${m.kind}`} value={m.instructions} onChange={(e) => update({ instructions: e.target.value })} rows={2} placeholder={m.kind === "cash" ? "Pay when you collect." : "Account name and number, or where to scan."} />
                      </div>
                    </div>
                    {m.kind !== "cash" ? (
                      <SettingsRow label="Ask for payment proof">
                        <Switch data-testid={`switch-proof-${m.kind}`} checked={m.requireProof} onCheckedChange={(requireProof) => update({ requireProof })} aria-label="Ask for payment proof" />
                      </SettingsRow>
                    ) : null}
                  </>
                ) : null}
              </SettingsCard>
            </div>
          );
        })}
      </SettingsSection>

      {!canCheckout ? (
        <Alert>
          <AlertDescription>Customers can't check out until pickup or delivery and a payment method are on.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button data-testid="save-settings" pending={pending} onClick={save}>
          Save settings
        </Button>
      </div>
    </StoreShell>
  );
}
