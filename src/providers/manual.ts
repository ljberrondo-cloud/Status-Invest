import { isoDateToInstant } from "@/lib/dates";
import type { Asset, Quote } from "@/lib/types";
import type { PriceProvider, ProviderResult } from "./types";

/** Activos sin cotización de mercado (previdencia, FGTS...): se usa manual_value tal cual. */
export const manualProvider: PriceProvider = {
  id: "manual",
  supports: (a: Asset) => a.provider === "manual",
  async getQuotes(assets): Promise<ProviderResult> {
    const quotes: Quote[] = [];
    const missing: string[] = [];
    for (const a of assets) {
      if (a.manual_value === undefined) {
        missing.push(a.ticker);
        continue;
      }
      quotes.push({
        ticker: a.ticker,
        price: a.manual_value / (a.quantity || 1),
        previousClose: null,
        changePct: null,
        asOf: a.manual_date ? isoDateToInstant(a.manual_date) : new Date(0).toISOString(),
        source: "manual",
        kind: "manual",
      });
    }
    return { quotes, errors: missing.length ? [{ provider: "manual", message: "Falta manual_value", tickers: missing }] : [] };
  },
};
