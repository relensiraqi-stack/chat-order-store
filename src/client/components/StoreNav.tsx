import { Link } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import type { ReactNode } from "react";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** The frame of a store's member pages: its tabs in the bar. */
export function StoreShell({ storeId, children }: { storeId: string; children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-4 overflow-x-auto">
          <Link to="/stores/$storeId" params={{ storeId }} activeOptions={{ exact: true }} className={LINK}>
            Orders
          </Link>
          <Link to="/stores/$storeId/products" params={{ storeId }} className={LINK}>
            Products
          </Link>
          <Link to="/stores/$storeId/promos" params={{ storeId }} className={LINK}>
            Promo codes
          </Link>
          <Link to="/stores/$storeId/settings" params={{ storeId }} className={LINK}>
            Settings
          </Link>
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}

/** A member page whose data didn't load: not found, or another failure. */
export function MemberError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "";
  const missing = /not found$/i.test(message);
  return (
    <AppShell>
      <EmptyState
        kind={missing ? "filtered" : "error"}
        title={missing ? message : "This page couldn't load"}
        description={missing ? undefined : message || undefined}
        action={
          <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
            Your stores
          </Link>
        }
      />
    </AppShell>
  );
}
