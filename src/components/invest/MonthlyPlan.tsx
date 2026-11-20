"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ACCOUNTS } from "@/lib/accounts";
import { planContribution } from "@/lib/contribution";
import { CLASS_LABELS, type PortfolioResponse, type Targets } from "@/lib/types";
import { fmtBRL, fmtPct, fmtPrice, fmtQty } from "@/lib/format";
import { Card, Segmented, TickerAvatar } from "../ui";
import { MoneyInput } from "../calc/Simulator";

const KEY = "invertir:montos"; // clave guardada en el dispositivo: no cambiar
type Amounts = Record<string, { aporte: number; proventos: number }>;
/** Sugerencia por cuenta: aporte del plan y proventos previstos del mes (recibido + a recibir). */
type Defaults = Record<string, { aporte: number; proventos: number; got: number; pending: number }>;
const noop = () => () => {};
const readStored = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const MAX_OPTIONS = [
  { id: "3", label: "3 ativos" },
  { id: "5", label: "5" },
  { id: "8", label: "8" },
] as const;

export function MonthlyPlan({ data, targets, defaults }: { data: PortfolioResponse; targets: Targets; defaults: Defaults }) {
  const raw = useSyncExternalStore(noop, readStored, () => null);
  const stored = useMemo<Amounts | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as Amounts) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const [edited, setEdited] = useState<Amounts | null>(null);
  // El aporte se guarda en el aparelho; los proventos siempre arrancan en el previsto del mes.
  const amounts: Amounts = Object.fromEntries(
    ACCOUNTS.map((a) => [
      a.id,
      {
        aporte: edited?.[a.id]?.aporte ?? stored?.[a.id]?.aporte ?? defaults[a.id]?.aporte ?? 0,
        proventos: edited?.[a.id]?.proventos ?? defaults[a.id]?.proventos ?? 0,
      },
    ]),
  );
  const [max, setMax] = useState<"3" | "5" | "8">("5");

  const set = (id: string, field: "aporte" | "proventos", n: number) => {
    const next = { ...amounts, [id]: { ...(amounts[id] ?? { aporte: 0, proventos: 0 }), [field]: n } };
    setEdited(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, { aporte: v.aporte, proventos: 0 }]))));
    } catch {}
  };

  const budgets = ACCOUNTS.map((a) => ({ id: a.id, label: a.label, amount: (amounts[a.id]?.aporte ?? 0) + (amounts[a.id]?.proventos ?? 0) }));
  const plan = planContribution(data.positions, targets, budgets, Number(max)); // cálculo liviano: no hace falta memorizarlo
  const label = (id: string) => ACCOUNTS.find((a) => a.id === id)?.label ?? id;
  // Notas según el tipo de activo (no por ticker): Selic es liquidez; el largo plazo rinde más en IPCA+.
  const hint = (ticker: string) => {
    const a = data.positions.find((p) => p.asset.ticker === ticker)?.asset;
    if (a?.provider_id?.startsWith("Tesouro Selic"))
      return "Ideal para a reserva de emergência. Se ela já está coberta e o dinheiro é de longo prazo, rende mais no Tesouro IPCA+ 2035 (veja Estratégia, item 1).";
    return null;
  };
  const classes = plan.classesAfter.filter((c) => c.class !== "otros" && c.class !== "fondos").sort((a, b) => b.target - a.target);

  return (
    <div className="space-y-5">
      <Card title="Quanto cada um investe este mês?" subtitle="Aporte novo + proventos do mês. O aporte fica salvo neste aparelho; os proventos começam sempre no previsto do mês.">
        <div className="grid gap-4 sm:grid-cols-2">
          {ACCOUNTS.map((a) => (
            <div key={a.id} className="rounded-xl border border-line p-4">
              <div className="mb-3 font-semibold">{a.label}</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-ink-2">Aporte</span>
                  <div className="mt-1">
                    <MoneyInput value={amounts[a.id]?.aporte ?? 0} onChange={(n) => set(a.id, "aporte", n)} />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs text-ink-2">Proventos a reinvestir</span>
                  <div className="mt-1">
                    <MoneyInput value={amounts[a.id]?.proventos ?? 0} onChange={(n) => set(a.id, "proventos", n)} />
                  </div>
                  {defaults[a.id] && (defaults[a.id].got > 0 || defaults[a.id].pending > 0) && (
                    <span className="mt-1 block text-[11px] text-ink-3">
                      Previsto do mês: {fmtBRL(defaults[a.id].got)} recebido
                      {defaults[a.id].pending > 0 ? ` + ~${fmtBRL(defaults[a.id].pending)} a receber` : ""}
                    </span>
                  )}
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-ink-2">
            Total a investir: <b className="num text-ink">{fmtBRL(plan.cash)}</b>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-3">
            Dividir em
            <Segmented label="Quantidade de ativos" options={MAX_OPTIONS} value={max} onChange={setMax} />
          </div>
        </div>
      </Card>

      {plan.cash <= 0 ? (
        <p className="card p-8 text-center text-sm text-ink-3">Informe quanto cada um investe para ver a recomendação.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="space-y-5">
            {ACCOUNTS.map((a) => {
              const mine = plan.buys.filter((b) => b.account === a.id);
              const budget = budgets.find((b) => b.id === a.id)!.amount;
              if (!budget) return null;
              const spent = mine.reduce((s, b) => s + b.amount, 0);
              return (
                <section key={a.id} className="card overflow-hidden">
                  <header className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                    <h2 className="text-[15px] font-semibold tracking-tight">{label(a.id)} compra</h2>
                    <span className="num text-sm text-ink-2">
                      {fmtBRL(spent)} <span className="text-ink-3">de {fmtBRL(budget)}</span>
                    </span>
                  </header>
                  {mine.length ? (
                    <ul className="divide-y divide-line">
                      {mine.map((b) => (
                        <li key={b.ticker + b.account} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 sm:px-6">
                          <TickerAvatar ticker={b.ticker} cls={b.class} size={38} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold">{b.ticker}</span>
                              <span className="text-xs text-ink-3">{CLASS_LABELS[b.class]}</span>
                            </div>
                            <div className="num text-xs text-ink-3">
                              {b.class === "renta_fija" ? "Aplicar em renda fixa" : `${fmtQty(b.units)} × ${fmtPrice(b.price)}`} · peso {fmtPct(b.weightBefore, 1, false)} → {fmtPct(b.weightAfter, 1, false)} (ideal{" "}
                              {fmtPct(b.idealPct, 1, false)})
                            </div>
                          </div>
                          <div className="num text-right font-semibold">{fmtBRL(b.amount)}</div>
                          {hint(b.ticker) && <p className="basis-full pl-[50px] text-[11px] text-ink-3">{hint(b.ticker)}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-6 py-5 text-sm text-ink-3">Nenhuma compra com este valor.</p>
                  )}
                  {(plan.leftover[a.id] ?? 0) >= 1 && (
                    <p className="border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">
                      Sobram <b className="num">{fmtBRL(plan.leftover[a.id])}</b>: não dá para outra cota; deixe em liquidez (Tesouro Selic ou CDB) para o próximo mês.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          <Card title="Como fica" subtitle="Peso de cada classe antes → depois, contra a meta">
            <ul className="space-y-3.5">
              {classes.map((c) => {
                const maxW = Math.max(c.before, c.after, c.target, 1) * 1.15;
                return (
                  <li key={c.class}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: `var(--c-${c.class})` }} />
                        {CLASS_LABELS[c.class]}
                      </span>
                      <span className="num text-ink-2">
                        {fmtPct(c.before, 1, false)} → <b className="text-ink">{fmtPct(c.after, 1, false)}</b> <span className="text-ink-3">/ {fmtPct(c.target, 0, false)}</span>
                      </span>
                    </div>
                    <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-2">
                      <div className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: `${(c.before / maxW) * 100}%`, background: `var(--c-${c.class})` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.after / maxW) * 100}%`, background: `var(--c-${c.class})`, opacity: c.after > c.before ? 1 : 0 }} />
                      <div className="absolute -top-1 -bottom-1 w-[2px] rounded bg-ink/70" style={{ left: `calc(${(c.target / maxW) * 100}% - 1px)` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
              Só ativos que vocês já têm, sem vender nada. Metas sobre o que vocês administram: a previdência da empresa conta no patrimônio mas fica de fora, e o FGTS não
              é comprado. Prioriza-se o mais atrasado em relação à meta; em cripto, os aportes vão só para BTC e ETH (veja Estratégia). Preços da última cotação.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
