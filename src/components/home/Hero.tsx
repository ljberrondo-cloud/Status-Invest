"use client";

import { useMemo, useState } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint, PortfolioResponse } from "@/lib/types";
import type { ReceivedSummary } from "@/lib/received";
import { fmtBRL, fmtMoneyInt, fmtBRLCompact, fmtPct, fmtSignedBRL, fmtSince, signClass } from "@/lib/format";
import { addDays, isoDateSP, isoToBr } from "@/lib/dates";
import { ChangePill, Segmented } from "../ui";
import { PrivacyToggle } from "../privacy";

const RANGES = [
  { id: "1m", label: "1M", days: 31 },
  { id: "3m", label: "3M", days: 92 },
  { id: "1a", label: "1A", days: 366 },
  { id: "all", label: "Tudo", days: 0 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDay = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/**
 * Serie diaria de patrimonio e invertido. Sólo puntos con "invertido" registrado
 * (los anteriores se calcularon con otra cartera) + el valor en vivo de hoy.
 */
export function dailySeries(history: HistoryPoint[], live: { total: number; invested: number }, days: number) {
  const today = isoDateSP();
  const pts = history
    .filter((h) => typeof h.invested === "number" && h.date < today)
    .map((h) => ({ date: h.date, total: h.total, invested: h.invested as number }));
  pts.push({ date: today, ...live });
  return days ? pts.filter((p) => p.date >= addDays(today, -days)) : pts;
}

function PortfolioChart({ series }: { series: ReturnType<typeof dailySeries> }) {
  if (series.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-line text-center text-sm text-ink-3">
        <p className="font-medium text-ink-2">A curva é montada com o snapshot diário</p>
        <p className="mt-1 text-xs">Aparece a partir do segundo dia de dados.</p>
      </div>
    );
  }
  const values = series.flatMap((p) => [p.total, p.invested]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || max * 0.02;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={32} dy={6} />
        <YAxis
          orientation="right"
          domain={[min - pad, max + pad]}
          tickFormatter={(v: number) => fmtBRLCompact(v)}
          tick={{ fill: "var(--text-3)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={84}
          tickCount={4}
        />
        <Tooltip
          cursor={{ stroke: "var(--text-3)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (typeof series)[number] | undefined;
            if (!active || !p) return null;
            const g = p.total - p.invested;
            return (
              <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-lg)]">
                <div className="mb-1.5 font-medium text-ink-2">{isoToBr(p.date)}</div>
                <div className="num flex items-center justify-between gap-6">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className="h-0.5 w-3 rounded bg-accent" />
                    Patrimônio
                  </span>
                  <span className="font-semibold">{fmtBRL(p.total)}</span>
                </div>
                <div className="num mt-1 flex items-center justify-between gap-6">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className="h-0 w-3 border-t border-dashed border-ink-3" />
                    Investido
                  </span>
                  {fmtBRL(p.invested)}
                </div>
                <div className={`num mt-1.5 border-t border-line pt-1.5 text-right font-medium ${signClass(g)}`}>{fmtSignedBRL(g)}</div>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2.25} fill="url(#heroFill)" activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
        <Line type="monotone" dataKey="invested" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Patrimonio total, equivalentes en otras monedas y métricas principales (sin el gráfico). */
export function Hero({ data, received }: { data: PortfolioResponse; received: ReceivedSummary | null }) {
  const prov = received?.total ?? 0;
  const result = data.gain + prov;
  const rent = data.invested > 0 ? (result / data.invested) * 100 : null;
  // Equivalentes: dólar PTAX (R$ por US$) y real oficial en pesos (AR$ por R$).
  const usd = data.indicators.find((i) => i.id === "usd" && i.value > 0);
  const ars = data.indicators.find((i) => i.id === "brlArs" && i.value > 0);

  return (
    <section className="card hero overflow-hidden">
      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <div className="eyebrow">Patrimônio total</div>
          <PrivacyToggle className="h-7 w-7" />
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="num text-[2.1rem] leading-none font-semibold tracking-[-0.035em] sm:text-[2.6rem]">{fmtBRL(data.total)}</div>
          {(usd || ars) && (
            <div className="flex items-end gap-5 pb-0.5 sm:border-l sm:border-line-strong sm:pl-6">
              {usd && (
                <div title={`Dólar PTAX (BCB): R$ ${usd.value.toLocaleString("pt-BR", { minimumFractionDigits: 4 })} em ${isoToBr(usd.date)}`}>
                  <div className="text-[11px] text-ink-3">Em dólar</div>
                  <div className="num text-lg leading-tight font-semibold tracking-tight text-ink-2 sm:text-xl">{fmtMoneyInt("US$", data.total / usd.value)}</div>
                </div>
              )}
              {ars && (
                <div title={`Real oficial: AR$ ${ars.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em ${isoToBr(ars.date)}`}>
                  <div className="text-[11px] text-ink-3">Em peso argentino</div>
                  <div className="num text-lg leading-tight font-semibold tracking-tight text-ink-2 sm:text-xl">{fmtMoneyInt("AR$", data.total * ars.value)}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="flex items-center gap-2 whitespace-nowrap">
            <ChangePill pct={data.dayChangePct} size="md" />
            <span className={`num font-medium ${signClass(data.dayChange)}`}>{fmtSignedBRL(data.dayChange)}</span>
            <span className="text-ink-3">hoje</span>
          </span>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-y-4 rounded-2xl border border-line/80 bg-surface/60 py-4 sm:grid-cols-4 sm:divide-x sm:divide-line">
          {[
            { label: "Investido", value: fmtBRL(data.invested), tone: null as number | null },
            { label: "Ganho de capital", value: `${fmtSignedBRL(data.gain)}`, extra: fmtPct(data.gainPct, 1), tone: data.gain },
            { label: received?.firstDate ? `Proventos desde ${fmtSince(received.firstDate)}` : "Proventos", value: received ? fmtBRL(prov) : "—", tone: null },
            { label: "Rentabilidade total", value: fmtPct(rent), tone: rent },
          ].map((m) => (
            <div key={m.label} className="px-4 sm:px-5">
              <dt className="text-xs text-ink-3">{m.label}</dt>
              <dd className={`num mt-1 text-base font-semibold tracking-tight sm:text-[17px] ${m.tone !== null ? signClass(m.tone) : ""}`}>
                {m.value}
                {m.extra && <span className="block text-xs font-medium sm:ml-1 sm:inline">({m.extra})</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Evolución del patrimonio contra lo invertido, con selector de período. */
export function HistoryCard({ data, history, className = "" }: { data: PortfolioResponse; history: HistoryPoint[] | null; className?: string }) {
  const [range, setRange] = useState<RangeId>("3m");
  const days = RANGES.find((r) => r.id === range)!.days;
  const series = useMemo(() => (history ? dailySeries(history, { total: data.total, invested: data.invested }, days) : []), [history, data, days]);
  const first = series[0];
  const periodDelta = first && series.length > 1 ? data.total - first.total : null;
  return (
    <section className={`card px-2 pt-5 pb-3 sm:px-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Evolução do patrimônio</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-accent" /> Patrimônio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-[1.5px] border-dashed border-ink-3" /> Investido
            </span>
            {periodDelta !== null && (
              <span className="flex items-center gap-1.5">
                <span className={`num font-medium ${signClass(periodDelta)}`}>{fmtSignedBRL(periodDelta)}</span>
                <span className="text-ink-3">no período</span>
              </span>
            )}
          </div>
        </div>
        <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
      </div>
      <div className="h-56 sm:h-72">{history ? <PortfolioChart series={series} /> : <div className="skeleton h-full" />}</div>
    </section>
  );
}
