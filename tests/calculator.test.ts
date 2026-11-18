import { describe, expect, it } from "vitest";
import { futureValue, monthlyRate, monthsToGoal, projection, realAnnualPct, requiredMonthly } from "@/lib/calculator";

describe("calculadora de metas", () => {
  const r = monthlyRate(12); // 12% a.a. efectivo

  it("tasa mensual equivalente y tasa real", () => {
    expect(Math.pow(1 + r, 12)).toBeCloseTo(1.12, 12);
    expect(realAnnualPct(13.65, 4.63)).toBeCloseTo((1.1365 / 1.0463 - 1) * 100, 10);
  });

  it("valor futuro: capital solo, aportes solos y sin tasa", () => {
    expect(futureValue(1000, 0, r, 12)).toBeCloseTo(1120, 8);
    expect(futureValue(0, 100, 0, 10)).toBe(1000);
    // aportes de 1000/mes durante 12 meses al 1% mensual
    expect(futureValue(0, 1000, 0.01, 12)).toBeCloseTo(1000 * ((1.01 ** 12 - 1) / 0.01), 8);
  });

  it("aporte necesario es la inversa del valor futuro", () => {
    const A = requiredMonthly(100_000, 1_000_000, r, 120);
    expect(A).toBeGreaterThan(0);
    expect(futureValue(100_000, A, r, 120)).toBeCloseTo(1_000_000, 4);
    expect(requiredMonthly(400_000, 1_000_000, r, 120)).toBe(0); // 400 mil al 12% superan 1 millón en 10 años
    expect(requiredMonthly(0, 1200, 0, 12)).toBe(100);
  });

  it("meses hasta la meta, consistente con el valor futuro", () => {
    const n = monthsToGoal(400_000, 5_000, 1_000_000, r);
    expect(futureValue(400_000, 5_000, r, n)).toBeGreaterThanOrEqual(1_000_000);
    expect(futureValue(400_000, 5_000, r, n - 1)).toBeLessThan(1_000_000);
    expect(monthsToGoal(2_000_000, 0, 1_000_000, r)).toBe(0);
    expect(monthsToGoal(0, 0, 1_000, 0)).toBe(Infinity);
    expect(monthsToGoal(0, 100, 1_000, 0)).toBe(10);
  });

  it("proyección año por año", () => {
    const p = projection(1000, 100, 0, 30);
    expect(p.map((x) => x.month)).toEqual([0, 12, 24, 30]);
    expect(p.at(-1)).toMatchObject({ contributed: 4000, earnings: 0, value: 4000 });
  });
});
