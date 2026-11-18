import { parseB3PdfPages, type PdfItem } from "./b3-pdf";
import { readXlsxBuffer } from "./b3-xlsx";
import { mergePayments, parseMovimentacaoRows, type ReceivedPayment } from "./received";

export { ACCOUNTS, type AccountId } from "./accounts";

/** Archivo que se guarda en data/b3/<cuenta>/: sólo los proventos, sin datos personales. */
export interface UploadedExtract {
  source: "pdf" | "xlsx";
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

/** Lee un extracto de Movimentação (PDF o Excel) y devuelve sólo los proventos. */
export async function parseExtract(buf: ArrayBuffer): Promise<{ kind: "pdf" | "xlsx"; rowsRead: number; payments: ReceivedPayment[] }> {
  const kind = detectKind(buf);
  if (!kind) throw new Error("El archivo no es un PDF ni un Excel");
  const rows = kind === "pdf" ? parseB3PdfPages(await readPdfItems(buf)) : await readXlsxBuffer(buf);
  return { kind, rowsRead: rows.length, payments: mergePayments(parseMovimentacaoRows(rows)) };
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
