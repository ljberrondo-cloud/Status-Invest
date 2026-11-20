import { describe, expect, it } from "vitest";
import { applyPositionFiles, baseTicker, monthEndFromName, parsePositions, tesouroTicker, type PositionFile } from "@/lib/b3-positions";
import type { Portfolio } from "@/lib/types";

describe("posiciones del relatório mensal", () => {
  it("fecha de cierre del mes, tickers fraccionarios y Tesouro", () => {
    expect(monthEndFromName("relatorio-consolidado-mensal-2026-outubro.xlsx")).toBe("2026-10-31");
    expect(monthEndFromName("x-relatorio-consolidado-mensal-2026-fevereiro_1.xlsx")).toBe("2026-02-28");
    expect(monthEndFromName("relatorio-consolidado-anual-2025.xlsx")).toBeNull();
    expect(baseTicker("VALE3F")).toBe("VALE3");
    expect(tesouroTicker("Tesouro IPCA+", "2029")).toBe("IPCA+2029");
    expect(tesouroTicker("Tesouro Selic", "2031")).toBe("SELIC2031");
  });

  it("lee acciones, prestadas (doador), fondos, Tesouro con invertido y negociaciones", () => {
    const f = parsePositions(
      [
        { name: "Posição - Ações", rows: [{ Produto: "BBAS3 - BCO BRASIL S.A.", "Código de Negociação": "BBAS3", Quantidade: 94 }, { Produto: "", Quantidade: "" }] },
        { name: "Posição - Empréstimos", rows: [{ Produto: "VIVT3 - TELEFÔNICA BRASIL S.A", Natureza: "Doador", Quantidade: 43 }, { Produto: "PETR4 - PETROBRAS", Natureza: "Tomador", Quantidade: 10 }] },
        { name: "Posição - Fundos", rows: [{ Produto: "HFOF11 - HEDGE TOP FOFII 3", "Código de Negociação": "HFOF11", Quantidade: 910 }] },
        { name: "Posição - Tesouro Direto", rows: [{ Produto: "Tesouro Selic 2031", Vencimento: "01/03/2031", Quantidade: 0.55, "Valor Aplicado": 10760.8 }] },
        { name: "Negociações", rows: [{ "Código de Negociação": "HFOF11", "Período (Inicial)": "15/10/2026", "Quantidade (Compra)": 8, "Quantidade (Venda)": 0, "Preço Médio (Compra)": 6.56 }] },
      ],
      "conta-1",
      "relatorio-consolidado-mensal-2026-outubro.xlsx",
    )!;
    expect(f.asOf).toBe("2026-10-31");
    expect(f.positions.map((p) => [p.ticker, p.class, p.quantity])).toEqual([
      ["BBAS3", "acciones", 94],
      ["VIVT3", "acciones", 43],
      ["HFOF11", "fiis", 910],
      ["SELIC2031", "tesouro", 0.55],
    ]);
    expect(f.positions.at(-1)).toMatchObject({ tesouroId: "Tesouro Selic;01/03/2031", invested: 10760.8 });
    expect(f.trades).toEqual([{ ticker: "HFOF11", buyQty: 8, sellQty: 0, buyAvg: 6.56, from: "2026-10-15" }]);
  });
});

describe("aplicar posiciones por cuenta", () => {
  const base: Portfolio = {
    positions_as_of: { "conta-1": "2026-11-13", "conta-2": "2026-11-15" },
    assets: [
      { ticker: "HFOF11", class: "fiis", quantity: 2575, avg_price: 5.8, accounts: { "conta-1": { quantity: 910 }, "conta-2": { quantity: 1665 } } },
      { ticker: "BBAS3", class: "acciones", quantity: 94, avg_price: 20.76, accounts: { "conta-1": { quantity: 94 } } },
      { ticker: "BTC", class: "cripto", quantity: 0.5 },
    ],
  };
  const nov = (over: Partial<PositionFile> = {}): PositionFile => ({
    account: "conta-1",
    asOf: "2026-11-30",
    positions: [{ ticker: "HFOF11", class: "fiis", quantity: 1010 }],
    trades: [{ ticker: "HFOF11", buyQty: 100, sellQty: 0, buyAvg: 6, from: "2026-11-20" }],
    ...over,
  });

  it("reemplaza la cuenta, suma con la otra y actualiza el precio medio con las compras", () => {
    const { portfolio, changes } = applyPositionFiles(base, [nov()]);
    const h = portfolio.assets.find((a) => a.ticker === "HFOF11")!;
    expect(h.accounts).toEqual({ "conta-1": { quantity: 1010 }, "conta-2": { quantity: 1665 } });
    expect(h.quantity).toBe(2675);
    expect(h.avg_price).toBeCloseTo((2575 * 5.8 + 100 * 6) / 2675, 4);
    // BBAS3 ya no aparece en la cuenta: vendido → sale de la cartera; el cripto (manual) no se toca
    expect(portfolio.assets.map((a) => a.ticker)).toEqual(["HFOF11", "BTC"]);
    expect(portfolio.positions_as_of).toEqual({ "conta-1": "2026-11-30", "conta-2": "2026-11-15" });
    expect(changes.map((c) => [c.ticker, c.before, c.after])).toEqual([
      ["HFOF11", 2575, 2675],
      ["BBAS3", 94, 0],
    ]);
  });

  it("ignora relatórios viejos y compras ya incluidas en los datos de partida", () => {
    expect(applyPositionFiles(base, [nov({ asOf: "2026-10-31" })]).changes).toEqual([]);
    const { portfolio } = applyPositionFiles(base, [nov({ trades: [{ ticker: "HFOF11", buyQty: 100, sellQty: 0, buyAvg: 6, from: "2026-11-05" }] })]);
    expect(portfolio.assets[0].avg_price).toBe(5.8);
  });

  it("agrega activos nuevos y el Tesouro toma el invertido de B3", () => {
    const { portfolio, changes } = applyPositionFiles(base, [
      nov({
        positions: [
          { ticker: "HFOF11", class: "fiis", quantity: 910 },
          { ticker: "BBAS3", class: "acciones", quantity: 94 },
          { ticker: "ITSA4", name: "ITAUSA", class: "acciones", quantity: 100 },
          { ticker: "SELIC2031", class: "tesouro", quantity: 1, tesouroId: "Tesouro Selic;01/03/2031", invested: 20000 },
        ],
        trades: [{ ticker: "ITSA4", buyQty: 100, sellQty: 0, buyAvg: 10, from: "2026-11-20" }],
      }),
    ]);
    expect(portfolio.assets.find((a) => a.ticker === "ITSA4")).toMatchObject({ class: "acciones", quantity: 100, avg_price: 10 });
    expect(portfolio.assets.find((a) => a.ticker === "SELIC2031")).toMatchObject({ provider: "tesouro", provider_id: "Tesouro Selic;01/03/2031", quantity: 1, avg_price: 20000 });
    expect(changes.filter((c) => c.added).map((c) => c.ticker)).toEqual(["ITSA4", "SELIC2031"]);
  });
});
