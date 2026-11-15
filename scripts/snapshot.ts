/**
 * Snapshot diario del patrimonio (lo corre el GitHub Action).
 * Escribe data/snapshots/AAAA-MM-DD.json, data/snapshots/latest.json y actualiza data/history.json.
 * Las cotizaciones que fallen se arrastran del snapshot anterior con su fecha original.
 */
import { getPortfolioData } from "../src/lib/portfolio-service";
import { loadHistory, loadLatestSnapshot, writeJson } from "../src/lib/data-files";
import { isoDateSP } from "../src/lib/dates";
import { classTotals } from "../src/lib/valuation";
import type { HistoryPoint, Quote, Snapshot } from "../src/lib/types";

async function main() {
  const [data, previous] = await Promise.all([getPortfolioData(), loadLatestSnapshot()]);
  const fresh = data.positions.filter((p) => p.status === "fresh").length;
  for (const e of data.errors) console.warn(`⚠ ${e.provider}: ${e.message} [${e.tickers.join(", ")}]`);
  if (fresh === 0) {
    console.error("Ninguna fuente respondió: no se guarda snapshot.");
    process.exit(1);
  }

  const quotes: Record<string, Quote> = {};
  for (const p of data.positions) {
    if (!p.quote) continue;
    // Si vino del snapshot anterior, se guarda tal cual estaba (misma fecha y origen).
    quotes[p.asset.ticker] = p.status === "stale" && previous?.quotes[p.asset.ticker] ? previous.quotes[p.asset.ticker] : p.quote;
  }

  const date = isoDateSP();
  const snapshot: Snapshot = {
    date,
    generated_at: data.generatedAt,
    total: Math.round(data.total * 100) / 100,
    invested: Math.round(data.invested * 100) / 100,
    day_change: Math.round(data.dayChange * 100) / 100,
    by_class: classTotals(data),
    quotes,
    indicators: data.indicators,
  };
  await writeJson(`snapshots/${date}.json`, snapshot);
  await writeJson("snapshots/latest.json", snapshot);

  const point: HistoryPoint & { missing?: number } = { date, total: snapshot.total, invested: snapshot.invested, by_class: snapshot.by_class };
  if (data.missing.length) point.missing = data.missing.length;
  const history = (await loadHistory()).filter((h) => h.date !== date);
  history.push(point);
  history.sort((a, b) => a.date.localeCompare(b.date));
  await writeJson("history.json", history);

  console.log(`Snapshot ${date}: R$ ${snapshot.total.toFixed(2)} · ${fresh} cotizaciones frescas · ${data.missing.length} sin cotización`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
