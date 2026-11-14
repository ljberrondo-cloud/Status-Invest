import type { Asset, DividendEvent } from "./types";

export interface DividendRow extends DividendEvent {
  quantity: number;
  /** Monto bruto estimado para mi cantidad actual. */
  estimated: number;
  /** Fecha relevante para el calendario (pago, o data com si no hay pago definido). */
  date: string;
}

/**
 * Proventos con data com o pago dentro de [start, end], valuados con la cantidad actual.
 * Estimación: tasa × cantidad (bruto; JCP tiene 15% de IR retenido).
 */
export function dividendsInRange(events: DividendEvent[], assets: Asset[], start: string, end: string): DividendRow[] {
  const qty = new Map(assets.map((a) => [a.ticker.toUpperCase(), a.quantity]));
  const seen = new Set<string>();
  const rows: DividendRow[] = [];
  for (const e of events) {
    const inRange = (d: string | null) => d !== null && d >= start && d <= end;
    if (!inRange(e.paymentDate) && !inRange(e.exDate)) continue;
    const key = `${e.ticker}|${e.label}|${e.rate}|${e.exDate}|${e.paymentDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const quantity = qty.get(e.ticker) ?? 0;
    rows.push({
      ...e,
      quantity,
      estimated: e.rate * quantity,
      date: inRange(e.paymentDate) ? (e.paymentDate as string) : (e.exDate as string),
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
}
