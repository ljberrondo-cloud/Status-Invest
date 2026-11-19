/**
 * Indicadores técnicos sobre cierres diarios (del más viejo al más nuevo). Lógica pura.
 */

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let s = 0;
  for (let i = values.length - period; i < values.length; i++) s += values[i];
  return s / period;
}

/** Serie completa de la media exponencial (null hasta tener `period` datos). */
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

/** MACD (12, 26, 9): histograma actual y si la línea cruzó la señal en las últimas `lookback` ruedas. */
export function macd(values: number[], lookback = 3): { hist: number; cross: "up" | "down" | null } | null {
  const e12 = emaSeries(values, 12);
  const e26 = emaSeries(values, 26);
  const line: number[] = [];
  for (let i = 0; i < values.length; i++) if (e12[i] !== null && e26[i] !== null) line.push(e12[i]! - e26[i]!);
  if (line.length < 9 + lookback) return null;
  const signal = emaSeries(line, 9);
  const hist = line.map((v, i) => (signal[i] === null ? null : v - signal[i]!));
  const last = hist[hist.length - 1];
  if (last === null) return null;
  let cross: "up" | "down" | null = null;
  for (let i = hist.length - lookback; i < hist.length; i++) {
    const a = hist[i - 1];
    const b = hist[i];
    if (a === null || b === null) continue;
    if (a <= 0 && b > 0) cross = "up";
    if (a >= 0 && b < 0) cross = "down";
  }
  return { hist: last, cross };
}

export type Trend = "alcista" | "bajista" | "lateral";

export interface TechSummary {
  points: number;
  last: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  macdHist: number | null;
  macdCross: "up" | "down" | null;
  trend: Trend | null;
  /** Variación % en ~1 mes (21 ruedas) y en todo el período. */
  ret1m: number | null;
  retPeriod: number | null;
  /** Caída % desde el máximo del período (≤ 0). */
  fromHigh: number;
}

export function summarize(closes: number[]): TechSummary | null {
  const c = closes.filter((x) => Number.isFinite(x) && x > 0);
  if (c.length < 15) return null;
  const last = c[c.length - 1];
  const s20 = sma(c, 20);
  const s50 = sma(c, 50);
  const m = macd(c);
  let trend: Trend | null = null;
  if (s20 !== null && s50 !== null) trend = last > s20 && s20 > s50 ? "alcista" : last < s20 && s20 < s50 ? "bajista" : "lateral";
  const high = Math.max(...c);
  return {
    points: c.length,
    last,
    sma20: s20,
    sma50: s50,
    sma200: sma(c, 200),
    rsi: rsi(c),
    macdHist: m?.hist ?? null,
    macdCross: m?.cross ?? null,
    trend,
    ret1m: c.length > 21 ? (last / c[c.length - 22] - 1) * 100 : null,
    retPeriod: (last / c[0] - 1) * 100,
    fromHigh: (last / high - 1) * 100,
  };
}
