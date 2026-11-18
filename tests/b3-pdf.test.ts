import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseB3PdfPages, parsePtDate, type PdfItem } from "@/lib/b3-pdf";
import { mergePayments, parseMovimentacaoRows } from "@/lib/received";

// Textos con posición de las páginas 2–4 de un extracto real (sin la página 1, que tiene nombre y CPF).
const pages = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures/b3-movimentacao-pdf-paginas-2-4.json"), "utf8")) as PdfItem[][];

describe("PDF de Movimentação de B3", () => {
  it("fechas en portugués", () => {
    expect(parsePtDate("09 de novembro de 2026")).toBe("09/11/2026");
    expect(parsePtDate("1 de março de 2025")).toBe("01/03/2025");
    expect(parsePtDate("Extrato de Movimentação")).toBeNull();
  });

  const rows = parseB3PdfPages(pages);

  it("reconstruye filas con celdas de varias líneas", () => {
    const jcp = rows.find((r) => r.Produto.startsWith("SANB3") && r["Movimentação"].startsWith("Juros"))!;
    expect(jcp).toMatchObject({ Data: "09/11/2026", "Movimentação": "Juros Sobre Capital Próprio", Quantidade: "84", "Preço unitário": "R$ 0,19", "Valor da Operação": "R$ 13,24" });
    expect(jcp["Instituição"]).toBe("BANCO BTG PACTUAL S/A.");
    // "R$" y el número en líneas distintas
    const xpml = rows.find((r) => r.Produto.startsWith("XPML11") && r["Movimentação"] === "Rendimento")!;
    expect(xpml["Valor da Operação"]).toBe("R$ 107,64");
  });

  it("mantiene la fecha cuando la tabla sigue en la página siguiente", () => {
    const kncr = rows.filter((r) => r.Produto.startsWith("KNCR11") && r["Movimentação"] === "Rendimento");
    expect(kncr.map((r) => r.Data)).toEqual(["14/10/2026"]);
    expect(rows.find((r) => r.Produto.startsWith("KNCR11") && r["Movimentação"].startsWith("Transfer"))?.Data).toBe("16/10/2026");
  });

  it("extrae sólo los proventos, con los montos del extracto", () => {
    const p = mergePayments(parseMovimentacaoRows(rows));
    expect(p).toHaveLength(12); // 16 del extracto completo menos los 4 de la página 1
    expect(Math.round(p.reduce((s, x) => s + x.amount, 0) * 100) / 100).toBe(678.52); // 967,86 − 289,34 de la página 1
    expect(p.find((x) => x.ticker === "MXRF11")).toMatchObject({ date: "2026-10-15", type: "rendimento", quantity: 1033, amount: 103.3 });
    expect(p.filter((x) => x.type === "jcp").map((x) => x.ticker)).toEqual(["SANB3"]);
  });
});
