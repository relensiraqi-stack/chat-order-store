import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { formatMoney } from "@/client/lib/money";
import type { CartItem, GroupView } from "@/client/store/types";

export interface DialogProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  groups: GroupView[];
}

/** Pick a product's options and quantity, with the price as it changes. */
export function ProductDialog({
  product,
  currency,
  onClose,
  onAdd,
}: {
  product: DialogProduct | null;
  currency: string;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, "key">) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPicked({});
    setQuantity(1);
    setError(null);
  }, [product?.id]);

  const unit = useMemo(() => {
    if (!product) return 0;
    let cents = product.priceCents;
    for (const g of product.groups)
      for (const o of g.options) if (picked[g.id]?.includes(o.id)) cents += o.priceDeltaCents;
    return Math.max(0, cents);
  }, [product, picked]);

  if (!product) return null;

  function add() {
    if (!product) return;
    const missing = product.groups.find((g) => g.required && !(picked[g.id]?.length));
    if (missing) {
      setError(`Choose ${missing.name}.`);
      return;
    }
    const labels = product.groups
      .map((g) => {
        const names = g.options.filter((o) => picked[g.id]?.includes(o.id)).map((o) => o.name);
        return names.length ? `${g.name}: ${names.join(", ")}` : null;
      })
      .filter((l): l is string => l !== null);
    onAdd({
      productId: product.id,
      quantity,
      optionIds: Object.values(picked).flat(),
      name: product.name,
      options: labels,
      unitPriceCents: unit,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          {product.description ? (
            <DialogDescription>{product.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="aspect-video w-full rounded-lg border border-border object-cover" />
        ) : null}
        {product.groups.map((group) => {
          const chosen = picked[group.id] ?? [];
          const full = group.kind === "multi" && group.maxSelect !== null && chosen.length >= group.maxSelect;
          return (
            <fieldset key={group.id} className="space-y-2">
              <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-medium">
                {group.name}
                <span className="text-xs font-normal text-muted-foreground">
                  {group.required ? "Required" : "Optional"}
                  {group.kind === "multi" && group.maxSelect !== null ? ` · up to ${group.maxSelect}` : ""}
                </span>
              </legend>
              {group.kind === "single" ? (
                <RadioGroup
                  value={chosen[0] ?? ""}
                  onValueChange={(value) => {
                    setError(null);
                    setPicked((p) => ({ ...p, [group.id]: [String(value)] }));
                  }}
                >
                  {group.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <RadioGroupItem value={o.id} aria-label={o.name} />
                      <span className="flex-1">{o.name}</span>
                      <Delta cents={o.priceDeltaCents} currency={currency} />
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="grid gap-2">
                  {group.options.map((o) => {
                    const on = chosen.includes(o.id);
                    return (
                      <label key={o.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                        <Checkbox
                          aria-label={o.name}
                          checked={on}
                          disabled={!on && full}
                          onCheckedChange={(checked) =>
                            setPicked((p) => ({
                              ...p,
                              [group.id]: checked ? [...chosen, o.id] : chosen.filter((x) => x !== o.id),
                            }))
                          }
                        />
                        <span className="flex-1">{o.name}</span>
                        <Delta cents={o.priceDeltaCents} currency={currency} />
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
        {error ? (
          <Alert variant="destructive" data-testid="option-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Fewer" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Minus />
            </Button>
            <span className="w-6 text-center text-sm tabular-nums" data-testid="dialog-quantity">{quantity}</span>
            <Button variant="outline" size="icon-sm" aria-label="More" onClick={() => setQuantity((q) => Math.min(99, q + 1))}>
              <Plus />
            </Button>
          </div>
          <Button data-testid="add-to-cart" onClick={add}>
            Add · <span data-testid="dialog-total">{formatMoney(unit * quantity, currency)}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Delta({ cents, currency }: { cents: number; currency: string }) {
  if (cents === 0) return null;
  return (
    <span className="text-muted-foreground tabular-nums">
      {cents > 0 ? "+" : "−"}
      {formatMoney(Math.abs(cents), currency)}
    </span>
  );
}
