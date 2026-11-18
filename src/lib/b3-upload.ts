import { parseB3PdfPages, type PdfItem } from "./b3-pdf";
import { findProventosSheet, parseRelatorio } from "./b3-relatorio";
import { loadWorkbook, readSheets, readXlsxWorkbook } from "./b3-xlsx";
import { mergePayments, parseMovimentacaoRows, type ReceivedPayment } from "./received";

export { ACCOUNTS, type AccountId } from "./accounts";

/** Archivo que se guarda en data/b3/<cuenta>/: sólo los proventos, sin datos personales. */
export type ExtractKind = "pdf" | "xlsx" | "relatorio-mensal" | "relatorio-anual";

export interface UploadedExtract {
  source: ExtractKind;
  uploaded_at: string;
  period: { from: string; to: string };
  rows_read: number;
  payments: ReceivedPayment[];
}

export async function readPdfItems(buf: ArrayBuffer): Promise<PdfItem[][]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const pages: PdfItem[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    pages.push(
      tc.items
        .filter((it): it is typeof it & { str: string; transform: number[] } => "str" in it && !!it.str.trim())
        .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str })),
    );
  }
  return pages;
}

export function detectKind(buf: ArrayBuffer): "pdf" | "xlsx" | null {
  const b = new Uint8Array(buf.slice(0, 4));
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf"; // %PDF
  if (b[0] === 0x50 && b[1] === 0x4b) return "xlsx"; // PK (zip)
  return null;
}

/**
 * Lee un archivo de B3 y devuelve sólo los proventos:
 * extracto de Movimentação (PDF o Excel) o relatório consolidado (mensual o anual, Excel).
 */
export async function parseExtract(buf: ArrayBuffer | string, fileName = ""): Promise<{ kind: ExtractKind; rowsRead: number; payments: ReceivedPayment[] }> {
  if (typeof buf !== "string") {
    const kind = detectKind(buf);
    if (!kind) throw new Error("El archivo no es un PDF ni un Excel");
    if (kind === "pdf") {
      const rows = parseB3PdfPages(await readPdfItems(buf));
      return { kind, rowsRead: rows.length, payments: mergePayments(parseMovimentacaoRows(rows)) };
    }
  }
  const wb = await loadWorkbook(buf);
  const sheets = readSheets(wb);
  if (findProventosSheet(sheets)) {
    const r = parseRelatorio(sheets, fileName || (typeof buf === "string" ? buf : ""));
    return { ...r, payments: mergePayments(r.payments) };
  }
  const rows = await readXlsxWorkbook(wb);
  return { kind: "xlsx", rowsRead: rows.length, payments: mergePayments(parseMovimentacaoRows(rows)) };
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Contenido y ruta del archivo que se guarda en data/b3/<cuenta>/ (sólo proventos, sin datos personales). */
export async function buildUploadRecord(
  parsed: { kind: ExtractKind; rowsRead: number; payments: ReceivedPayment[] },
  accountId: string,
  ownerLabel: string,
) {
  const payments = parsed.payments.map((p) => ({ ...p, owner: ownerLabel }));
  const dates = payments.map((p) => p.date).sort();
  const period = parsed.kind === "relatorio-anual" ? { from: `${dates[0].slice(0, 4)}-01-01`, to: `${dates[0].slice(0, 4)}-12-31` } : { from: dates[0], to: dates.at(-1)! };
  const body: Omit<UploadedExtract, "uploaded_at"> = { source: parsed.kind, period, rows_read: parsed.rowsRead, payments };
  const hash = (await sha256Hex(JSON.stringify(body))).slice(0, 8);
  const prefix = parsed.kind === "relatorio-anual" ? `anual-${period.from.slice(0, 4)}` : `${period.from}_${period.to}`;
  return {
    path: `data/b3/${accountId}/${prefix}-${hash}.json`,
    content: JSON.stringify({ ...body, uploaded_at: new Date().toISOString() } satisfies UploadedExtract, null, 2) + "\n",
    payments,
    period,
    total: Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100,
  };
}
