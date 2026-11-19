import { config, SLOW_TAG } from "@/lib/config";
import { addDays, brToIso, isoDateSP, isoDateToInstant, isoToBr } from "@/lib/dates";
import { accrueCdi, type DailyRate } from "@/lib/valuation";
import type { Asset, Indicator, ProviderError, Quote } from "@/lib/types";
import { errorMessage, fetchJson } from "./http";
import type { IndicatorProvider, PriceProvider, ProviderResult } from "./types";

/** Series SGS del Banco Central. */
export const SGS = {
  cdiDaily: 12, // CDI % a.d.
  cdiYear: 4389, // CDI % a.a. base 252
  selicMeta: 432, // Meta Selic % a.a.
  ipcaMonth: 433, // IPCA % mensual
  ipca12m: 13522, // IPCA acumulado 12 meses
  usdPtax: 1, // Dólar PTAX venta
} as const;

type SgsRow = { data: string; valor: string };

const sgsUrl = (code: number, query: string) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados${query}${query.includes("?") ? "&" : "?"}formato=json`;

/**
 * Último valor de una serie. Se piden 5 y se toma la fecha mayor: algunas series
 * responden 304 vacío a `ultimos/1` y el orden de `ultimos/N` no es estable.
 */
async function sgsLast(code: number): Promise<{ date: string; value: number }> {
  const rows = await fetchJson<SgsRow[]>(sgsUrl(code, "/ultimos/5"), {
    revalidate: config.slowRevalidate,
    tags: [SLOW_TAG, "bcb"],
  });
  const parsed = rows
    .map((r) => ({ date: brToIso(r.data), value: Number(r.valor) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!parsed.length) throw new Error(`Serie SGS ${code} vacía`);
  // La meta Selic viene fechada hasta la próxima reunión del Copom: se acota a hoy.
  const today = isoDateSP();
  return { ...parsed[0], date: parsed[0].date > today ? today : parsed[0].date };
}

export async function getCdiDailyRates(fromIso: string, toIso: string): Promise<DailyRate[]> {
  const rows = await fetchJson<SgsRow[]>(
    sgsUrl(SGS.cdiDaily, `?dataInicial=${isoToBr(fromIso)}&dataFinal=${isoToBr(toIso)}`),
    { revalidate: config.slowRevalidate, tags: [SLOW_TAG, "bcb"] },
  );
  return rows.map((r) => ({ date: brToIso(r.data), ratePct: Number(r.valor) }));
}

const DEFS: { id: Indicator["id"]; code: number; label: string; unit: Indicator["unit"] }[] = [
  { id: "cdi", code: SGS.cdiYear, label: "CDI", unit: "% a.a." },
  { id: "selic", code: SGS.selicMeta, label: "Selic", unit: "% a.a." },
  { id: "ipca12m", code: SGS.ipca12m, label: "IPCA 12m", unit: "% 12m" },
  { id: "ipcaMes", code: SGS.ipcaMonth, label: "IPCA mês", unit: "% mes" },
  { id: "usd", code: SGS.usdPtax, label: "Dólar PTAX", unit: "R$" },
];

export const bcbIndicatorProvider: IndicatorProvider = {
  id: "bcb",
  async getIndicators() {
    const settled = await Promise.allSettled(DEFS.map((d) => sgsLast(d.code)));
    const indicators: Indicator[] = [];
    const errors: ProviderError[] = [];
    settled.forEach((r, i) => {
      const d = DEFS[i];
      if (r.status === "fulfilled" && Number.isFinite(r.value.value)) {
        indicators.push({ id: d.id, label: d.label, unit: d.unit, value: r.value.value, date: r.value.date });
      } else {
        errors.push({ provider: "bcb", message: r.status === "rejected" ? errorMessage(r.reason) : "Valor inválido", tickers: [d.label] });
      }
    });
    return { indicators, errors };
  },
};

/** CDB / renta fija posfijada: valor manual + devengo diario del CDI publicado por el BCB. */
export const bcbCdiProvider: PriceProvider = {
  id: "cdi",
  supports: (a: Asset) => a.provider === "cdi",
  async getQuotes(assets): Promise<ProviderResult> {
    const quotes: Quote[] = [];
    const errors: ProviderError[] = [];
    const today = isoDateSP();
    for (const a of assets) {
      if (a.manual_value === undefined || !a.manual_date) {
        errors.push({ provider: "cdi", message: "Falta manual_value/manual_date", tickers: [a.ticker] });
        continue;
      }
      const base = (a.manual_value) / (a.quantity || 1);
      try {
        // El BCB no acepta rangos vacíos: si la fecha base es hoy, no hay nada que devengar.
        const rates = a.manual_date >= today ? [] : await getCdiDailyRates(addDays(a.manual_date, 1), today);
        const r = accrueCdi(base, a.manual_date, rates, a.cdi_percent ?? 100);
        quotes.push({
          ticker: a.ticker,
          price: r.value,
          previousClose: r.previousValue,
          changePct: r.previousValue ? ((r.value - r.previousValue) / r.previousValue) * 100 : null,
          asOf: isoDateToInstant(r.asOf),
          source: "bcb-cdi",
          kind: "accrual",
        });
      } catch (e) {
        // Sin CDI disponible: se muestra el valor manual (no se inventa rendimiento).
        quotes.push({
          ticker: a.ticker,
          price: base,
          previousClose: null,
          changePct: null,
          asOf: isoDateToInstant(a.manual_date),
          source: "manual",
          kind: "manual",
        });
        errors.push({ provider: "bcb (CDI)", message: errorMessage(e), tickers: [a.ticker] });
      }
    }
    return { quotes, errors };
  },
};
