/**
 * Relatório consolidado de B3 (mensual o anual), hoja "Proventos Recebidos".
 * - Mensual: Produto | Pagamento | Tipo de Evento | Instituição | Quantidade | Preço unitário | Valor líquido
 * - Anual:   Produto | Tipo de Evento | Valor líquido  (totales del año, sin fecha de pago)
 */
import type { Sheet } from "./b3-xlsx";
import { classifyMovement, parseMoney, parseMovimentacaoRows, tickerFromProduct, type ReceivedPayment } from "./received";

export const PROVENTOS_SHEET = "proventos recebidos";

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function findProventosSheet(sheets: Sheet[]): Sheet | undefined {
  return sheets.find((s) => plain(s.name) === PROVENTOS_SHEET);
}

/** Año de un relatório anual a partir del nombre de archivo ("relatorio-consolidado-anual-2025.xlsx"). */
export function yearFromName(name: string): string | null {
  return name.match(/anual[^0-9]*(\d{4})/i)?.[1] ?? name.match(/(20\d{2})/)?.[1] ?? null;
}

export function parseRelatorio(sheets: Sheet[], fileName: string): { kind: "relatorio-mensal" | "relatorio-anual"; rowsRead: number; payments: ReceivedPayment[] } {
  const sheet = findProventosSheet(sheets);
  if (!sheet) throw new Error('No se encontró la hoja "Proventos Recebidos"');
  const rows = sheet.rows.filter((r) => typeof r["Produto"] === "string" && /[A-Z]{4}\d{1,2}/.test(r["Produto"] as string));
  const monthly = sheet.rows.some((r) => "Pagamento" in r);

  if (monthly) {
    const asMov = rows.map((r) => ({
      Data: r["Pagamento"],
      "Movimentação": r["Tipo de Evento"],
      Produto: r["Produto"],
      "Instituição": r["Instituição"],
      Quantidade: r["Quantidade"],
      "Preço unitário": r["Preço unitário"],
      "Valor da Operação": r["Valor líquido"],
    }));
    return { kind: "relatorio-mensal", rowsRead: rows.length, payments: parseMovimentacaoRows(asMov) };
  }

  const year = yearFromName(fileName);
  if (!year) throw new Error("Não foi possível saber de que ano é o relatório anual (o nome do arquivo deve incluir o ano)");
  const payments: ReceivedPayment[] = [];
  for (const r of rows) {
    const label = String(r["Tipo de Evento"] ?? "").trim();
    const type = classifyMovement(label);
    const amount = parseMoney(r["Valor líquido"]);
    if (!type || amount === null || amount <= 0) continue;
    payments.push({
      date: `${year}-01-01`,
      ticker: tickerFromProduct(String(r["Produto"])),
      type,
      label,
      quantity: null,
      unitValue: null,
      amount: Math.round(amount * 100) / 100,
      annual: true,
    });
  }
  return { kind: "relatorio-anual", rowsRead: rows.length, payments };
}
