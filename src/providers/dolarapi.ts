import { config, QUOTES_TAG } from "@/lib/config";
import { isoDateSP } from "@/lib/dates";
import type { Indicator, ProviderError } from "@/lib/types";
import { errorMessage, fetchJson } from "./http";
import type { IndicatorProvider } from "./types";

/**
 * Cotizaciones del peso argentino (https://dolarapi.com, gratuita, sin clave).
 * Se usa el valor de venta, que es el que se paga para comprar la moneda.
 */
interface DolarApiQuote {
  moneda: string;
  casa: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
}

const SERIES: { id: Indicator["id"]; label: string; path: string }[] = [
  { id: "usdArs", label: "Dólar oficial", path: "dolares/oficial" },
  { id: "usdArsBlue", label: "Dólar blue", path: "dolares/blue" },
  { id: "usdArsMep", label: "Dólar MEP", path: "dolares/bolsa" },
  { id: "brlArs", label: "Real", path: "cotizaciones/brl" },
];

export function mapDolarApi(id: Indicator["id"], label: string, q: DolarApiQuote): Indicator | null {
  const v = q.venta ?? q.compra;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return { id, label, value: v, unit: "AR$", date: isoDateSP(q.fechaActualizacion) };
}

export const dolarApiProvider: IndicatorProvider = {
  id: "dolarapi",
  async getIndicators() {
    const settled = await Promise.allSettled(
      SERIES.map((s) => fetchJson<DolarApiQuote>(`https://dolarapi.com/v1/${s.path}`, { revalidate: config.quotesRevalidate, tags: [QUOTES_TAG, "dolarapi"] })),
    );
    const indicators: Indicator[] = [];
    const errors: ProviderError[] = [];
    settled.forEach((r, i) => {
      const s = SERIES[i];
      const ind = r.status === "fulfilled" ? mapDolarApi(s.id, s.label, r.value) : null;
      if (ind) indicators.push(ind);
      else errors.push({ provider: "dolarapi", message: r.status === "rejected" ? errorMessage(r.reason) : "Valor inválido", tickers: [s.label] });
    });
    return { indicators, errors };
  },
};
