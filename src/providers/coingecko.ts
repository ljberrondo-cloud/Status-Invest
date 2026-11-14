import { config, QUOTES_TAG } from "@/lib/config";
import type { Asset, Quote } from "@/lib/types";
import { errorMessage, fetchJson } from "./http";
import type { PriceProvider, ProviderResult } from "./types";

type SimplePrice = Record<string, { brl?: number; brl_24h_change?: number; last_updated_at?: number }>;

const isCrypto = (a: Asset) => (a.provider ? a.provider === "coingecko" : a.class === "cripto");
const coinId = (a: Asset) => (a.provider_id ?? a.ticker).toLowerCase();

export function mapCoingecko(assets: Asset[], data: SimplePrice): Quote[] {
  const out: Quote[] = [];
  for (const a of assets) {
    const row = data[coinId(a)];
    if (!row || typeof row.brl !== "number" || row.brl <= 0) continue;
    const pct = typeof row.brl_24h_change === "number" ? row.brl_24h_change : null;
    out.push({
      ticker: a.ticker,
      price: row.brl,
      previousClose: pct !== null ? row.brl / (1 + pct / 100) : null,
      changePct: pct,
      asOf: row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : new Date().toISOString(),
      source: "coingecko",
      kind: "market",
    });
  }
  return out;
}

export const coingeckoProvider: PriceProvider = {
  id: "coingecko",
  supports: isCrypto,
  async getQuotes(assets): Promise<ProviderResult> {
    if (!assets.length) return { quotes: [], errors: [] };
    const ids = [...new Set(assets.map(coinId))].sort().join(",");
    const key = config.coingeckoKey;
    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}` +
      `&vs_currencies=brl&include_24hr_change=true&include_last_updated_at=true`;
    try {
      const data = await fetchJson<SimplePrice>(url, {
        revalidate: config.quotesRevalidate,
        tags: [QUOTES_TAG, "coingecko"],
        headers: key ? { "x-cg-demo-api-key": key } : undefined,
      });
      const quotes = mapCoingecko(assets, data);
      const got = new Set(quotes.map((q) => q.ticker));
      const missing = assets.filter((a) => !got.has(a.ticker)).map((a) => a.ticker);
      return {
        quotes,
        errors: missing.length ? [{ provider: "coingecko", message: "Id no encontrado en CoinGecko", tickers: missing }] : [],
      };
    } catch (e) {
      return { quotes: [], errors: [{ provider: "coingecko", message: errorMessage(e), tickers: assets.map((a) => a.ticker) }] };
    }
  },
};
