/**
 * Plan de inversión con seguimiento mensual de aportes.
 * Guardado en data/plan.json (vía GitHub desde la app).
 */
import { futureValue, monthlyRate, monthsToGoal, requiredMonthly } from "./calculator";

export interface Plan {
  goal: number;
  /** Mes objetivo "AAAA-MM". */
  targetMonth: string;
  ratePct: number;
  plannedMonthly: number;
  /** Mes de inicio "AAAA-MM" y patrimonio de ese momento. */
  startMonth: string;
  startValue: number;
}

export interface Contribution {
  month: string; // "AAAA-MM"
  amount: number;
  note?: string;
}

export interface PlanFile {
  plan: Plan | null;
  contributions: Contribution[];
  updated_at?: string;
}

export const EMPTY_PLAN: PlanFile = { plan: null, contributions: [] };

/** Meses entre dos "AAAA-MM" (b − a). */
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Agrega o reemplaza el aporte de un mes (monto 0 o null lo borra). */
export function upsertContribution(list: Contribution[], month: string, amount: number | null, note?: string): Contribution[] {
  const rest = list.filter((c) => c.month !== month);
  if (amount === null || !(amount > 0)) return rest;
  return [...rest, { month, amount: Math.round(amount * 100) / 100, ...(note ? { note } : {}) }].sort((a, b) => a.month.localeCompare(b.month));
}

export interface TrackRow {
  month: string;
  planned: number;
  actual: number;
  cumPlanned: number;
  cumActual: number;
}

export interface Tracking {
  rows: TrackRow[];
  totalPlanned: number;
  totalActual: number;
  /** Aportado − planeado (positivo: vas adelantado). */
  diff: number;
  /** Promedio de los meses con aporte registrado (0 si no hay). */
  avgActual: number;
  monthsLeft: number;
  /** Aporte necesario por mes desde ahora, con el patrimonio de hoy, para llegar en la fecha. */
  requiredNow: number;
  /** Meses hasta la meta si se sigue aportando el promedio real. */
  monthsAtAvg: number;
  /** Valor en la fecha objetivo aportando el promedio real. */
  valueAtTargetAtAvg: number;
  /** Valor en la fecha objetivo aportando lo planeado. */
  valueAtTargetPlanned: number;
}

/** Seguimiento del plan hasta el mes actual (incluido), con el patrimonio de hoy. */
export function trackPlan(plan: Plan, contributions: Contribution[], currentValue: number, currentMonth: string): Tracking {
  const byMonth = new Map(contributions.map((c) => [c.month, c.amount]));
  const rows: TrackRow[] = [];
  let cumPlanned = 0;
  let cumActual = 0;
  const last = currentMonth < plan.startMonth ? plan.startMonth : currentMonth;
  for (let m = plan.startMonth; m <= last; m = addMonths(m, 1)) {
    const actual = byMonth.get(m) ?? 0;
    cumPlanned += plan.plannedMonthly;
    cumActual += actual;
    rows.push({ month: m, planned: plan.plannedMonthly, actual, cumPlanned, cumActual });
    if (rows.length > 600) break;
  }
  const withAmount = contributions.filter((c) => c.month >= plan.startMonth && c.month <= last);
  const avgActual = withAmount.length ? withAmount.reduce((s, c) => s + c.amount, 0) / Math.max(1, rows.length) : 0;
  const r = monthlyRate(plan.ratePct);
  const monthsLeft = Math.max(0, monthDiff(currentMonth, plan.targetMonth));
  return {
    rows,
    totalPlanned: cumPlanned,
    totalActual: cumActual,
    diff: cumActual - cumPlanned,
    avgActual,
    monthsLeft,
    requiredNow: requiredMonthly(currentValue, plan.goal, r, monthsLeft),
    monthsAtAvg: monthsToGoal(currentValue, avgActual, plan.goal, r),
    valueAtTargetAtAvg: futureValue(currentValue, avgActual, r, monthsLeft),
    valueAtTargetPlanned: futureValue(currentValue, plan.plannedMonthly, r, monthsLeft),
  };
}

/** Valida y normaliza lo que llega del cliente. */
export function sanitizePlan(p: unknown): Plan | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : NaN);
  const plan = {
    goal: n(o.goal),
    targetMonth: o.targetMonth,
    ratePct: n(o.ratePct),
    plannedMonthly: n(o.plannedMonthly),
    startMonth: o.startMonth,
    startValue: n(o.startValue),
  };
  if (!isMonth(plan.targetMonth) || !isMonth(plan.startMonth) || [plan.goal, plan.ratePct, plan.plannedMonthly, plan.startValue].some(Number.isNaN)) return null;
  if (plan.goal <= 0 || plan.ratePct > 100 || plan.targetMonth <= plan.startMonth) return null;
  return plan as Plan;
}
