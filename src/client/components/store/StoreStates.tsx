import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Spinner } from "@/client/components/ui/spinner";

export function StoreLoading() {
  return (
    <AppShell>
      <div className="flex justify-center py-24 text-muted-foreground">
        <Spinner />
      </div>
    </AppShell>
  );
}

export function StoreMissing({ title = "Store not found" }: { title?: string }) {
  return (
    <AppShell>
      <EmptyState kind="filtered" title={title} description="Check the link you were given." />
    </AppShell>
  );
}

export function StoreError({ error }: { error: unknown }) {
  return (
    <AppShell>
      <EmptyState kind="error" title="This page couldn't load" description={error instanceof Error ? error.message : undefined} />
    </AppShell>
  );
}
