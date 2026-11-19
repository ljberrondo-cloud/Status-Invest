/**
 * Importa los extractos de "Movimentação" de la Área do Investidor de B3 (Excel .xlsx)
 * que estén en data/b3/ y genera data/proventos-recebidos.json.
 *
 * Uso: npm run import:b3
 * Cómo descargar el extracto: Área do Investidor → Extratos → Movimentação → elegir período → descargar Excel.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseExtract } from "../src/lib/b3-upload";
import { accountLabel } from "../src/lib/accounts";
import type { UploadedExtract } from "../src/lib/b3-upload";
import { mergePayments, reconcileAnnual, type ReceivedFile, type ReceivedPayment } from "../src/lib/received";
import { applyPositionFiles, type PositionFile } from "../src/lib/b3-positions";
import type { Portfolio } from "../src/lib/types";

const DATA = process.env.PORTFOLIO_DATA_DIR ?? path.join(process.cwd(), "data"); // override sólo para pruebas
const DIR = path.join(DATA, "b3");
const OUT = path.join(DATA, "proventos-recebidos.json");

/** Compatibilidad (tests): filas de un extracto de Movimentação en .xlsx. */
export { readXlsxFile as readXlsxRows } from "../src/lib/b3-xlsx";

/** Nombre de carpeta → nombre visible: "esposa" → "Esposa", "maria-luz" → "Maria Luz". */
export const ownerLabel = (dir: string) => dir.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/**
 * Extractos a procesar. Cada subcarpeta de data/b3/ es un titular (data/b3/esposa/*.xlsx).
 * Los .xlsx sueltos en data/b3/ se toman sin titular.
 */
async function listFiles(): Promise<{ rel: string; full: string; owner?: string }[]> {
  const out: { rel: string; full: string; owner?: string }[] = [];
  const entries = await fs.readdir(DIR, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.isFile() && /\.(xlsx|json)$/i.test(e.name) && !e.name.startsWith("posicion-")) out.push({ rel: e.name, full: path.join(DIR, e.name) });
    if (e.isDirectory()) {
      for (const f of await fs.readdir(path.join(DIR, e.name))) {
        if (/\.(xlsx|json)$/i.test(f) && !f.startsWith("posicion-")) out.push({ rel: `${e.name}/${f}`, full: path.join(DIR, e.name, f), owner: accountLabel(e.name) });
      }
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

async function main() {
  const files = await listFiles();
  if (!files.length) {
    console.error(`No hay archivos .xlsx en ${DIR}`);
    process.exit(1);
  }
  const lists: ReceivedPayment[][] = [];
  for (const f of files) {
    let rows: Record<string, unknown>[] = [];
    let found: ReceivedPayment[];
    if (f.full.endsWith(".json")) {
      // Extracto subido desde la app: ya trae los proventos normalizados.
      const up = JSON.parse(await fs.readFile(f.full, "utf8")) as UploadedExtract;
      found = up.payments ?? [];
      rows = new Array(up.rows_read ?? found.length);
    } else {
      // Extracto de Movimentação o relatório consolidado (mensual/anual).
      const parsed = await parseExtract(f.full, path.basename(f.full));
      rows = new Array(parsed.rowsRead);
      found = parsed.payments;
    }
    const payments = found.map((p) => (f.owner ? { ...p, owner: f.owner } : p));
    console.log(`${f.rel}: ${rows.length} filas, ${payments.length} proventos${f.owner ? ` (titular: ${f.owner})` : ""}`);
    if (rows.length && !payments.length) console.warn(`  ⚠ No se reconocieron proventos en ${f.rel}: ¿es el extracto de Movimentação?`);
    lists.push(payments);
  }
  // Sin duplicados entre fuentes, y los totales anuales sin lo que ya está detallado.
  const payments = reconcileAnnual(mergePayments(...lists));
  const out: ReceivedFile = { imported_at: new Date().toISOString(), source_files: files.map((f) => f.rel), payments };
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  const total = payments.reduce((s, p) => s + p.amount, 0);
  console.log(`→ ${payments.length} proventos únicos, total R$ ${total.toFixed(2)}, guardado en data/proventos-recebidos.json`);
  await applyPositions();
}

/** Posiciones por cuenta de los relatórios mensuales (posicion-AAAA-MM.json) → data/portfolio.json. */
async function applyPositions() {
  const files: PositionFile[] = [];
  for (const e of await fs.readdir(DIR, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue;
    for (const f of await fs.readdir(path.join(DIR, e.name))) {
      if (/^posicion-\d{4}-\d{2}\.json$/.test(f)) files.push(JSON.parse(await fs.readFile(path.join(DIR, e.name, f), "utf8")) as PositionFile);
    }
  }
  if (!files.length) return;
  const portfolioPath = path.join(DATA, "portfolio.json");
  const portfolio = JSON.parse(await fs.readFile(portfolioPath, "utf8")) as Portfolio;
  const { portfolio: next, changes } = applyPositionFiles(portfolio, files);
  if (!changes.length && JSON.stringify(next.positions_as_of) === JSON.stringify(portfolio.positions_as_of)) {
    console.log(`Posiciones: nada nuevo (aplicadas hasta ${JSON.stringify(portfolio.positions_as_of ?? {})})`);
    return;
  }
  await fs.writeFile(portfolioPath, JSON.stringify(next, null, 2) + "\n");
  for (const c of changes) {
    const avg = c.avgBefore !== c.avgAfter && c.avgAfter !== undefined ? `, precio medio ${c.avgBefore ?? "—"} → ${c.avgAfter}` : "";
    console.log(`Posición ${c.account} al ${c.asOf}: ${c.ticker} ${c.before} → ${c.after}${c.added ? " (nuevo)" : ""}${avg}`);
  }
}

if (process.argv[1]?.includes("import-b3")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
