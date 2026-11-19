import { CLASS_LABELS, type AssetClass, type Targets, type Valuation } from "./types";

export interface Alert {
  id: string;
  level: "warning" | "info";
  kind: "concentracion_activo" | "concentracion_clase" | "desvio_objetivo";
  title: string;
  detail: string;
  current: number;
  limit: number;
}

export interface AllocationRow {
  class: AssetClass;
  label: string;
  currentPct: number;
  targetPct: number;
  deviation: number; // puntos porcentuales
  /** R$ a comprar (+) o vender (−) para volver al objetivo. */
  rebalance: number;
  outOfBand: boolean;
}

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Asignación actual vs objetivo, sobre la base de cálculo (excluye p.ej. FGTS). */
export function allocationVsTarget(v: Valuation, t: Targets): { base: number; rows: AllocationRow[] } {
  const excluded = new Set((t.exclude_from_allocation ?? []).map((s) => s.toUpperCase()));
  const byClass = new Map<AssetClass, number>();
  let base = 0;
  for (const p of v.positions) {
    if (p.value === null || excluded.has(p.asset.ticker.toUpperCase())) continue;
    byClass.set(p.asset.class, (byClass.get(p.asset.class) ?? 0) + p.value);
    base += p.value;
  }
  const classes = new Set<AssetClass>([...byClass.keys(), ...(Object.keys(t.allocation) as AssetClass[])]);
  const rows = [...classes].map((cls) => {
    const value = byClass.get(cls) ?? 0;
    const currentPct = base > 0 ? (value / base) * 100 : 0;
    const targetPct = t.allocation[cls] ?? 0;
    const deviation = currentPct - targetPct;
    return {
      class: cls,
      label: CLASS_LABELS[cls],
      currentPct,
      targetPct,
      deviation,
      rebalance: (targetPct / 100) * base - value,
      outOfBand: Math.abs(deviation) > t.tolerance_pct,
    };
  });
  rows.sort((a, b) => b.currentPct - a.currentPct || b.targetPct - a.targetPct);
  return { base, rows };
}

export function computeAlerts(v: Valuation, t: Targets): Alert[] {
  const alerts: Alert[] = [];
  for (const p of v.positions) {
    if (p.weight !== null && p.weight > t.concentration.max_asset_pct) {
      alerts.push({
        id: `asset-${p.asset.ticker}`,
        level: "warning",
        kind: "concentracion_activo",
        title: `${p.asset.name ?? p.asset.ticker} concentra ${fmt(p.weight)}% del patrimonio`,
        detail: `Límite por activo: ${fmt(t.concentration.max_asset_pct)}%.`,
        current: p.weight,
        limit: t.concentration.max_asset_pct,
      });
    }
  }
  for (const c of v.byClass) {
    if (c.weight > t.concentration.max_class_pct) {
      alerts.push({
        id: `class-${c.class}`,
        level: "warning",
        kind: "concentracion_clase",
        title: `${c.label} concentra ${fmt(c.weight)}% del patrimonio`,
        detail: `Límite por clase: ${fmt(t.concentration.max_class_pct)}%.`,
        current: c.weight,
        limit: t.concentration.max_class_pct,
      });
    }
  }
  for (const r of allocationVsTarget(v, t).rows) {
    if (!r.outOfBand) continue;
    alerts.push({
      id: `target-${r.class}`,
      level: "info",
      kind: "desvio_objetivo",
      title: `${r.label}: ${fmt(r.currentPct)}% vs objetivo ${fmt(r.targetPct)}%`,
      detail: `Desvío de ${r.deviation > 0 ? "+" : ""}${fmt(r.deviation)} p.p. (tolerancia ±${fmt(t.tolerance_pct)} p.p.).`,
      current: r.currentPct,
      limit: r.targetPct,
    });
  }
  return alerts.sort((a, b) => b.current - a.current);
}

/**
 * % ideal por activo = objetivo de su clase ÷ cantidad de activos de la clase (criterio de Investidor10).
 * "Comprar" = el activo pesa menos que su ideal.
 */
/** Parte del objetivo de la clase que le toca a un activo (0–1): `asset_weights` o partes iguales. */
export function shareInClass(ticker: string, cls: AssetClass, tickersInClass: string[], t: Targets): number {
  const w = t.asset_weights?.[cls];
  if (w) {
    const sum = tickersInClass.reduce((s, x) => s + Math.max(0, w[x] ?? 0), 0);
    return sum > 0 ? Math.max(0, w[ticker] ?? 0) / sum : 0;
  }
  return tickersInClass.length ? 1 / tickersInClass.length : 0;
}

export function assetTargets(v: Valuation, t: Targets): Record<string, { idealPct: number; buy: boolean }> {
  const byClass = new Map<AssetClass, string[]>();
  for (const p of v.positions) byClass.set(p.asset.class, [...(byClass.get(p.asset.class) ?? []), p.asset.ticker]);
  const out: Record<string, { idealPct: number; buy: boolean }> = {};
  for (const p of v.positions) {
    const idealPct = (t.allocation[p.asset.class] ?? 0) * shareInClass(p.asset.ticker, p.asset.class, byClass.get(p.asset.class) ?? [], t);
    out[p.asset.ticker] = { idealPct, buy: p.weight !== null && p.weight < idealPct };
  }
  return out;
}
