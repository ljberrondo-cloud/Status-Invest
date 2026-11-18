/**
 * Calculadora de metas: interés compuesto mensual con aportes al final de cada mes.
 * Tasas anuales efectivas (como el CDI); la mensual equivalente es (1 + a)^(1/12) − 1.
 * "En valores de hoy": se usa la tasa real (1 + a) / (1 + inflación) − 1 y la meta queda en reales de hoy.
 */
export const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;
export const realAnnualPct = (nominalPct: number, inflationPct: number) => ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;

/** Valor final con capital inicial P, aporte mensual A, tasa mensual r y n meses. */
export function futureValue(P: number, A: number, r: number, n: number): number {
  if (n <= 0) return P;
  if (Math.abs(r) < 1e-12) return P + A * n;
  const g = Math.pow(1 + r, n);
  return P * g + (A * (g - 1)) / r;
}

/** Aporte mensual necesario para llegar a `goal` en n meses (0 si ya se llega sin aportar). */
export function requiredMonthly(P: number, goal: number, r: number, n: number): number {
  if (n <= 0) return goal > P ? Infinity : 0;
  const fromCapital = futureValue(P, 0, r, n);
  if (fromCapital >= goal) return 0;
  if (Math.abs(r) < 1e-12) return (goal - P) / n;
  return ((goal - fromCapital) * r) / (Math.pow(1 + r, n) - 1);
}

/** Meses necesarios para llegar a `goal` aportando A por mes (Infinity si nunca se llega). */
export function monthsToGoal(P: number, A: number, goal: number, r: number): number {
  if (P >= goal) return 0;
  if (Math.abs(r) < 1e-12) return A > 0 ? Math.ceil((goal - P) / A) : Infinity;
  const num = goal * r + A;
  const den = P * r + A;
  if (den <= 0 || num / den <= 0) return Infinity;
  const n = Math.log(num / den) / Math.log(1 + r);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n - 1e-9) : Infinity;
}

export interface ProjectionPoint {
  month: number;
  year: number;
  /** Capital inicial + aportes acumulados. */
  contributed: number;
  /** Rendimiento acumulado (valor − aportado). */
  earnings: number;
  value: number;
}

/** Proyección año por año (y el mes final si no cae justo en un año). */
export function projection(P: number, A: number, r: number, months: number): ProjectionPoint[] {
  const pts: ProjectionPoint[] = [];
  const total = Math.min(Math.max(0, Math.round(months)), 1200);
  for (let m = 0; m <= total; m += 12) pts.push(point(m));
  if (total % 12 !== 0) pts.push(point(total));
  return pts;
  function point(m: number): ProjectionPoint {
    const value = futureValue(P, A, r, m);
    const contributed = P + A * m;
    return { month: m, year: Math.round((m / 12) * 10) / 10, contributed, earnings: value - contributed, value };
  }
}
