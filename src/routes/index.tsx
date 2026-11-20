import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Store } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { MemberError } from "@/client/components/StoreNav";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/money";
import { createStore, getStores } from "@/serverFunctions/stores";

export const Route = createFileRoute("/")({
  loader: () => getStores(),
  head: () => ({ meta: [{ title: "Stores · Chat Order Store" }] }),
  errorComponent: MemberError,
  component: StoresPage,
});

function StoresPage() {
  const { stores, isAdmin } = Route.useLoaderData();
  const [open, setOpen] = useState(false);

  return (
    <AppShell>
      <PageHeader
        title="Stores"
        actions={
          <>
            {isAdmin ? (
              <Link to="/admin" className={buttonVariants({ variant: "outline" })}>
                All stores
              </Link>
            ) : null}
            <Button data-testid="new-store" onClick={() => setOpen(true)}>
              <Plus aria-hidden />
              New store
            </Button>
          </>
        }
      />
      {stores.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No stores yet"
          description="Create a store, add products, then share its link with customers."
          action={<Button onClick={() => setOpen(true)}>New store</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stores.map((store) => (
            <li key={store.id} data-testid="store-card">
              <Link
                to="/stores/$storeId"
                params={{ storeId: store.id }}
                className="block space-y-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{store.name}</span>
                  <Badge variant={store.published ? "soft" : "outline"}>
                    {store.published ? (store.isOpen ? "Open" : "Closed") : "Unpublished"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">/s/{store.slug}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewStoreDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function NewStoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New store</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            try {
              const { id } = await createStore({ data: { name, slug, currency } });
              await navigate({ to: "/stores/$storeId", params: { storeId: id } });
            } catch (cause) {
              setError(errorMessage(cause));
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="store-name">Name</Label>
            <Input
              id="store-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-slug">Link</Label>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>/s/</span>
              <Input
                id="store-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value);
                }}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-currency">Currency</Label>
            <Input id="store-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="w-24 uppercase" required />
          </div>
          {error ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" data-testid="create-store" pending={pending}>
              Create store
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
