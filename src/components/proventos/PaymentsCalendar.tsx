"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { isoDateSP } from "@/lib/dates";
import { fmtBRL, fmtBRLCompact, fmtDateLong } from "@/lib/format";
import { RECEIVED_LABELS, type CalendarPayment, type ReceivedType } from "@/lib/received";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const TYPES: ReceivedType[] = ["dividendo", "jcp", "rendimento", "outro"];
const color = (t: ReceivedType) => `var(--r-${t})`;

const shift = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const monthTitle = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** El mismo provento cobrado en las dos cuentas el mismo día = una sola fila con la suma. */
function mergeByDay(list: CalendarPayment[]): CalendarPayment[] {
  const m = new Map<string, CalendarPayment>();
  for (const p of list) {
    const k = `${p.date}|${p.ticker}|${p.type}|${p.estimated ? 1 : 0}`;
    const cur = m.get(k);
    m.set(k, cur ? { ...cur, amount: Math.round((cur.amount + p.amount) * 100) / 100 } : p);
  }
  return [...m.values()];
}

/** Calendario mensual de proventos: recibidos (con fecha) y previstos por historial, día por día. */
export function PaymentsCalendar({ received, upcoming }: { received: CalendarPayment[]; upcoming: CalendarPayment[] }) {
  const today = isoDateSP();
  const all = useMemo(() => mergeByDay([...received, ...upcoming]), [received, upcoming]);
  const first = received.reduce((m, p) => (p.date < m ? p.date : m), today).slice(0, 7);
  const last = all.reduce((m, p) => (p.date > m ? p.date : m), today).slice(0, 7);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);

  const inMonth = all.filter((p) => p.date.startsWith(month));
  const byDay = new Map<string, CalendarPayment[]>();
  for (const p of inMonth) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);
  const got = inMonth.filter((p) => !p.estimated).reduce((s, p) => s + p.amount, 0);
  const expected = inMonth.filter((p) => p.estimated).reduce((s, p) => s + p.amount, 0);

  const [y, m] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  const list = (day ? (byDay.get(day) ?? []) : inMonth).slice().sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const go = (n: number) => {
    setMonth(shift(month, n));
    setDay(null);
  };

  return (
    <Card title="Calendário de proventos" subtitle="Recebidos e previstos. Os previstos são estimados pelo histórico: ativos que pagaram nos últimos 3 meses, no mesmo dia e com o último valor.">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} disabled={month <= first} aria-label="Mês anterior" className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 disabled:opacity-30">
            <Icon name="chevron" className="h-4 w-4 rotate-90" strokeWidth={2} />
          </button>
          <h3 className="min-w-[150px] text-center text-sm font-semibold">{capital(monthTitle(month))}</h3>
          <button onClick={() => go(1)} disabled={month >= last} aria-label="Próximo mês" className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 disabled:opacity-30">
            <Icon name="chevron" className="h-4 w-4 -rotate-90" strokeWidth={2} />
          </button>
          {month !== today.slice(0, 7) && (
            <button onClick={() => {
                setMonth(today.slice(0, 7));
                setDay(null);
              }} className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-surface-2">
              Hoje
            </button>
          )}
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-ink-3">
            Recebido <b className="num font-semibold text-ink">{fmtBRL(got)}</b>
          </span>
          {expected > 0 && (
            <span className="text-ink-3">
              Previsto <b className="num font-semibold text-ink-2">~{fmtBRL(expected)}</b>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-3" aria-hidden>
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ps = byDay.get(d) ?? [];
          const total = ps.reduce((s, p) => s + p.amount, 0);
          const est = ps.length > 0 && ps.every((p) => p.estimated);
          const types = TYPES.filter((t) => ps.some((p) => p.type === t));
          const selected = day === d;
          return (
            <button
              key={d}
              onClick={() => ps.length && setDay(selected ? null : d)}
              disabled={!ps.length}
              aria-pressed={selected}
              aria-label={`${Number(d.slice(8))}${ps.length ? `: ${ps.length} provento${ps.length > 1 ? "s" : ""}${est ? " previstos" : ""}` : ""}`}
              className={`flex min-h-12 flex-col items-start rounded-lg border p-1.5 text-left transition sm:min-h-16 ${
                selected ? "border-accent bg-accent-soft" : ps.length ? (est ? "border-dashed border-line-strong hover:bg-surface-2" : "border-line bg-surface-2/60 hover:bg-surface-2") : "border-transparent"
              }`}
            >
              <span className={`num text-[11px] ${d === today ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent font-semibold text-white" : "text-ink-3"}`}>{Number(d.slice(8))}</span>
              {ps.length > 0 && (
                <>
                  <span className={`num mt-auto hidden text-[11px] font-semibold sm:block ${est ? "text-ink-3" : "text-ink"}`}>
                    {est ? "~" : ""}
                    {fmtBRLCompact(total)}
                  </span>
                  <span className="mt-auto flex gap-0.5 sm:mt-0.5">
                    {types.map((t) => (
                      <span key={t} className="h-1.5 w-1.5 rounded-full" style={{ background: color(t), opacity: est ? 0.5 : 1 }} />
                    ))}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
          <span>{day ? fmtDateLong(day) : `Todos os pagamentos de ${monthTitle(month)}`}</span>
          {day && (
            <button onClick={() => setDay(null)} className="font-medium text-accent hover:underline">
              Ver o mês inteiro
            </button>
          )}
        </div>
        {list.length ? (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {list.map((p, i) => (
              <li key={i} className={`flex items-center gap-2.5 text-sm ${p.estimated ? "text-ink-3" : ""}`}>
                {!day && <span className="num w-16 shrink-0 text-xs text-ink-3">{fmtDateLong(p.date)}</span>}
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color(p.type) }} />
                <span className="font-medium">{p.ticker}</span>
                <span className="hidden truncate text-xs text-ink-3 sm:inline">{RECEIVED_LABELS[p.type].split(" (")[0]}</span>
                {p.estimated && <Badge tone="muted">previsto</Badge>}
                <span className="num ml-auto font-medium">
                  {p.estimated ? "~" : ""}
                  {fmtBRL(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-center text-sm text-ink-3">Nenhum provento neste mês.</p>
        )}
      </div>
    </Card>
  );
}
