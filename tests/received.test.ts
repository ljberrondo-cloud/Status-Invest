import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import ExcelJS from "exceljs";
import { classifyMovement, mergePayments, ownersOf, parseMoney, parseMovimentacaoRows, summarizeReceived } from "@/lib/received";
import { ownerLabel, readXlsxRows } from "../scripts/import-b3";

const HEAD = ["Entrada/Saída", "Data", "Movimentação", "Produto", "Instituição", "Quantidade", "Preço unitário", "Valor da Operação"];
const rowsData: unknown[][] = [
  ["Credito", "14/11/2026", "Rendimento", "MXRF11 - MAXI RENDA FUNDO DE INVESTIMENTO IMOBILIARIO", "XP INVESTIMENTOS CCTVM S/A", 1021, 0.1, 102.1],
  ["Credito", "30/10/2026", "Juros Sobre Capital Próprio", "BBAS3 - BANCO DO BRASIL S/A", "XP INVESTIMENTOS CCTVM S/A", 94, "R$ 0,35", "R$ 32,90"],
  ["Credito", "30/10/2026", "Juros Sobre Capital Próprio - Transferido", "BBAS3 - BANCO DO BRASIL S/A", "XP INVESTIMENTOS CCTVM S/A", 94, "R$ 0,35", "R$ 32,90"],
  ["Credito", "15/12/2025", "Dividendo", "PETR4 - PETROLEO BRASILEIRO S/A PETROBRAS", "XP INVESTIMENTOS CCTVM S/A", 30, 1.2, 36],
  ["Debito", "10/10/2026", "Transferência - Liquidação", "VALE3 - VALE S.A.", "XP INVESTIMENTOS CCTVM S/A", 16, 60, 960],
  ["Credito", "10/10/2026", "Transferência - Liquidação", "VALE3 - VALE S.A.", "XP INVESTIMENTOS CCTVM S/A", 16, 60, 960],
  ["Credito", "01/09/2026", "Direitos de Subscrição", "KNCR11 - KINEA", "XP INVESTIMENTOS CCTVM S/A", 3, "-", "-"],
];
const toRows = () => rowsData.map((r) => Object.fromEntries(HEAD.map((h, i) => [h, r[i]])));

describe("extracto de Movimentação de B3", () => {
  it("clasifica tipos de movimiento", () => {
    expect(classifyMovement("Rendimento")).toBe("rendimento");
    expect(classifyMovement("Juros Sobre Capital Próprio")).toBe("jcp");
    expect(classifyMovement("JUROS SOBRE CAPITAL PROPRIO - Transferido")).toBe("jcp");
    expect(classifyMovement("Dividendo - Transferido")).toBe("dividendo");
    expect(classifyMovement("Transferência - Liquidação")).toBeNull();
    expect(classifyMovement("Compra")).toBeNull();
  });

  it("interpreta montos en formato brasileño", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(1234.56);
    expect(parseMoney(12.5)).toBe(12.5);
    expect(parseMoney("-")).toBeNull();
  });

  it("extrae sólo proventos de crédito y deduplica 'Transferido'", () => {
    const payments = mergePayments(parseMovimentacaoRows(toRows()));
    expect(payments.map((p) => `${p.date} ${p.ticker} ${p.type} ${p.amount}`)).toEqual([
      "2026-11-14 MXRF11 rendimento 102.1",
      "2026-10-30 BBAS3 jcp 32.9",
      "2025-12-15 PETR4 dividendo 36",
    ]);
  });

  it("el mismo pago en cuentas de dos titulares cuenta dos veces", () => {
    const a = parseMovimentacaoRows(toRows());
    const yo = a.map((p) => ({ ...p, owner: "Yo" }));
    const ella = a.map((p) => ({ ...p, owner: "Esposa" }));
    const merged = mergePayments(yo, ella, yo);
    expect(merged).toHaveLength(6);
    expect(ownersOf(merged)).toEqual(["Esposa", "Yo"]);
  });

  it("une extractos superpuestos sin duplicar", () => {
    const a = parseMovimentacaoRows(toRows());
    expect(mergePayments(a, a)).toHaveLength(3);
  });

  it("lee un .xlsx real (encabezado no necesariamente en la fila 1)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Movimentação");
    ws.addRow(["Extrato de movimentação"]);
    ws.addRow(HEAD);
    rowsData.forEach((r) => ws.addRow(r));
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "b3-")), "mov.xlsx");
    await wb.xlsx.writeFile(file);
    const payments = parseMovimentacaoRows(await readXlsxRows(file));
    expect(payments).toHaveLength(4); // antes de deduplicar
    expect(payments[0]).toMatchObject({ ticker: "MXRF11", quantity: 1021, unitValue: 0.1, amount: 102.1, institution: "XP INVESTIMENTOS CCTVM S/A" });
  });
});

describe("titulares", () => {
  it("nombre visible desde la carpeta", () => {
    expect(ownerLabel("esposa")).toBe("Esposa");
    expect(ownerLabel("maria-luz")).toBe("Maria Luz");
  });
});

describe("resumen de proventos recibidos", () => {
  const payments = mergePayments(parseMovimentacaoRows(toRows()));
  const s = summarizeReceived(payments, "2026-11-14");

  it("totales: histórico, últimos 12 meses y año en curso", () => {
    expect(s.total).toBe(171);
    expect(s.last12m).toBe(171); // 12/2025 entra (ventana: dic-2025 a nov-2026)
    expect(s.ytd).toBe(135);
    expect(s.lastDate).toBe("2026-11-14");
  });

  it("por tipo, por año, por mes y por activo", () => {
    expect(s.byType).toEqual({ dividendo: 36, jcp: 32.9, rendimento: 102.1, outro: 0 });
    expect(s.byYear.map((y) => [y.year, y.total])).toEqual([["2026", 135], ["2025", 36]]);
    expect(s.byMonth).toHaveLength(12);
    expect(s.byMonth[0].month).toBe("2025-12");
    expect(s.byMonth.at(-1)).toMatchObject({ month: "2026-11", rendimento: 102.1, total: 102.1 });
    expect(s.byTicker[0]).toMatchObject({ ticker: "MXRF11", total: 102.1, count: 1 });
  });

  it("sin pagos no falla", () => {
    const e = summarizeReceived([], "2026-11-14");
    expect(e.total).toBe(0);
    expect(e.lastDate).toBeNull();
    expect(e.byMonth).toHaveLength(12);
  });
});
