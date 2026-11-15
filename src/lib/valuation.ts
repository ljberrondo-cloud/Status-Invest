/**
 * Lógica pura de valuación. Sin I/O: recibe activos y cotizaciones, devuelve números.
 * Toda la app (UI, API, snapshot) pasa por acá.
 */
import { ASSET_CLASSES, CLASS_LABELS, type Asset, type AssetClass, type ClassSummary, type Position, type PositionStatus, type Quote, type Valuation } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Variación en R$ de una posición a partir de la cotización. null si no se conoce. */
export function positionDayChange(quantity: number, q: Quote): number | null {
  if (q.kind === "manual" || q.kind === "fallback") return null;
  if (q.previousClose !== null && q.previousClose > 0) return quantity * (q.price - q.previousClose);
  if (q.changePct !== null) {
    const value = quantity * q.price;
    return value - value / (1 + q.changePct / 100);
  }
  return null;
}

function statusOf(q: Quote | null): PositionStatus {
  if (!q) return "missing";
  if (q.kind === "manual") return "manual";
  if (q.kind === "fallback") return "stale";
  return "fresh";
}

export function valuePosition(asset: Asset, quote: Quote | null): Position {
  const cost = typeof asset.avg_price === "number" && asset.avg_price > 0 ? asset.quantity * asset.avg_price : null;
  if (!quote) {
    return { asset, quote: null, price: null, value: null, dayChange: null, dayChangePct: null, weight: null, status: "missing", cost, gain: null, gainPct: null };
  }
  const value = asset.quantity * quote.price;
  const gain = cost !== null ? value - cost : null;
  const dayChange = positionDayChange(asset.quantity, quote);
  const base = dayChange !== null ? value - dayChange : null;
  return {
    asset,
    quote,
    price: quote.price,
    value,
    dayChange,
    dayChangePct: dayChange !== null && base ? (dayChange / base) * 100 : null,
    weight: null,
    status: statusOf(quote),
    cost,
    gain,
    gainPct: gain !== null && cost ? (gain / cost) * 100 : null,
  };
}

/** Valúa toda la cartera. `quotes` indexado por ticker. */
export function valuePortfolio(assets: Asset[], quotes: Map<string, Quote> | Record<string, Quote>): Valuation {
  const get = (t: string) => (quotes instanceof Map ? quotes.get(t) : quotes[t]) ?? null;
  const positions = assets.map((a) => valuePosition(a, get(a.ticker)));

  const total = positions.reduce((s, p) => s + (p.value ?? 0), 0);
  const dayChange = positions.reduce((s, p) => s + (p.dayChange ?? 0), 0);
  const prevTotal = total - dayChange;

  for (const p of positions) p.weight = p.value !== null && total > 0 ? (p.value / total) * 100 : null;

  const byClass: ClassSummary[] = [];
  for (const cls of ASSET_CLASSES) {
    const ps = positions.filter((p) => p.asset.class === cls);
    if (!ps.length) continue;
    const value = ps.reduce((s, p) => s + (p.value ?? 0), 0);
    const change = ps.reduce((s, p) => s + (p.dayChange ?? 0), 0);
    const g = gainTotals(ps);
    byClass.push({
      class: cls,
      label: CLASS_LABELS[cls],
      value,
      dayChange: change,
      dayChangePct: value - change > 0 ? (change / (value - change)) * 100 : null,
      weight: total > 0 ? (value / total) * 100 : 0,
      count: ps.length,
      ...g,
    });
  }

  const g = gainTotals(positions);
  return {
    total,
    invested: g.cost,
    gain: g.gain,
    gainPct: g.gainPct,
    dayChange,
    dayChangePct: prevTotal > 0 ? (dayChange / prevTotal) * 100 : null,
    positions,
    byClass,
    missing: positions.filter((p) => p.status === "missing").map((p) => p.asset.ticker),
  };
}

/** Costo, valor y ganancia de las posiciones que tienen precio medio y cotización. */
export function gainTotals(ps: Position[]) {
  let cost = 0,
    costedValue = 0;
  for (const p of ps) {
    if (p.cost === null || p.value === null) continue;
    cost += p.cost;
    costedValue += p.value;
  }
  const gain = costedValue - cost;
  return { cost, costedValue, gain, gainPct: cost > 0 ? (gain / cost) * 100 : null };
}

export function classTotals(v: Valuation): Partial<Record<AssetClass, number>> {
  return Object.fromEntries(v.byClass.map((c) => [c.class, round2(c.value)]));
}

export interface DailyRate {
  date: string; // YYYY-MM-DD
  ratePct: number; // % al día (serie SGS 12)
}

/**
 * Devenga un valor base con las tasas diarias del CDI posteriores a `baseDate`.
 * Rendimiento bruto (sin IR). Devuelve el valor actual y el del día hábil anterior.
 */
export function accrueCdi(baseValue: number, baseDate: string, rates: DailyRate[], cdiPercent = 100) {
  const applicable = rates.filter((r) => r.date > baseDate).sort((a, b) => a.date.localeCompare(b.date));
  let value = baseValue;
  let previousValue: number | null = null;
  for (const r of applicable) {
    previousValue = value;
    value = value * (1 + (r.ratePct / 100) * (cdiPercent / 100));
  }
  return { value, previousValue, asOf: applicable.at(-1)?.date ?? baseDate, days: applicable.length };
}
