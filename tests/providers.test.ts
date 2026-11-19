import { afterEach, describe, expect, it, vi } from "vitest";
import { brapiProvider, mapBrapiDividends, mapBrapiQuote } from "@/providers/brapi";
import { mapCoingecko } from "@/providers/coingecko";
import { parseTesouroLines, tesouroQuote } from "@/providers/tesouro";
import { manualProvider } from "@/providers/manual";
import { routeAssets } from "@/providers";
import { applyFallback } from "@/lib/portfolio-service";
import type { Asset, Quote, Snapshot } from "@/lib/types";

afterEach(() => vi.unstubAllGlobals());

describe("brapi", () => {
  it("normaliza la cotización", () => {
    const qt = mapBrapiQuote({
      symbol: "petr4",
      regularMarketPrice: 45.3,
      regularMarketPreviousClose: 44.7,
      regularMarketChangePercent: 1.34,
      regularMarketTime: "2026-11-14T00:18:33.000Z",
    })!;
    expect(qt).toMatchObject({ ticker: "PETR4", price: 45.3, previousClose: 44.7, changePct: 1.34, source: "brapi", kind: "market" });
  });

  it("descarta precios inválidos", () => {
    expect(mapBrapiQuote({ symbol: "X", regularMarketPrice: null })).toBeNull();
    expect(mapBrapiQuote({ symbol: "X", regularMarketPrice: 0 })).toBeNull();
  });

  it("mapea proventos", () => {
    const ev = mapBrapiDividends({
      symbol: "MXRF11",
      dividendsData: {
        cashDividends: [{ label: "RENDIMENTO", rate: 0.1, paymentDate: "2026-11-14T03:00:00.000Z", lastDatePrior: "2026-10-31T03:00:00.000Z" }],
      },
    });
    expect(ev).toEqual([{ ticker: "MXRF11", label: "RENDIMENTO", rate: 0.1, paymentDate: "2026-11-14", exDate: "2026-10-31", relatedTo: undefined }]);
  });

  it("si el lote falla reintenta de a uno y reporta los que fallan", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const tickers = decodeURIComponent(url.split("/quote/")[1].split("?")[0]).split(",");
      if (tickers.length > 1) return new Response(JSON.stringify({ error: true, message: "plano limita" }), { status: 400 });
      if (tickers[0] === "BAD3") return new Response(JSON.stringify({ error: true, message: "não encontrado" }), { status: 404 });
      return Response.json({ results: [{ symbol: tickers[0], regularMarketPrice: 10, regularMarketPreviousClose: 9 }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const assets: Asset[] = ["AAA3", "BAD3", "CCC11"].map((t) => ({ ticker: t, class: "acciones", quantity: 1 }));
    const r = await brapiProvider.getQuotes(assets);
    expect(r.quotes.map((x) => x.ticker).sort()).toEqual(["AAA3", "CCC11"]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].tickers).toEqual(["BAD3"]);
  });
});

describe("coingecko", () => {
  it("usa provider_id y deriva el cierre anterior desde la variación 24h", () => {
    const [qt] = mapCoingecko([{ ticker: "AVAX", class: "cripto", quantity: 1, provider_id: "avalanche-2" }], {
      "avalanche-2": { brl: 110, brl_24h_change: 10, last_updated_at: 1794667810 },
    });
    expect(qt.ticker).toBe("AVAX");
    expect(qt.previousClose).toBeCloseTo(100, 10);
    expect(qt.asOf).toBe(new Date(1794667810 * 1000).toISOString());
  });
});

describe("tesouro", () => {
  const csv = [
    "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha",
    "Tesouro IPCA+;15/05/2029;12/11/2026;7,42;7,54;3998,55;3986,20;3986,20",
    "Tesouro IPCA+;15/05/2029;13/11/2026;7,47;7,59;3995,96;3982,95;3982,95",
    "Tesouro IPCA+;15/05/2029;11/11/2026;7,40;7,50;3990,00;3980,00;3980,00",
    "Tesouro Selic;01/03/2031;13/11/2026;0,11;0,12;20211,26;20192,26;20192,26",
    "Tesouro Selic;01/03/2029;13/11/2026;0,05;0,06;20279,34;20264,35;20264,35",
  ];

  it("toma las 2 fechas más recientes del título pedido", () => {
    const pts = parseTesouroLines(csv, new Set(["Tesouro IPCA+;15/05/2029", "Tesouro Selic;01/03/2031"]));
    expect(pts["Tesouro IPCA+;15/05/2029"].map((p) => p.date)).toEqual(["2026-11-13", "2026-11-12"]);
    expect(pts["Tesouro Selic;01/03/2031"][0].pu).toBeCloseTo(20192.26, 6);
    expect(pts["Tesouro Selic;01/03/2029"]).toBeUndefined();
    const qt = tesouroQuote("IPCA+2029", pts["Tesouro IPCA+;15/05/2029"])!;
    expect(qt.price).toBeCloseTo(3982.95, 6);
    expect(qt.previousClose).toBeCloseTo(3986.2, 6);
    expect(qt.asOf.startsWith("2026-11-13")).toBe(true);
  });
});

describe("manual + ruteo + fallback", () => {
  it("valor manual por unidad", async () => {
    const r = await manualProvider.getQuotes([{ ticker: "FGTS", class: "renta_fija", quantity: 1, provider: "manual", manual_value: 27531, manual_date: "2026-11-14" }]);
    expect(r.quotes[0]).toMatchObject({ price: 27531, kind: "manual" });
  });

  it("rutea por clase o por provider explícito", () => {
    const { groups } = routeAssets([
      { ticker: "PETR4", class: "acciones", quantity: 1 },
      { ticker: "BTC", class: "cripto", quantity: 1 },
      { ticker: "X", class: "renta_fija", quantity: 1, provider: "tesouro" },
    ]);
    expect([...groups.keys()].map((p) => p.id).sort()).toEqual(["brapi", "coingecko", "tesouro"]);
  });

  it("completa con el snapshot conservando la fecha original", () => {
    const old: Quote = { ticker: "PETR4", price: 40, previousClose: 39, changePct: 2.5, asOf: "2026-11-10T20:00:00Z", source: "brapi", kind: "market" };
    const snap = { quotes: { PETR4: old } } as unknown as Snapshot;
    const quotes = new Map<string, Quote>();
    const used = applyFallback([{ ticker: "PETR4", class: "acciones", quantity: 1 }], quotes, snap);
    expect(used).toEqual(["PETR4"]);
    expect(quotes.get("PETR4")).toMatchObject({ price: 40, kind: "fallback", asOf: "2026-11-10T20:00:00Z" });
  });
});

describe("brapi: errores de cuenta", () => {
  it("ante 403 de plan corta y no sigue gastando requests", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: true, message: "Dividendos e JCP requer o plano Startup" }), { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { brapiDividendProvider } = await import("@/providers/brapi");
    const assets: Asset[] = ["AAA3", "BBB3", "CCC11"].map((t) => ({ ticker: t, class: "acciones", quantity: 1 }));
    const r = await brapiDividendProvider.getDividends(assets);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].tickers).toEqual(["AAA3", "BBB3", "CCC11"]);
    expect(r.errors[0].message).toBe("HTTP 403: Dividendos e JCP requer o plano Startup");
  });
});

import { mapDolarApi } from "@/providers/dolarapi";
describe("dolarapi", () => {
  it("usa el valor de venta y la fecha de São Paulo", () => {
    expect(mapDolarApi("usdArs", "Dólar oficial", { moneda: "USD", casa: "oficial", compra: 1525, venta: 1575, fechaActualizacion: "2026-11-17T18:55:00.000Z" })).toEqual({
      id: "usdArs",
      label: "Dólar oficial",
      value: 1575,
      unit: "AR$",
      date: "2026-11-17",
    });
    expect(mapDolarApi("brlArs", "Real", { moneda: "BRL", casa: "oficial", compra: null, venta: null, fechaActualizacion: "" })).toBeNull();
  });
});

import { mapArgentina, parseFredCpi } from "@/providers/inflation";
describe("inflación EE.UU. y Argentina", () => {
  it("CPI: 12 meses sin desestacionalizar y mes desestacionalizado", () => {
    const csv = "observation_date,CPIAUCNS,CPIAUCSL\n2025-10-01,324.0,323.5\n2026-09-01,336.94,336.298\n2026-10-01,337.511,337.476\n";
    const r = parseFredCpi(csv);
    expect(r.find((i) => i.id === "cpiUs12m")).toMatchObject({ value: 4.17, date: "2026-10-01", unit: "% 12m" });
    expect(r.find((i) => i.id === "cpiUsMes")).toMatchObject({ value: 0.35, unit: "% mes" });
  });
  it("si falta el mes del año anterior usa el último mes comparable", () => {
    const csv = "observation_date,CPIAUCNS,CPIAUCSL\n2025-09-01,324.8,324.245\n2025-10-01,,\n2026-09-01,336.94,336.298\n2026-10-01,337.511,337.476\n";
    expect(parseFredCpi(csv).find((i) => i.id === "cpiUs12m")).toMatchObject({ value: 3.74, date: "2026-09-01" });
  });
  it("sin el mismo mes del año anterior no inventa el 12 meses", () => {
    expect(parseFredCpi("observation_date,CPIAUCNS,CPIAUCSL\n2026-10-01,337.5,.\n").map((i) => i.id)).toEqual([]);
  });
  it("Argentina: último dato de cada serie con su mes", () => {
    const r = mapArgentina([{ fecha: "2026-10-31", valor: 2.2 }], [{ fecha: "2026-09-30", valor: 33.4 }, { fecha: "2026-10-31", valor: 33.1 }]);
    expect(r).toEqual([
      { id: "ipcAr12m", label: "Argentina", value: 33.1, unit: "% 12m", date: "2026-10-01" },
      { id: "ipcArMes", label: "Argentina mês", value: 2.2, unit: "% mes", date: "2026-10-01" },
    ]);
  });
});
