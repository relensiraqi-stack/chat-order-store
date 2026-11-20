export function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** "4.50" as 450; null when it isn't an amount. */
export function parseMoney(text: string): number | null {
  const t = text.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function formatWhen(local: string) {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (Array.isArray(parsed) && parsed[0]?.message) return String(parsed[0].message);
    } catch {
      // not a validation list
    }
    return error.message;
  }
  return "That didn't work.";
}
