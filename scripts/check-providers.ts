/** Diagnóstico: consulta todas las fuentes reales e imprime resultado y errores. `npx tsx scripts/check-providers.ts` */
import { getPortfolioData } from "../src/lib/portfolio-service";

const t0 = Date.now();
getPortfolioData().then((d) => {
  for (const p of d.positions) {
    const q = p.quote;
    console.log(
      p.asset.ticker.padEnd(12),
      p.status.padEnd(8),
      String(q?.price?.toFixed(2) ?? "—").padStart(10),
      String(p.dayChangePct?.toFixed(2) ?? "—").padStart(7) + "%",
      q?.asOf ?? "",
      q?.source ?? "",
    );
  }
  console.log("TOTAL", d.total.toFixed(2), "Δ", d.dayChange.toFixed(2), d.dayChangePct?.toFixed(2) + "%");
  console.log("Indicadores", d.indicators);
  console.log("Errores", JSON.stringify(d.errors, null, 1));
  console.log(`(${Date.now() - t0} ms)`);
});
