/**
 * Dónde invertir el aporte del mes (sólo activos que ya están en la cartera, sin vender nada).
 *
 * 1. Objetivo por activo = objetivo de su clase × su peso dentro de la clase (`asset_weights`, o partes
 *    iguales), sobre el patrimonio después del aporte. Peso 0 = se mantiene pero no se le aporta.
 * 2. El aporte se reparte primero entre las clases por debajo de su objetivo, en proporción a lo que
 *    les falta; dentro de cada clase va a los activos más atrasados. El límite de N activos se
 *    reparte entre las clases que más reciben.
 * 3. Cuotas enteras en acciones/FIIs/ETFs; fracciones en cripto y Tesouro (0,01 título); CDB en reales.
 *    Lo que sobra por redondeo se usa para cuotas enteras de los activos más atrasados que entren.
 * 4. Cada compra se asigna a una cuenta (la que ya tiene ese activo, si le alcanza el presupuesto).
 */
import { shareInClass } from "./alerts";
import type { AssetClass, Position, Targets } from "./types";

export interface Budget {
  id: string;
  label: string;
  amount: number;
}

export interface Buy {
  ticker: string;
  name?: string;
  class: AssetClass;
  price: number;
  units: number;
  amount: number;
  account: string;
  idealPct: number;
  weightBefore: number;
  weightAfter: number;
}

export interface ContributionPlan {
  cash: number;
  invested: number;
  leftover: Record<string, number>;
  buys: Buy[];
  classesAfter: { class: AssetClass; before: number; after: number; target: number }[];
}

/** Compras menores a esto no se recomiendan (no vale la pena la operación). */
const MIN_PIECE = 50;

/** Clases que no se compran: FGTS (no es inversión) y las que tienen objetivo 0%. */
const NOT_BUYABLE: AssetClass[] = ["otros"];

type Step = "whole" | "tesouro" | "free";
const stepOf = (p: Position): Step => (p.asset.provider === "cdi" || p.asset.class === "cripto" ? "free" : p.asset.class === "tesouro" ? "tesouro" : "whole");
/** Precio de una unidad comprable: el CDB se compra en reales. */
const unitPrice = (p: Position) => (p.asset.provider === "cdi" ? 1 : (p.price ?? 0));

function roundUnits(step: Step, amount: number, price: number): number {
  if (price <= 0) return 0;
  const u = amount / price;
  if (step === "whole") return Math.floor(u + 1e-9);
  if (step === "tesouro") return Math.floor(u * 100 + 1e-9) / 100;
  return Math.floor(u * 1e8) / 1e8;
}

export function planContribution(positions: Position[], targets: Targets, budgets: Budget[], maxAssets = 5): ContributionPlan {
  const cash = Math.max(0, budgets.reduce((s, b) => s + Math.max(0, b.amount), 0));
  const total = positions.reduce((s, p) => s + (p.value ?? 0), 0);
  const after = total + cash;

  const eligible = positions.filter(
    (p) =>
      p.value !== null &&
      (p.price ?? 0) > 0 &&
      p.status !== "missing" &&
      !NOT_BUYABLE.includes(p.asset.class) &&
      p.asset.provider !== "manual" &&
      (targets.allocation[p.asset.class] ?? 0) > 0,
  );
  const perClass = new Map<AssetClass, string[]>();
  for (const p of eligible) perClass.set(p.asset.class, [...(perClass.get(p.asset.class) ?? []), p.asset.ticker]);
  const idealOf = (p: Position) => ((targets.allocation[p.asset.class] ?? 0) / 100) * shareInClass(p.asset.ticker, p.asset.class, perClass.get(p.asset.class) ?? [], targets) * after;

  // Brecha de cada clase: una clase por encima de su objetivo no recibe aportes, aunque alguno de sus
  // activos esté por debajo de su parte; y a una clase no se le asigna más de lo que le falta.
  const classGap = new Map<AssetClass, number>();
  for (const c of perClass.keys()) {
    const value = positions.filter((p) => p.asset.class === c).reduce((s, p) => s + (p.value ?? 0), 0);
    classGap.set(c, Math.max(0, ((targets.allocation[c] ?? 0) / 100) * after - value));
  }
  const raw0 = eligible.map((p) => ({ p, ideal: idealOf(p), gap: Math.max(0, idealOf(p) - (p.value ?? 0)) }));
  for (const c of perClass.keys()) {
    const items = raw0.filter((x) => x.p.asset.class === c);
    const sum = items.reduce((s, x) => s + x.gap, 0);
    const k = sum > 0 ? Math.min(1, (classGap.get(c) ?? 0) / sum) : 0;
    for (const x of items) x.gap *= k;
  }

  // 1) Reparto entre clases: en proporción a lo que le falta a cada una (si el aporte alcanza para
  //    todas, el resto en proporción al objetivo).
  const buyClasses = [...perClass.keys()].filter((c) => (classGap.get(c) ?? 0) > 0.5 && raw0.some((x) => x.p.asset.class === c && x.gap > 0.5));
  const totalGap = buyClasses.reduce((s, c) => s + (classGap.get(c) ?? 0), 0);
  const tSum = buyClasses.reduce((s, c) => s + (targets.allocation[c] ?? 0), 0) || 1;
  let classCash = new Map<AssetClass, number>(
    buyClasses.map((c) => [c, totalGap >= cash ? (cash * (classGap.get(c) ?? 0)) / (totalGap || 1) : (classGap.get(c) ?? 0) + ((cash - totalGap) * (targets.allocation[c] ?? 0)) / tSum]),
  );

  // 2) Límite de activos: un lugar por clase empezando por la que más recibe; las clases que quedan
  //    afuera ceden su parte a las elegidas.
  const byCash = [...classCash].sort((x, y) => y[1] - x[1]);
  const kept = byCash.slice(0, Math.max(1, maxAssets));
  const dropped = byCash.slice(kept.length).reduce((s, [, v]) => s + v, 0);
  const keptSum = kept.reduce((s, [, v]) => s + v, 0) || 1;
  classCash = new Map(kept.map(([c, v]) => [c, v + (dropped * v) / keptSum]));
  const slots = new Map<AssetClass, number>(kept.map(([c]) => [c, 1]));
  for (let free = Math.max(0, maxAssets - kept.length); free > 0; free--) {
    // el lugar extra va a la clase con más plata por activo
    const [c] = [...slots].sort((x, y) => (classCash.get(y[0]) ?? 0) / y[1] - (classCash.get(x[0]) ?? 0) / x[1])[0] ?? [];
    if (!c) break;
    slots.set(c, (slots.get(c) ?? 0) + 1);
  }

  // 3) Dentro de cada clase, los activos más atrasados (brecha relativa), en proporción a su brecha.
  const chosen: { p: Position; ideal: number; gap: number }[] = [];
  const target = new Map<string, number>();
  for (const [c, money] of classCash) {
    const items = raw0
      .filter((x) => x.p.asset.class === c && x.gap > 0.5 && x.ideal > 0)
      .sort((x, y) => y.gap / y.ideal - x.gap / x.ideal)
      .slice(0, slots.get(c) ?? 1);
    const g = items.reduce((s, x) => s + x.gap, 0) || 1;
    for (const x of items) {
      chosen.push(x);
      target.set(x.p.asset.ticker, (money * x.gap) / g);
    }
  }

  // Redondeo a unidades comprables.
  const units = new Map<string, number>();
  let pool = cash;
  for (const x of chosen) {
    const u = roundUnits(stepOf(x.p), target.get(x.p.asset.ticker) ?? 0, unitPrice(x.p));
    units.set(x.p.asset.ticker, u);
    pool -= u * unitPrice(x.p);
  }
  // Lo que sobra: cuotas enteras de los más atrasados que entren.
  for (let guard = 0; guard < 500; guard++) {
    const cand = chosen
      .filter((x) => stepOf(x.p) === "whole" && unitPrice(x.p) <= pool + 1e-9)
      .map((x) => ({ x, need: (x.ideal - ((x.p.value ?? 0) + (units.get(x.p.asset.ticker) ?? 0) * unitPrice(x.p))) / x.ideal }))
      .sort((a, b) => b.need - a.need)[0];
    if (!cand) break;
    units.set(cand.x.p.asset.ticker, (units.get(cand.x.p.asset.ticker) ?? 0) + 1);
    pool -= unitPrice(cand.x.p);
  }
  // Y lo último, en fracciones (cripto/Tesouro/CDB) si hay alguno elegido y vale la pena.
  const frac = chosen.find((x) => stepOf(x.p) !== "whole");
  if (frac && pool >= MIN_PIECE) {
    const extra = roundUnits(stepOf(frac.p), pool, unitPrice(frac.p));
    units.set(frac.p.asset.ticker, (units.get(frac.p.asset.ticker) ?? 0) + extra);
    pool -= extra * unitPrice(frac.p);
  }

  // Asignación a cuentas.
  const left = new Map(budgets.map((b) => [b.id, Math.max(0, b.amount)]));
  const buys: Buy[] = [];
  const raw = chosen
    .map((x) => ({ x, u: units.get(x.p.asset.ticker) ?? 0 }))
    .filter((y) => y.u > 0)
    .sort((a, b) => b.u * unitPrice(b.x.p) - a.u * unitPrice(a.x.p));
  for (const { x, u } of raw) {
    const price = unitPrice(x.p);
    const holders = Object.entries(x.p.asset.accounts ?? {})
      .filter(([, v]) => v.quantity > 0)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .map(([id]) => id);
    const order = [...holders.filter((id) => left.has(id)), ...[...left.keys()].filter((id) => !holders.includes(id)).sort((a, b) => (left.get(b) ?? 0) - (left.get(a) ?? 0))];
    // Fraccionables (cripto, Tesouro, CDB): si una sola cuenta puede pagar todo, no se parte la compra.
    const fractional = stepOf(x.p) !== "whole";
    const whole = fractional ? order.find((id) => (left.get(id) ?? 0) + 1e-6 >= u * price) : undefined;
    if (whole) {
      order.splice(order.indexOf(whole), 1);
      order.unshift(whole);
    }
    let remaining = u;
    for (const id of order) {
      if (remaining <= 0) break;
      const can = roundUnits(stepOf(x.p), (left.get(id) ?? 0) + 1e-6, price);
      const take = Math.min(remaining, can);
      if (take <= 0) continue;
      // pedazos chicos de una compra fraccionable partida: no se recomiendan (quedan como sobrante)
      if (fractional && take * price < MIN_PIECE && u * price >= MIN_PIECE) continue;
      left.set(id, (left.get(id) ?? 0) - take * price);
      remaining = Math.round((remaining - take) * 1e8) / 1e8;
      buys.push({
        ticker: x.p.asset.ticker,
        name: x.p.asset.name,
        class: x.p.asset.class,
        price: x.p.asset.provider === "cdi" ? 1 : price,
        units: take,
        amount: Math.round(take * price * 100) / 100,
        account: id,
        idealPct: (x.ideal / after) * 100,
        weightBefore: total > 0 ? ((x.p.value ?? 0) / total) * 100 : 0,
        weightAfter: 0,
      });
    }
  }
  // Peso después del aporte (por activo, sumando las compras de ambas cuentas).
  const boughtBy = new Map<string, number>();
  for (const b of buys) boughtBy.set(b.ticker, (boughtBy.get(b.ticker) ?? 0) + b.amount);
  for (const b of buys) {
    const p = positions.find((x) => x.asset.ticker === b.ticker)!;
    b.weightAfter = after > 0 ? (((p.value ?? 0) + (boughtBy.get(b.ticker) ?? 0)) / after) * 100 : 0;
  }

  const classes = [...new Set(positions.map((p) => p.asset.class))];
  const classesAfter = classes.map((c) => {
    const v = positions.filter((p) => p.asset.class === c).reduce((s, p) => s + (p.value ?? 0), 0);
    const add = buys.filter((b) => b.class === c).reduce((s, b) => s + b.amount, 0);
    return { class: c, before: total > 0 ? (v / total) * 100 : 0, after: after > 0 ? ((v + add) / after) * 100 : 0, target: targets.allocation[c] ?? 0 };
  });

  const invested = buys.reduce((s, b) => s + b.amount, 0);
  return {
    cash,
    invested: Math.round(invested * 100) / 100,
    leftover: Object.fromEntries([...left].map(([k, v]) => [k, Math.round(Math.max(0, v) * 100) / 100])),
    buys,
    classesAfter,
  };
}
