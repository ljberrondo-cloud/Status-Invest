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

/** Activos fuera de objetivos y alertas (previdencia de empresa, etc.): cuentan en el patrimonio, no se manejan. */
export const isExcluded = (ticker: string, t: Targets) => (t.exclude_from_allocation ?? []).some((x) => x.toUpperCase() === ticker.toUpperCase());

/** Parte invertible: patrimonio sin los activos excluidos. Los objetivos se miden sobre esto. */
export function investableBase(v: Valuation, t: Targets): number {
  return v.positions.reduce((s, p) => s + (p.value !== null && !isExcluded(p.asset.ticker, t) ? p.value : 0), 0);
}

/** Clases cuyos activos están todos excluidos (no tienen objetivo). */
export function excludedClasses(v: Valuation, t: Targets): Set<AssetClass> {
  const out = new Set<AssetClass>();
  for (const c of new Set(v.positions.map((p) => p.asset.class))) {
    const ps = v.positions.filter((p) => p.asset.class === c);
    if (ps.length && ps.every((p) => isExcluded(p.asset.ticker, t))) out.add(c);
  }
  return out;
}

/** % actual de cada clase sobre la parte invertible (null para clases excluidas). */
export function classPctOfInvestable(v: Valuation, t: Targets): Record<string, number | null> {
  const base = investableBase(v, t);
  const ex = excludedClasses(v, t);
  const out: Record<string, number | null> = {};
  for (const c of v.byClass) {
    if (ex.has(c.class)) {
      out[c.class] = null;
      continue;
    }
    const val = v.positions.filter((p) => p.asset.class === c.class && !isExcluded(p.asset.ticker, t)).reduce((s, p) => s + (p.value ?? 0), 0);
    out[c.class] = base > 0 ? (val / base) * 100 : 0;
  }
  return out;
}

/** Asignación actual vs objetivo, sobre la base de cálculo (excluye p.ej. FGTS). */
export function allocationVsTarget(v: Valuation, t: Targets): { base: number; rows: AllocationRow[] } {
  const byClass = new Map<AssetClass, number>();
  let base = 0;
  for (const p of v.positions) {
    if (p.value === null || isExcluded(p.asset.ticker, t)) continue;
    byClass.set(p.asset.class, (byClass.get(p.asset.class) ?? 0) + p.value);
    base += p.value;
  }
  const ex = excludedClasses(v, t);
  const classes = new Set<AssetClass>([...byClass.keys(), ...(Object.keys(t.allocation) as AssetClass[])].filter((c) => !ex.has(c)));
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
  const base = investableBase(v, t);
  for (const p of v.positions) {
    if (p.value === null || isExcluded(p.asset.ticker, t) || base <= 0) continue;
    const w = (p.value / base) * 100;
    if (w > t.concentration.max_asset_pct) {
      alerts.push({
        id: `asset-${p.asset.ticker}`,
        level: "warning",
        kind: "concentracion_activo",
        title: `${p.asset.name ?? p.asset.ticker} concentra ${fmt(w)}% do investível`,
        detail: `Limite por ativo: ${fmt(t.concentration.max_asset_pct)}%.`,
        current: w,
        limit: t.concentration.max_asset_pct,
      });
    }
  }
  const pct = classPctOfInvestable(v, t);
  for (const c of v.byClass) {
    const w = pct[c.class];
    if (w !== null && w !== undefined && w > t.concentration.max_class_pct) {
      alerts.push({
        id: `class-${c.class}`,
        level: "warning",
        kind: "concentracion_clase",
        title: `${c.label} concentra ${fmt(w)}% do investível`,
        detail: `Limite por classe: ${fmt(t.concentration.max_class_pct)}%.`,
        current: w,
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
      title: `${r.label}: ${fmt(r.currentPct)}% x meta ${fmt(r.targetPct)}%`,
      detail: `Desvio de ${r.deviation > 0 ? "+" : ""}${fmt(r.deviation)} p.p. (tolerância ±${fmt(t.tolerance_pct)} p.p.).`,
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
  const scale = v.total > 0 ? investableBase(v, t) / v.total : 1; // objetivos sobre lo invertible → % del total
  for (const p of v.positions) {
    if (isExcluded(p.asset.ticker, t)) {
      out[p.asset.ticker] = { idealPct: 0, buy: false };
      continue;
    }
    const idealPct = (t.allocation[p.asset.class] ?? 0) * scale * shareInClass(p.asset.ticker, p.asset.class, (byClass.get(p.asset.class) ?? []).filter((x) => !isExcluded(x, t)), t);
    out[p.asset.ticker] = { idealPct, buy: p.weight !== null && p.weight < idealPct };
  }
  return out;
}
