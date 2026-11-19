import { connection } from "next/server";
import { config, QUOTES_TAG } from "@/lib/config";
import { MARKETS } from "@/lib/market-hours";
import { brapiHeaders } from "@/providers/brapi";
import { errorMessage, fetchJson } from "@/providers/http";

interface IndexQuote {
  symbol: string;
  price: number | null;
  changePct: number | null;
  asOf: string | null;
  error?: string;
}

/** Cotización de los índices (Ibovespa, S&P 500, Nasdaq) vía brapi, con la misma caché que los precios. */
export async function GET() {
  await connection();
  const indices: IndexQuote[] = await Promise.all(
    MARKETS.map(async (m): Promise<IndexQuote> => {
      try {
        const j = await fetchJson<{ results?: { regularMarketPrice?: number; regularMarketChangePercent?: number; regularMarketTime?: string }[] }>(
          `https://brapi.dev/api/quote/${encodeURIComponent(m.symbol)}`,
          { revalidate: config.quotesRevalidate, tags: [QUOTES_TAG, "brapi-indices"], headers: brapiHeaders() },
        );
        const r = j.results?.[0];
        const price = typeof r?.regularMarketPrice === "number" && r.regularMarketPrice > 0 ? r.regularMarketPrice : null;
        return { symbol: m.symbol, price, changePct: r?.regularMarketChangePercent ?? null, asOf: r?.regularMarketTime ?? null };
      } catch (e) {
        return { symbol: m.symbol, price: null, changePct: null, asOf: null, error: errorMessage(e) };
      }
    }),
  );
  return Response.json({ indices }, { headers: { "cache-control": "no-store" } });
}
