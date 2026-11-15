import type { Position } from "./types";

export type SortKey = "ticker" | "quantity" | "avg" | "price" | "change" | "gain" | "rent" | "value" | "weight";
const getter: Record<SortKey, (p: Position, extra?: Record<string, { received: number }>) => number | string | null> = {
  ticker: (p) => p.asset.ticker,
  quantity: (p) => p.asset.quantity,
  avg: (p) => p.asset.avg_price ?? null,
  gain: (p) => p.gainPct,
  rent: (p, x) => (p.cost && p.gain !== null ? ((p.gain + (x?.[p.asset.ticker]?.received ?? 0)) / p.cost) * 100 : null),
  price: (p) => p.price,
  change: (p) => p.dayChangePct,
  value: (p) => p.value,
  weight: (p) => p.weight,
};

export function sortPositions(rows: Position[], key: SortKey, dir: 1 | -1, extra?: Record<string, { received: number }>) {
  return [...rows].sort((a, b) => {
    const x = getter[key](a, extra);
    const y = getter[key](b, extra);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // sin dato siempre al final
    if (y === null) return -1;
    return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * dir;
  });
}
