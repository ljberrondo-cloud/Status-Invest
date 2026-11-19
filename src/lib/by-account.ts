/**
 * Patrimonio por cuenta (titular). Activos de B3: según la cantidad de cada cuenta (`accounts`).
 * Otros activos: según `owner`; si no tiene, quedan "sin asignar".
 * Invertido por cuenta = cantidad de la cuenta × precio medio (el precio medio es común a ambas
 * cuentas), salvo Tesouro, donde B3 informa el valor aplicado de cada cuenta.
 */
import type { AssetClass, Position } from "./types";

export const UNASSIGNED = "sin-asignar";

export interface AccountItem {
  ticker: string;
  name?: string;
  class: AssetClass;
  quantity: number;
  value: number;
  invested: number | null;
}

export interface AccountSummary {
  id: string;
  label: string;
  count: number;
  value: number;
  invested: number;
  /** Valor de las posiciones con precio medio (para comparar con lo invertido). */
  costedValue: number;
  gain: number;
  gainPct: number | null;
  weight: number;
  items: AccountItem[];
}

export function summarizeByAccount(positions: Position[], accounts: readonly { id: string; label: string }[]): AccountSummary[] {
  const groups = new Map<string, AccountItem[]>();
  const push = (id: string, item: AccountItem) => groups.set(id, [...(groups.get(id) ?? []), item]);
  let total = 0;

  for (const p of positions) {
    if (p.value === null) continue;
    total += p.value;
    const a = p.asset;
    const unit = a.quantity > 0 ? p.value / a.quantity : 0;
    const accs = Object.entries(a.accounts ?? {}).filter(([, v]) => v.quantity > 0);
    if (accs.length) {
      for (const [id, v] of accs) {
        const invested = v.invested ?? (a.avg_price ? v.quantity * a.avg_price : null);
        push(id, { ticker: a.ticker, name: a.name, class: a.class, quantity: v.quantity, value: v.quantity * unit, invested });
      }
    } else {
      push(a.owner ?? UNASSIGNED, { ticker: a.ticker, name: a.name, class: a.class, quantity: a.quantity, value: p.value, invested: p.cost });
    }
  }

  const label = (id: string) => (id === UNASSIGNED ? "Sem atribuição" : (accounts.find((x) => x.id === id)?.label ?? id));
  const order = [...accounts.map((a) => a.id), ...[...groups.keys()].filter((k) => k !== UNASSIGNED && !accounts.some((a) => a.id === k)), UNASSIGNED];
  return order
    .filter((id) => groups.has(id))
    .map((id) => {
      const items = groups.get(id)!.sort((x, y) => y.value - x.value);
      const value = items.reduce((s, i) => s + i.value, 0);
      const costed = items.filter((i) => i.invested !== null);
      const invested = costed.reduce((s, i) => s + (i.invested ?? 0), 0);
      const costedValue = costed.reduce((s, i) => s + i.value, 0);
      const gain = costedValue - invested;
      return {
        id,
        label: label(id),
        count: items.length,
        value,
        invested,
        costedValue,
        gain,
        gainPct: invested > 0 ? (gain / invested) * 100 : null,
        weight: total > 0 ? (value / total) * 100 : 0,
        items,
      };
    });
}
