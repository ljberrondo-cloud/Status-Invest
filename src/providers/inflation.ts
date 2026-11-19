import { config, SLOW_TAG } from "@/lib/config";
import type { Indicator, ProviderError } from "@/lib/types";
import { cachedFetch, errorMessage, fetchJson } from "./http";
import type { IndicatorProvider } from "./types";

/**
 * Inflación de EE.UU. y Argentina (la de Brasil viene del BCB).
 * - EE.UU.: CPI del BLS, publicado por la Reserva Federal de St. Louis (FRED, CSV sin clave).
 *   12 meses sobre la serie sin desestacionalizar (CPIAUCNS, la cifra oficial interanual) y
 *   mensual sobre la desestacionalizada (CPIAUCSL, la cifra oficial del mes).
 * - Argentina: IPC del INDEC vía ArgentinaDatos (sin clave).
 */

const FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS,CPIAUCSL";
const AR = "https://api.argentinadatos.com/v1/finanzas/indices";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** CSV de FRED (observation_date,CPIAUCNS,CPIAUCSL) → indicadores de 12 meses y del mes. */
export function parseFredCpi(csv: string): Indicator[] {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(","))
    .map(([date, nsa, sa]) => ({ date, nsa: Number(nsa), sa: Number(sa) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
  const out: Indicator[] = [];
  const nsa = rows.filter((r) => Number.isFinite(r.nsa) && r.nsa > 0);
  // Último mes con el mismo mes del año anterior publicado (oct/2025 no se publicó por el cierre del gobierno de EE.UU.).
  for (let i = nsa.length - 1; i >= Math.max(0, nsa.length - 6); i--) {
    const [y, m] = nsa[i].date.split("-");
    const prevYear = nsa.find((r) => r.date === `${Number(y) - 1}-${m}-01`);
    if (!prevYear) continue;
    out.push({ id: "cpiUs12m", label: "EE.UU.", value: round2((nsa[i].nsa / prevYear.nsa - 1) * 100), unit: "% 12m", date: nsa[i].date });
    break;
  }
  const sa = rows.filter((r) => Number.isFinite(r.sa) && r.sa > 0);
  if (sa.length >= 2) {
    const [a, b] = sa.slice(-2);
    out.push({ id: "cpiUsMes", label: "EE.UU. mes", value: round2((b.sa / a.sa - 1) * 100), unit: "% mes", date: b.date });
  }
  return out;
}

/** "2026-10-31" → "2026-10-01" (mes de referencia, como las otras series). */
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

export function mapArgentina(monthly: { fecha: string; valor: number }[], yearly: { fecha: string; valor: number }[]): Indicator[] {
  const out: Indicator[] = [];
  const y = yearly.filter((r) => Number.isFinite(r.valor)).at(-1);
  if (y) out.push({ id: "ipcAr12m", label: "Argentina", value: y.valor, unit: "% 12m", date: monthStart(y.fecha) });
  const m = monthly.filter((r) => Number.isFinite(r.valor)).at(-1);
  if (m) out.push({ id: "ipcArMes", label: "Argentina mes", value: m.valor, unit: "% mes", date: monthStart(m.fecha) });
  return out;
}

const opts = { revalidate: config.slowRevalidate, tags: [SLOW_TAG, "inflation"], timeoutMs: 20_000 };

export const inflationProvider: IndicatorProvider = {
  id: "inflacion",
  async getIndicators() {
    const indicators: Indicator[] = [];
    const errors: ProviderError[] = [];
    const [us, ar] = await Promise.allSettled([
      cachedFetch(FRED, { ...opts, headers: { accept: "text/csv" } }).then((r) => r.text()),
      Promise.all([
        fetchJson<{ fecha: string; valor: number }[]>(`${AR}/inflacion`, opts),
        fetchJson<{ fecha: string; valor: number }[]>(`${AR}/inflacionInteranual`, opts),
      ]),
    ]);
    if (us.status === "fulfilled") indicators.push(...parseFredCpi(us.value));
    else errors.push({ provider: "fred", message: errorMessage(us.reason), tickers: ["Inflación EE.UU."] });
    if (ar.status === "fulfilled") indicators.push(...mapArgentina(...ar.value));
    else errors.push({ provider: "argentinadatos", message: errorMessage(ar.reason), tickers: ["Inflación Argentina"] });
    return { indicators, errors };
  },
};
