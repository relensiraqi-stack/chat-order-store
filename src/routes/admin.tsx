import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { MemberError } from "@/client/components/StoreNav";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { errorMessage } from "@/client/lib/money";
import { getAllStores, unpublishStore } from "@/serverFunctions/stores";

export const Route = createFileRoute("/admin")({
  loader: () => getAllStores(),
  head: () => ({ meta: [{ title: "All stores" }] }),
  errorComponent: MemberError,
  component: AdminPage,
});

function AdminPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  return (
    <AppShell>
      <PageHeader title="All stores" backLink={<BackLink to="/">Your stores</BackLink>} />
      {!data.allowed ? (
        <EmptyState icon={ShieldX} title="Only admins can open this page." />
      ) : data.stores.length === 0 ? (
        <EmptyState title="No stores yet" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stores.map((s) => (
                <TableRow key={s.id} data-testid="admin-store-row">
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">/s/{s.slug}</div>
                  </TableCell>
                  <TableCell className="text-sm">{s.ownerEmail}</TableCell>
                  <TableCell>
                    <Badge variant={s.published ? "soft" : "outline"}>{s.published ? "Published" : "Unpublished"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.published ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="unpublish"
                        onClick={async () => {
                          try {
                            await unpublishStore({ data: { storeId: s.id } });
                            await router.invalidate();
                          } catch (cause) {
                            toast.error(errorMessage(cause));
                          }
                        }}
                      >
                        Unpublish
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
