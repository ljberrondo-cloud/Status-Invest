import { cached } from "@/lib/cache";
import { config, SLOW_TAG } from "@/lib/config";
import { brToIso, isoDateToInstant } from "@/lib/dates";
import type { Asset, Quote } from "@/lib/types";
import { cachedFetch, errorMessage } from "./http";
import type { PriceProvider, ProviderResult } from "./types";

/**
 * CSV oficial de precios y tasas de Tesouro Direto (Tesouro Transparente, datos abiertos).
 * Columnas: Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
 * Se actualiza una vez por día hábil (D-1). Pesa ~15 MB: se procesa en streaming y sólo se cachea el resultado.
 */
export const TESOURO_CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";

export interface TesouroPoint {
  date: string; // YYYY-MM-DD
  pu: number; // PU Base (valor de mercado de 1 título)
  rate: number; // Taxa venda
}

const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Procesa líneas del CSV y devuelve, por clave "Tipo;Vencimiento", los 2 puntos más recientes. */
export function parseTesouroLines(lines: Iterable<string>, keys: Set<string>): Record<string, TesouroPoint[]> {
  const out: Record<string, TesouroPoint[]> = {};
  for (const line of lines) {
    const cols = line.split(";");
    if (cols.length < 8) continue;
    const key = `${cols[0].trim()};${cols[1].trim()}`;
    if (!keys.has(key)) continue;
    const point: TesouroPoint = { date: brToIso(cols[2].trim()), pu: num(cols[7]), rate: num(cols[4]) };
    if (!Number.isFinite(point.pu) || point.pu <= 0) continue;
    const list = (out[key] ??= []);
    list.push(point);
    list.sort((a, b) => b.date.localeCompare(a.date));
    if (list.length > 2) list.length = 2;
  }
  return out;
}

async function* streamLines(res: Response): AsyncGenerator<string> {
  if (!res.body) {
    yield* (await res.text()).split(/\r?\n/);
    return;
  }
  const decoder = new TextDecoder("latin1");
  let buf = "";
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split(/\r?\n/);
    buf = parts.pop() ?? "";
    yield* parts;
  }
  if (buf) yield buf;
}

async function downloadPoints(keysList: string[]): Promise<Record<string, TesouroPoint[]>> {
  const res = await cachedFetch(TESOURO_CSV_URL, {
    revalidate: 0,
    tags: [],
    noStore: true, // demasiado grande para la Data Cache; se cachea el resultado parseado
    timeoutMs: 60_000,
    headers: { accept: "text/csv" },
  });
  const keys = new Set(keysList);
  const out: Record<string, TesouroPoint[]> = {};
  const batch: string[] = [];
  for await (const line of streamLines(res)) {
    batch.push(line);
    if (batch.length >= 5000) {
      merge(out, parseTesouroLines(batch, keys));
      batch.length = 0;
    }
  }
  merge(out, parseTesouroLines(batch, keys));
  return out;
}

function merge(into: Record<string, TesouroPoint[]>, from: Record<string, TesouroPoint[]>) {
  for (const [k, pts] of Object.entries(from)) {
    into[k] = [...(into[k] ?? []), ...pts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  }
}

const getPoints = cached(downloadPoints, ["tesouro-points-v1"], {
  revalidate: config.slowRevalidate,
  tags: [SLOW_TAG, "tesouro"],
});

export function tesouroQuote(ticker: string, points: TesouroPoint[] | undefined): Quote | null {
  if (!points?.length) return null;
  const [last, prev] = points;
  return {
    ticker,
    price: last.pu,
    previousClose: prev?.pu ?? null,
    changePct: prev ? ((last.pu - prev.pu) / prev.pu) * 100 : null,
    asOf: isoDateToInstant(last.date),
    source: "tesouro",
    kind: "market",
  };
}

export const tesouroProvider: PriceProvider = {
  id: "tesouro",
  supports: (a: Asset) => a.provider === "tesouro",
  async getQuotes(assets): Promise<ProviderResult> {
    if (!assets.length) return { quotes: [], errors: [] };
    const keys = [...new Set(assets.map((a) => a.provider_id ?? ""))].filter(Boolean).sort();
    try {
      const points = await getPoints(keys);
      const quotes: Quote[] = [];
      const missing: string[] = [];
      for (const a of assets) {
        const q = tesouroQuote(a.ticker, points[a.provider_id ?? ""]);
        if (q) quotes.push(q);
        else missing.push(a.ticker);
      }
      return {
        quotes,
        errors: missing.length
          ? [{ provider: "tesouro", message: "Título no encontrado (revisá provider_id 'Tipo Titulo;DD/MM/AAAA')", tickers: missing }]
          : [],
      };
    } catch (e) {
      return { quotes: [], errors: [{ provider: "tesouro", message: errorMessage(e), tickers: assets.map((a) => a.ticker) }] };
    }
  },
};
