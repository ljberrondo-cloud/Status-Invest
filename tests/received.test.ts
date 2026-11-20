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
    const c1 = a.map((p) => ({ ...p, owner: "Conta 1" }));
    const c2 = a.map((p) => ({ ...p, owner: "Conta 2" }));
    const merged = mergePayments(c1, c2, c1);
    expect(merged).toHaveLength(6);
    expect(ownersOf(merged)).toEqual(["Conta 1", "Conta 2"]);
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
    expect(ownerLabel("conta-3")).toBe("Conta 3");
    expect(ownerLabel("conta-extra")).toBe("Conta Extra");
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
    expect(s.firstDate).toBe("2025-12-15");
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

import { reconcileAnnual } from "@/lib/received";
import { parseRelatorio, yearFromName } from "@/lib/b3-relatorio";

describe("relatórios consolidados de B3", () => {
  it("mensual: pagos con fecha, incluye Reembolso como 'otro' y descarta filas de total", () => {
    const r = parseRelatorio(
      [
        {
          name: "Proventos Recebidos",
          rows: [
            { Produto: "BTLG11 - BTG PACTUAL LOGISTICA", Pagamento: "23/10/2026", "Tipo de Evento": "Rendimento", "Instituição": "BANCO BTG PACTUAL S/A.", Quantidade: "12", "Preço unitário": 0.81, "Valor líquido": 9.72 },
            { Produto: "VIVT3 - TELEFÔNICA BRASIL", Pagamento: "20/10/2026", "Tipo de Evento": "Reembolso", "Instituição": "BANCO BTG PACTUAL S/A.", Quantidade: "43", "Preço unitário": 0.5, "Valor líquido": 21.5 },
            { Produto: "", Pagamento: "", "Tipo de Evento": "", "Valor líquido": "Total" },
          ],
        },
      ],
      "relatorio-consolidado-mensal-2026-outubro.xlsx",
    );
    expect(r.kind).toBe("relatorio-mensal");
    expect(r.payments.map((p) => [p.date, p.ticker, p.type, p.quantity, p.amount])).toEqual([
      ["2026-10-23", "BTLG11", "rendimento", 12, 9.72],
      ["2026-10-20", "VIVT3", "outro", 43, 21.5],
    ]);
  });

  it("anual: totales por activo con el año del nombre del archivo", () => {
    expect(yearFromName("d14df0ff-relatorio-consolidado-anual-2025.xlsx")).toBe("2025");
    const r = parseRelatorio([{ name: "Proventos Recebidos", rows: [{ Produto: "CMIG4", "Tipo de Evento": "Dividendo", "Valor líquido": 13.12 }, { Produto: "", "Tipo de Evento": "", "Valor líquido": 13.12 }] }], "relatorio-consolidado-anual-2025.xlsx");
    expect(r.kind).toBe("relatorio-anual");
    expect(r.payments).toEqual([{ date: "2025-01-01", ticker: "CMIG4", type: "dividendo", label: "Dividendo", quantity: null, unitValue: null, amount: 13.12, annual: true }]);
  });

  it("el total anual se descuenta de lo que ya está detallado (no cuenta dos veces)", () => {
    const anual = { date: "2025-01-01", ticker: "MXRF11", type: "rendimento" as const, label: "Rendimento", quantity: null, unitValue: null, amount: 120, annual: true, owner: "Yo" };
    const detalle = { date: "2025-12-15", ticker: "MXRF11", type: "rendimento" as const, label: "Rendimento", quantity: 1000, unitValue: 0.1, amount: 100, owner: "Yo" };
    expect(reconcileAnnual([anual, detalle]).map((p) => [p.annual ?? false, p.amount])).toEqual([[true, 20], [false, 100]]);
    expect(reconcileAnnual([{ ...anual, amount: 100 }, detalle])).toHaveLength(1); // todo detallado
    expect(reconcileAnnual([anual, { ...detalle, owner: "Otra" }])).toHaveLength(2); // otra cuenta: no se descuenta
  });

  it("los totales anuales no entran en el mes ni en los últimos 12 meses", () => {
    const s = summarizeReceived(
      [
        { date: "2025-01-01", ticker: "CMIG4", type: "dividendo", label: "Dividendo", quantity: null, unitValue: null, amount: 500, annual: true },
        { date: "2026-10-10", ticker: "CMIG4", type: "dividendo", label: "Dividendo", quantity: 10, unitValue: 1, amount: 10 },
      ],
      "2026-11-14",
    );
    expect(s.total).toBe(510);
    expect(s.last12m).toBe(10);
    expect(s.byYear.map((y) => [y.year, y.total])).toEqual([["2026", 10], ["2025", 500]]);
    expect(s.byMonth.reduce((t, m) => t + m.total, 0)).toBe(10);
    expect(s.byTicker[0]).toMatchObject({ ticker: "CMIG4", total: 510, last12m: 10, count: 1, lastDate: "2026-10-10" });
    expect(s.firstDate).toBe("2025-01-01");
    expect(s.recent).toHaveLength(1);
  });
});

import { accountLabel } from "@/lib/accounts";
describe("nombres de cuenta", () => {
  it("las carpetas conocidas muestran el nombre elegido", () => {
    expect(accountLabel("conta-1")).toBe("Conta 1");
    expect(accountLabel("conta-2")).toBe("Conta 2");
    expect(accountLabel("otra-cuenta")).toBe("Otra Cuenta");
  });
});
