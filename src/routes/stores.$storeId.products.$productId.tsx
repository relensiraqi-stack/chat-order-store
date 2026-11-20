import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { SettingsCard, SettingsCardFooter, SettingsRow, SettingsSection } from "@/client/components/SettingsSection";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { centsToInput, errorMessage, formatMoney, parseMoney } from "@/client/lib/money";
import type { GroupView } from "@/client/store/types";
import {
  addGroup,
  addOption,
  deleteGroup,
  deleteOption,
  deleteProduct,
  getProduct,
  removeProductImage,
  updateProduct,
  uploadProductImage,
} from "@/serverFunctions/catalog";

export const Route = createFileRoute("/stores/$storeId/products/$productId")({
  loader: ({ params }) => getProduct({ data: params }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.product.name }] : [] }),
  errorComponent: MemberError,
  component: ProductPage,
});

function ProductPage() {
  const { store, product, groups, categories } = Route.useLoaderData();
  const { storeId, productId } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(centsToInput(product.priceCents));
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "none");
  const [available, setAvailable] = useState(product.available);
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const [stock, setStock] = useState(String(product.stock));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  async function save() {
    const priceCents = parseMoney(price);
    if (priceCents === null || priceCents < 0) return setError("Enter a price such as 4.50.");
    const count = Number(stock);
    if (trackStock && (!Number.isInteger(count) || count < 0)) return setError("Enter a whole number for stock.");
    setSaving(true);
    setError(null);
    try {
      await updateProduct({
        data: {
          storeId,
          productId,
          name,
          description,
          priceCents,
          categoryId: categoryId === "none" ? null : categoryId,
          available,
          trackStock,
          stock: trackStock ? count : product.stock,
        },
      });
      toast.success("Product saved");
      await router.invalidate();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("storeId", storeId);
    form.append("productId", productId);
    form.append("file", file);
    await act(() => uploadProductImage({ data: form }));
    setUploading(false);
  }

  return (
    <StoreShell storeId={storeId}>
      <PageHeader
        title={product.name}
        backLink={<BackLink to="/stores/$storeId/products" params={{ storeId }}>Products</BackLink>}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              act(async () => {
                await deleteProduct({ data: { storeId, productId } });
                await navigate({ to: "/stores/$storeId/products", params: { storeId } });
              })
            }
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        }
      />

      <SettingsSection title="Details">
        <SettingsCard>
          <SettingsRow label="Name" htmlFor="product-name">
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} className="sm:w-64" />
          </SettingsRow>
          <SettingsRow label="Description" htmlFor="product-description" stacked>
            <Textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </SettingsRow>
          <SettingsRow label={`Price (${store.currency})`} htmlFor="product-price">
            <Input id="product-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" />
          </SettingsRow>
          <SettingsRow label="Category">
            <SimpleSelect
              label="Category"
              testId="product-category"
              items={[{ value: "none", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              value={categoryId}
              onChange={setCategoryId}
              className="w-48"
            />
          </SettingsRow>
          <SettingsRow label="Available" description="Hidden from the store when off.">
            <Switch data-testid="switch-available" checked={available} onCheckedChange={setAvailable} aria-label="Available" />
          </SettingsRow>
          <SettingsRow label="Track stock" description="Sold out at zero.">
            <Switch data-testid="switch-track-stock" checked={trackStock} onCheckedChange={setTrackStock} aria-label="Track stock" />
          </SettingsRow>
          {trackStock ? (
            <SettingsRow label="In stock" htmlFor="product-stock">
              <Input id="product-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className="w-24" />
            </SettingsRow>
          ) : null}
          <SettingsCardFooter>
            {error ? <p className="mr-auto text-sm text-destructive" data-testid="form-error">{error}</p> : null}
            <Button data-testid="save-product" pending={saving} onClick={save}>
              Save product
            </Button>
          </SettingsCardFooter>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Photo">
        <SettingsCard>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            {product.imageKey ? (
              <img data-testid="product-photo" src={`/s/${store.slug}/img/${product.id}?v=${product.imageKey.slice(-8)}`} alt="" className="size-24 rounded-lg border border-border object-cover" />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                data-testid="photo-input"
                aria-label="Photo"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
                className="max-w-xs"
              />
              {product.imageKey ? (
                <Button variant="ghost" onClick={() => act(() => removeProductImage({ data: { storeId, productId } }))}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Options"
        action={
          <Button variant="outline" data-testid="add-group" onClick={() => setGroupOpen(true)}>
            <Plus aria-hidden />
            Add option group
          </Button>
        }
      >
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">No options. Add a group for sizes, flavours or add-ons.</p> : null}
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} currency={store.currency} act={act} storeId={storeId} productId={productId} />
        ))}
      </SettingsSection>

      <GroupDialog open={groupOpen} onOpenChange={setGroupOpen} storeId={storeId} productId={productId} onDone={() => router.invalidate()} />
    </StoreShell>
  );
}

function GroupCard({
  group,
  currency,
  act,
  storeId,
  productId,
}: {
  group: GroupView;
  currency: string;
  act: (work: () => Promise<unknown>) => Promise<void>;
  storeId: string;
  productId: string;
}) {
  const [name, setName] = useState("");
  const [delta, setDelta] = useState("");
  return (
    <div data-testid="option-group">
      <SettingsCard>
        <div className="flex items-center gap-2 px-5 py-3">
          <span className="font-medium">{group.name}</span>
          <Badge variant="outline">{group.kind === "single" ? "One choice" : group.maxSelect ? `Up to ${group.maxSelect}` : "Any number"}</Badge>
          {group.required ? <Badge variant="soft">Required</Badge> : null}
          <Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground hover:text-destructive" aria-label={`Delete ${group.name}`} onClick={() => act(() => deleteGroup({ data: { storeId, productId, groupId: group.id } }))}>
            <Trash2 />
          </Button>
        </div>
        {group.options.map((o) => (
          <div key={o.id} data-testid="option-row" className="flex items-center gap-3 px-5 py-2 text-sm">
            <span className="flex-1">{o.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {o.priceDeltaCents === 0 ? "No change" : `${o.priceDeltaCents > 0 ? "+" : "−"}${formatMoney(Math.abs(o.priceDeltaCents), currency)}`}
            </span>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${o.name}`} onClick={() => act(() => deleteOption({ data: { storeId, productId, optionId: o.id } }))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <form
          className="flex flex-wrap gap-2 px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const priceDeltaCents = delta.trim() ? parseMoney(delta) : 0;
            if (!name.trim()) return;
            if (priceDeltaCents === null) return void toast.error("Enter a price change such as 1.50 or -2.00.");
            void act(async () => {
              await addOption({ data: { storeId, productId, groupId: group.id, name, priceDeltaCents } });
              setName("");
              setDelta("");
            });
          }}
        >
          <Input aria-label="Option name" placeholder="Option" value={name} onChange={(e) => setName(e.target.value)} className="max-w-48" />
          <Input aria-label="Price change" placeholder="0.00" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)} className="w-28" />
          <Button type="submit" variant="outline" data-testid="add-option">
            Add option
          </Button>
        </form>
      </SettingsCard>
    </div>
  );
}

function GroupDialog({ open, onOpenChange, storeId, productId, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string; productId: string; onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"single" | "multi">("single");
  const [required, setRequired] = useState(false);
  const [max, setMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Option group</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const maxSelect = kind === "multi" && max.trim() ? Number(max) : null;
            if (maxSelect !== null && (!Number.isInteger(maxSelect) || maxSelect < 1)) return setError("Enter a whole number of 1 or more.");
            setPending(true);
            setError(null);
            try {
              await addGroup({ data: { storeId, productId, name, kind, required, maxSelect } });
              await onDone();
              onOpenChange(false);
              setName("");
              setKind("single");
              setRequired(false);
              setMax("");
            } catch (cause) {
              setError(errorMessage(cause));
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" placeholder="Size" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Customers choose</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as "single" | "multi")} className="grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <RadioGroupItem value="single" aria-label="One" />
                One
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <RadioGroupItem value="multi" aria-label="Several" />
                Several
              </label>
            </RadioGroup>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            Required
            <Switch data-testid="switch-group-required" checked={required} onCheckedChange={setRequired} aria-label="Required" />
          </label>
          {kind === "multi" ? (
            <div className="space-y-1.5">
              <Label htmlFor="group-max">Most a customer can pick (optional)</Label>
              <Input id="group-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} className="w-24" />
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" data-testid="save-group" pending={pending}>
              Add group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
