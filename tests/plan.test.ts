import { describe, expect, it } from "vitest";
import { addMonths, monthDiff, sanitizePlan, trackPlan, upsertContribution, type Plan } from "@/lib/plan";
import { futureValue, monthlyRate, requiredMonthly } from "@/lib/calculator";

const plan: Plan = { goal: 1_000_000, targetMonth: "2036-11", ratePct: 12, plannedMonthly: 3000, startMonth: "2026-09", startValue: 380_000 };

describe("plan y seguimiento mensual", () => {
  it("aritmética de meses", () => {
    expect(monthDiff("2026-11", "2036-11")).toBe(120);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -2)).toBe("2026-11");
  });

  it("registrar, reemplazar y borrar aportes", () => {
    let l = upsertContribution([], "2026-11", 4000);
    l = upsertContribution(l, "2026-09", 2500);
    expect(l.map((c) => c.month)).toEqual(["2026-09", "2026-11"]);
    l = upsertContribution(l, "2026-11", 4500);
    expect(l.find((c) => c.month === "2026-11")?.amount).toBe(4500);
    expect(upsertContribution(l, "2026-09", 0).map((c) => c.month)).toEqual(["2026-11"]);
  });

  it("planeado vs real, mes a mes, hasta el mes actual", () => {
    const t = trackPlan(plan, [{ month: "2026-09", amount: 2500 }, { month: "2026-11", amount: 4000 }], 400_000, "2026-11");
    expect(t.rows.map((r) => [r.month, r.planned, r.actual])).toEqual([
      ["2026-09", 3000, 2500],
      ["2026-10", 3000, 0],
      ["2026-11", 3000, 4000],
    ]);
    expect(t.totalPlanned).toBe(9000);
    expect(t.totalActual).toBe(6500);
    expect(t.diff).toBe(-2500);
    expect(t.avgActual).toBeCloseTo(6500 / 3, 8); // promedio sobre los meses del plan (octubre cuenta como 0)
    expect(t.monthsLeft).toBe(120);
  });

  it("lo necesario desde hoy usa el patrimonio real y los meses que quedan", () => {
    const t = trackPlan(plan, [], 400_000, "2026-11");
    const r = monthlyRate(12);
    expect(t.requiredNow).toBeCloseTo(requiredMonthly(400_000, 1_000_000, r, 120), 6);
    expect(t.valueAtTargetPlanned).toBeCloseTo(futureValue(400_000, 3000, r, 120), 4);
    expect(t.avgActual).toBe(0);
  });

  it("valida el plan que llega de la app", () => {
    expect(sanitizePlan(plan)).toEqual(plan);
    expect(sanitizePlan({ ...plan, targetMonth: "2026-08" })).toBeNull(); // antes del inicio
    expect(sanitizePlan({ ...plan, goal: -1 })).toBeNull();
    expect(sanitizePlan({ ...plan, startMonth: "2026-13" })).toBeNull();
  });
});
