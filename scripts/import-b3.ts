/**
 * Importa los extractos de "Movimentação" de la Área do Investidor de B3 (Excel .xlsx)
 * que estén en data/b3/ y genera data/proventos-recebidos.json.
 *
 * Uso: npm run import:b3
 * Cómo descargar el extracto: Área do Investidor → Extratos → Movimentação → elegir período → descargar Excel.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { mergePayments, parseMovimentacaoRows, type ReceivedFile, type ReceivedPayment } from "../src/lib/received";

const DATA = process.env.PORTFOLIO_DATA_DIR ?? path.join(process.cwd(), "data"); // override sólo para pruebas
const DIR = path.join(DATA, "b3");
const OUT = path.join(DATA, "proventos-recebidos.json");

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return (v as { result: unknown }).result; // fórmula
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    if ("text" in v) return (v as { text: string }).text;
  }
  return v;
}

export async function readXlsxRows(file: string): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const rows: Record<string, unknown>[] = [];
  for (const ws of wb.worksheets) {
    let headers: string[] | null = null;
    ws.eachRow((row) => {
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
      if (!headers) {
        // Fila de encabezado: tiene una celda "Movimentação" y otra "Data" (puede haber títulos antes).
        const cells = values.map((v) => (typeof v === "string" ? v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : ""));
        if (cells.includes("movimentacao") && cells.includes("data")) headers = values.map((v) => String(v ?? "").trim());
        return;
      }
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => h && (obj[h] = values[i] ?? null));
      rows.push(obj);
    });
  }
  return rows;
}

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
    if (e.isFile() && /\.xlsx$/i.test(e.name)) out.push({ rel: e.name, full: path.join(DIR, e.name) });
    if (e.isDirectory()) {
      for (const f of await fs.readdir(path.join(DIR, e.name))) {
        if (/\.xlsx$/i.test(f)) out.push({ rel: `${e.name}/${f}`, full: path.join(DIR, e.name, f), owner: ownerLabel(e.name) });
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
    const rows = await readXlsxRows(f.full);
    const payments = parseMovimentacaoRows(rows).map((p) => (f.owner ? { ...p, owner: f.owner } : p));
    console.log(`${f.rel}: ${rows.length} filas, ${payments.length} proventos${f.owner ? ` (titular: ${f.owner})` : ""}`);
    if (rows.length && !payments.length) console.warn(`  ⚠ No se reconocieron proventos en ${f.rel}: ¿es el extracto de Movimentação?`);
    lists.push(payments);
  }
  const payments = mergePayments(...lists);
  const out: ReceivedFile = { imported_at: new Date().toISOString(), source_files: files.map((f) => f.rel), payments };
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  const total = payments.reduce((s, p) => s + p.amount, 0);
  console.log(`→ ${payments.length} proventos únicos, total R$ ${total.toFixed(2)}, guardado en data/proventos-recebidos.json`);
}

if (process.argv[1]?.includes("import-b3")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
