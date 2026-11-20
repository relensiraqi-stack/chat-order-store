import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SettingsCard, SettingsSection } from "@/client/components/SettingsSection";
import { MemberError, StoreShell } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage, formatMoney, parseMoney } from "@/client/lib/money";
import {
  createCategory,
  createProduct,
  deleteCategory,
  getCatalog,
  moveCategory,
  moveProduct,
} from "@/serverFunctions/catalog";

export const Route = createFileRoute("/stores/$storeId/products/")({
  loader: ({ params }) => getCatalog({ data: params }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Products · ${loaderData.store.name}` }] : [] }),
  errorComponent: MemberError,
  component: ProductsPage,
});

function ProductsPage() {
  const { store, categories, products } = Route.useLoaderData();
  const { storeId } = Route.useParams();
  const router = useRouter();
  const [categoryName, setCategoryName] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  }

  const categoryName_ = (id: string | null) => categories.find((c) => c.id === id)?.name;

  return (
    <StoreShell storeId={storeId}>
      <PageHeader
        title="Products"
        description={store.name}
        actions={
          <Button data-testid="new-product" onClick={() => setNewOpen(true)}>
            <Plus aria-hidden />
            New product
          </Button>
        }
      />

      <SettingsSection title="Categories">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = categoryName.trim();
            if (!name) return;
            void act(async () => {
              await createCategory({ data: { storeId, name } });
              setCategoryName("");
            });
          }}
        >
          <Input id="category-name" aria-label="Category name" placeholder="New category" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="max-w-64" />
          <Button type="submit" variant="outline" data-testid="add-category">
            Add category
          </Button>
        </form>
        {categories.length > 0 ? (
          <SettingsCard>
            {categories.map((c, i) => (
              <div key={c.id} data-testid="category-row" className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="flex-1">{c.name}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => act(() => moveCategory({ data: { storeId, itemId: c.id, direction: "up" } }))}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${c.name} down`} disabled={i === categories.length - 1} onClick={() => act(() => moveCategory({ data: { storeId, itemId: c.id, direction: "down" } }))}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => act(() => deleteCategory({ data: { storeId, categoryId: c.id } }))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </SettingsCard>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Products">
        {products.length === 0 ? (
          <EmptyState icon={Package} title="No products yet" action={<Button onClick={() => setNewOpen(true)}>New product</Button>} />
        ) : (
          <SettingsCard>
            {products.map((p, i) => (
              <div key={p.id} data-testid="product-row" className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <Link to="/stores/$storeId/products/$productId" params={{ storeId, productId: p.id }} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{categoryName_(p.categoryId) ?? "No category"}</div>
                </div>
                {!p.available ? <Badge variant="outline">Hidden</Badge> : null}
                {p.trackStock ? (
                  p.stock <= 0 ? <Badge variant="destructive">Sold out</Badge> : <Badge variant="secondary">{p.stock} left</Badge>
                ) : null}
                <span className="w-20 text-right tabular-nums">{formatMoney(p.priceCents, store.currency)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => act(() => moveProduct({ data: { storeId, itemId: p.id, direction: "up" } }))}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${p.name} down`} disabled={i === products.length - 1} onClick={() => act(() => moveProduct({ data: { storeId, itemId: p.id, direction: "down" } }))}>
                  <ArrowDown />
                </Button>
              </div>
            ))}
          </SettingsCard>
        )}
      </SettingsSection>

      <NewProductDialog open={newOpen} onOpenChange={setNewOpen} storeId={storeId} currency={store.currency} />
    </StoreShell>
  );
}

function NewProductDialog({ open, onOpenChange, storeId, currency }: { open: boolean; onOpenChange: (o: boolean) => void; storeId: string; currency: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const priceCents = parseMoney(price);
            if (priceCents === null || priceCents < 0) return setError("Enter a price such as 4.50.");
            setPending(true);
            setError(null);
            try {
              const { id } = await createProduct({ data: { storeId, name, priceCents } });
              await navigate({ to: "/stores/$storeId/products/$productId", params: { storeId, productId: id } });
            } catch (cause) {
              setError(errorMessage(cause));
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-product-name">Name</Label>
            <Input id="new-product-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-product-price">Price ({currency})</Label>
            <Input id="new-product-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" required />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" data-testid="create-product" pending={pending}>
              Create product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
