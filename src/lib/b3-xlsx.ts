import ExcelJS from "exceljs";

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

const plain = (v: unknown) => (typeof v === "string" ? v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase() : "");

/** Filas del Excel de Movimentação de B3 como objetos encabezado → valor. */
export async function readXlsxWorkbook(wb: ExcelJS.Workbook): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (const ws of wb.worksheets) {
    let headers: string[] | null = null;
    ws.eachRow((row) => {
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
      if (!headers) {
        // Fila de encabezado: tiene una celda "Movimentação" y otra "Data" (puede haber títulos antes).
        const cells = values.map(plain);
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

export async function readXlsxBuffer(buf: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return readXlsxWorkbook(wb);
}

export async function readXlsxFile(file: string): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return readXlsxWorkbook(wb);
}
