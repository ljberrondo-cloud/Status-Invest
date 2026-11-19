/**
 * Rendimiento por cuota a partir de los proventos cobrados (extractos de B3).
 * brapi gratis no da dividendos, así que se usa lo que efectivamente se cobró.
 */
import type { ReceivedPayment } from "./received";

export interface IncomeStats {
  /** Dividend yield anual %, o null si no hay pagos recientes. */
  dy: number | null;
  /** Variación % de los últimos 3 meses pagos frente a los 3 anteriores (sólo con 6+ meses). */
  trend: number | null;
  /** Meses con pago en los últimos 12. */
  months: number;
}

function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
}

export function incomeStats(payments: ReceivedPayment[], ticker: string, price: number | null, today: string, monthly: boolean): IncomeStats {
  const from = addMonths(today, -12);
  // Mismo evento cobrado en las dos cuentas: se cuenta una vez por cuota.
  const seen = new Set<string>();
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    // Amortizaciones y reembolsos ("outro") devuelven capital: no son rendimiento.
    if (p.annual || p.type === "outro" || p.ticker !== ticker || p.unitValue === null || p.unitValue <= 0 || p.date <= from || p.date > today) continue;
    const key = `${p.date}|${p.type}|${p.unitValue.toFixed(8)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byMonth.set(p.date.slice(0, 7), (byMonth.get(p.date.slice(0, 7)) ?? 0) + p.unitValue);
  }
  const months = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  if (!months.length || !price) return { dy: null, trend: null, months: months.length };
  let perYear: number;
  if (monthly) {
    const last = months.slice(-6);
    perYear = (last.reduce((s, v) => s + v, 0) / last.length) * 12;
  } else perYear = months.reduce((s, v) => s + v, 0);
  let trend: number | null = null;
  if (monthly && months.length >= 6) {
    const recent = months.slice(-3).reduce((s, v) => s + v, 0);
    const prev = months.slice(-6, -3).reduce((s, v) => s + v, 0);
    if (prev > 0) trend = (recent / prev - 1) * 100;
  }
  return { dy: (perYear / price) * 100, trend, months: months.length };
}
