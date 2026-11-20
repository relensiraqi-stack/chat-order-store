import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus, TicketPercent, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Switch } from "@/client/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { errorMessage, formatMoney, parseMoney } from "@/client/lib/money";
import { createPromo, deletePromo, getPromos, setPromoActive } from "@/serverFunctions/promos";

export const Route = createFileRoute("/stores/$storeId/promos")({
  loader: ({ params }) => getPromos({ data: params }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Promo codes · ${loaderData.store.name}` }] : [] }),
  errorComponent: MemberError,
  component: PromosPage,
});

function PromosPage() {
  const { store, promos } = Route.useLoaderData();
  const { storeId } = Route.useParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const money = (cents: number) => formatMoney(cents, store.currency);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  return (
    <StoreShell storeId={storeId}>
      <PageHeader
        title="Promo codes"
        description={store.name}
        actions={
          <Button data-testid="new-promo" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            New promo code
          </Button>
        }
      />
      {promos.length === 0 ? (
        <EmptyState icon={TicketPercent} title="No promo codes yet" description="Create one and customers can enter it at checkout." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Used</TableHead>
                <TableHead className="hidden sm:table-cell">Ends</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((p) => (
                <TableRow key={p.id} data-testid="promo-row">
                  <TableCell className="font-mono font-medium">{p.code}</TableCell>
                  <TableCell>
                    {p.kind === "percent" ? `${p.value / 100}%` : money(p.value)}
                    {p.minSubtotalCents ? <div className="text-xs text-muted-foreground">Over {money(p.minSubtotalCents)}</div> : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{p.maxUses ? `${p.uses} / ${p.maxUses}` : p.uses}</TableCell>
                  <TableCell className="hidden sm:table-cell">{p.endsAt ?? "—"}</TableCell>
                  <TableCell>
                    <Switch checked={p.active} aria-label={`${p.code} active`} onCheckedChange={(active) => act(() => setPromoActive({ data: { storeId, promoId: p.id, active } }))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${p.code}`} onClick={() => act(() => deletePromo({ data: { storeId, promoId: p.id } }))}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PromoDialog open={open} onOpenChange={setOpen} storeId={storeId} currency={store.currency} onDone={() => router.invalidate()} />
    </StoreShell>
  );
}

function PromoDialog({ open, onOpenChange, storeId, currency, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string; currency: string; onDone: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [min, setMin] = useState("");
  const [limit, setLimit] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const amount = parseMoney(value);
    if (amount === null || amount <= 0) return setError(kind === "percent" ? "Enter a percentage such as 10." : "Enter an amount such as 5.00.");
    const minSubtotalCents = min.trim() ? parseMoney(min) : null;
    if (min.trim() && (minSubtotalCents === null || minSubtotalCents < 0)) return setError("Enter a minimum such as 20.00.");
    const maxUses = limit.trim() ? Number(limit) : null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return setError("Enter a whole number of uses.");
    setPending(true);
    setError(null);
    try {
      await createPromo({ data: { storeId, code, kind, value: amount, minSubtotalCents, maxUses, endsAt: endsAt || null } });
      await onDone();
      onOpenChange(false);
      setCode("");
      setValue("");
      setMin("");
      setLimit("");
      setEndsAt("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New promo code</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="promo-code">Code</Label>
            <Input id="promo-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase" required />
          </div>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as "percent" | "fixed")} className="grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <RadioGroupItem value="percent" aria-label="Percent" />
              Percent
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <RadioGroupItem value="fixed" aria-label="Fixed amount" />
              Fixed amount
            </label>
          </RadioGroup>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-value">{kind === "percent" ? "Percent off" : `Amount off (${currency})`}</Label>
              <Input id="promo-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-min">Minimum order (optional)</Label>
              <Input id="promo-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-limit">Usage limit (optional)</Label>
              <Input id="promo-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-ends">Last day (optional)</Label>
              <Input id="promo-ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" data-testid="save-promo" pending={pending}>
              Create code
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
