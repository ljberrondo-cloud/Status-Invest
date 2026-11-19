import { describe, expect, it } from "vitest";
import { incomeStats } from "@/lib/income-stats";
import type { ReceivedPayment } from "@/lib/received";
import { buildSignal, type SignalInput } from "@/lib/signals";
import { macd, rsi, sma, summarize } from "@/lib/technical";

const ramp = (n: number, from: number, step: number) => Array.from({ length: n }, (_, i) => from + i * step);

describe("indicadores técnicos", () => {
  it("media simple y RSI en extremos", () => {
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5);
    expect(sma([1], 2)).toBeNull();
    expect(rsi(ramp(30, 10, 1))).toBe(100);
    expect(rsi(ramp(30, 40, -1))).toBe(0);
  });
  it("RSI de Wilder con subas y bajas alternadas queda cerca de 50", () => {
    const v = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 1 : -1));
    expect(rsi(v)!).toBeGreaterThan(45);
    expect(rsi(v)!).toBeLessThan(55);
  });
  it("MACD detecta el cambio de dirección", () => {
    // Caída que se acelera (histograma negativo) y después un rebote fuerte.
    const fall = Array.from({ length: 40 }, (_, i) => 100 - 0.03 * i * i);
    const last = fall[fall.length - 1];
    const crossIn = (k: number) => macd([...fall, ...ramp(k, last + 3, 3)], k)?.cross;
    expect(crossIn(1)).toBeNull();
    expect([2, 3, 4, 5].map(crossIn)).toContain("up");
  });
  it("tendencia y caída desde el máximo", () => {
    const up = summarize(ramp(60, 10, 0.5))!;
    expect(up.trend).toBe("alcista");
    expect(up.fromHigh).toBe(0);
    const down = summarize(ramp(60, 50, -0.5))!;
    expect(down.trend).toBe("bajista");
    expect(down.fromHigh).toBeCloseTo((20.5 / 50 - 1) * 100);
    expect(summarize([1, 2, 3])).toBeNull();
  });
});

const base: SignalInput = {
  cls: "acciones",
  excluded: false,
  tech: null,
  pe: null,
  low52: null,
  high52: null,
  price: 10,
  dy: null,
  incomeTrend: null,
  weight: 2,
  maxAssetPct: 12,
  classGap: -6,
  tolerance: 5,
};

describe("señales", () => {
  it("compra: tendencia alcista, barata y su clase abajo del objetivo", () => {
    const r = buildSignal({ ...base, tech: summarize(ramp(60, 10, 0.1)), pe: 6, dy: 9 });
    expect(r.signal).toBe("compra");
  });
  it("las mismas señales con la clase arriba del objetivo quedan en hodl", () => {
    const r = buildSignal({ ...base, tech: summarize(ramp(60, 10, 0.1)), pe: 6, dy: 9, classGap: 8 });
    expect(r.signal).toBe("hodl");
  });
  it("venta: bajista con RSI neutral, cara y con su clase arriba del objetivo", () => {
    const zigzag = Array.from({ length: 60 }, (_, i) => 50 - i * 0.3 + (i % 2 ? 0.8 : -0.8));
    const r = buildSignal({ ...base, tech: summarize(zigzag), pe: 40, classGap: 8 });
    expect(r.signal).toBe("venta");
  });
  it("alerta: empresa con pérdidas o concentración", () => {
    expect(buildSignal({ ...base, pe: -3 }).signal).toBe("alerta");
    expect(buildSignal({ ...base, weight: 20 }).headline).toMatch(/Concentración/);
  });
  it("renta fija y excluidos: hodl", () => {
    expect(buildSignal({ ...base, cls: "tesouro" }).signal).toBe("hodl");
    expect(buildSignal({ ...base, excluded: true, cls: "fondos" }).headline).toMatch(/No se puede mover/);
  });
  it("FII con caída fuerte del rendimiento: alerta", () => {
    const r = buildSignal({ ...base, cls: "fiis", dy: 11, incomeTrend: -30 });
    expect(r.signal).toBe("alerta");
  });
});

describe("rendimiento por cuota", () => {
  const pay = (date: string, unit: number, type: ReceivedPayment["type"] = "rendimento", owner = "Conta 1"): ReceivedPayment => ({
    date, ticker: "MXRF11", type, label: "", quantity: 100, unitValue: unit, amount: unit * 100, owner,
  });
  it("FII: anualiza los últimos pagos, ignora amortizaciones y duplicados entre cuentas", () => {
    const ps = ["2026-05-15", "2026-06-15", "2026-07-15", "2026-08-14", "2026-09-15", "2026-10-15"].map((d) => pay(d, 0.1));
    ps.push(pay("2026-10-15", 0.1, "rendimento", "Conta 2"), pay("2026-09-20", 2, "outro"));
    const s = incomeStats(ps, "MXRF11", 10, "2026-11-19", true);
    expect(s.dy).toBeCloseTo(12);
    expect(s.trend).toBeCloseTo(0);
    expect(s.months).toBe(6);
  });
  it("sin pagos o sin precio: null", () => {
    expect(incomeStats([], "MXRF11", 10, "2026-11-19", true).dy).toBeNull();
  });
});
