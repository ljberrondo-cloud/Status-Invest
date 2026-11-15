"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint, PortfolioResponse } from "@/lib/types";
import type { ReceivedSummary } from "@/lib/received";
import { fmtBRL, fmtBRLCompact, fmtPct, fmtSignedBRL, signClass } from "@/lib/format";
import { isoDateSP } from "@/lib/dates";
import { ChangePill } from "./ui";

function Kpi({ title, value, children, tone }: { title: string; value: React.ReactNode; children?: React.ReactNode; tone?: number | null }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="text-xs text-ink-3">{title}</div>
      <div className={`num text-xl font-semibold tracking-tight sm:text-2xl ${tone !== undefined ? signClass(tone) : ""}`}>{value}</div>
      {children && <div className="num text-xs leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

/** Tarjetas de arriba: patrimonio, invertido, resultado (capital + proventos) y proventos 12 meses. */
export function KpiCards({ data, received }: { data: PortfolioResponse; received: ReceivedSummary | null }) {
  const prov = received?.total ?? 0;
  const result = data.gain + prov;
  const rent = data.invested > 0 ? (result / data.invested) * 100 : null;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <Kpi title="Patrimonio total" value={fmtBRL(data.total)}>
        <span className="flex flex-wrap items-center gap-1.5">
          Hoy <span className={signClass(data.dayChange)}>{fmtSignedBRL(data.dayChange)}</span> <ChangePill pct={data.dayChangePct} />
        </span>
      </Kpi>
      <Kpi title="Valor invertido" value={fmtBRL(data.invested)}>
        Ganancia de capital <span className={signClass(data.gain)}>{fmtSignedBRL(data.gain)}</span> ({fmtPct(data.gainPct)})
      </Kpi>
      <Kpi title="Resultado total" value={fmtSignedBRL(result)} tone={result}>
        {received ? (
          <>
            Capital {fmtSignedBRL(data.gain)} · Proventos {fmtBRL(prov)}
            <br />
            Rentabilidad <span className={signClass(rent)}>{fmtPct(rent)}</span>
          </>
        ) : (
          <>
            Sólo ganancia de capital.{" "}
            <Link href="/proventos" className="text-accent underline-offset-2 hover:underline">
              Importá tus proventos
            </Link>{" "}
            para sumarlos.
          </>
        )}
      </Kpi>
      <Kpi title="Proventos (12 meses)" value={received ? fmtBRL(received.last12m) : "—"}>
        {received ? (
          <>Histórico {fmtBRL(received.total)}</>
        ) : (
          <Link href="/proventos" className="text-accent underline-offset-2 hover:underline">
            Importar extracto de B3
          </Link>
        )}
      </Kpi>
    </div>
  );
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtMonth = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

/**
 * Último punto de cada mes (el mes actual con el valor en vivo), separado en invertido y ganancia.
 * Los meses sin "invertido" registrado (snapshots anteriores al precio medio) se omiten.
 */
export function monthlySeries(history: HistoryPoint[], live: { total: number; invested: number } | null) {
  const today = isoDateSP();
  const byMonth = new Map<string, { total: number; invested: number }>();
  for (const h of [...history].sort((a, b) => a.date.localeCompare(b.date))) {
    if (typeof h.invested === "number" && h.date < today) byMonth.set(h.date.slice(0, 7), { total: h.total, invested: h.invested });
  }
  if (live) byMonth.set(today.slice(0, 7), live);
  return [...byMonth]
    .slice(-12)
    .map(([month, v]) => ({ month, invested: v.invested, gain: v.total - v.invested, total: v.total }));
}

export function MonthlyEvolution({ history, data }: { history: HistoryPoint[]; data: PortfolioResponse }) {
  const series = useMemo(() => monthlySeries(history, data.invested > 0 ? { total: data.total, invested: data.invested } : null), [history, data]);
  if (!series.length) return <p className="text-sm text-ink-3">Cargá el precio medio de tus activos para ver la evolución.</p>;
  return (
    <div>
      <div className="h-60 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} stackOffset="sign" margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={series.length < 4 ? "35%" : "18%"} maxBarSize={56}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v: number) => fmtBRLCompact(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={76} />
            <ReferenceLine y={0} stroke="var(--text-3)" />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const m = payload?.[0]?.payload as (typeof series)[number] | undefined;
                return active && m ? (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium">{fmtMonth(m.month)}</div>
                    <div className="num flex justify-between gap-4">
                      <span className="text-ink-2">Invertido</span>
                      {fmtBRL(m.invested)}
                    </div>
                    <div className="num flex justify-between gap-4">
                      <span className="text-ink-2">Ganancia</span>
                      <span className={signClass(m.gain)}>{fmtSignedBRL(m.gain)}</span>
                    </div>
                    <div className="num mt-1 flex justify-between gap-4 border-t border-line pt-1 font-medium">
                      <span>Patrimonio</span>
                      {fmtBRL(m.total)}
                    </div>
                  </div>
                ) : null;
              }}
            />
            <Bar dataKey="invested" stackId="a" fill="var(--accent)" isAnimationActive={false} />
            <Bar dataKey="gain" stackId="a" fill="var(--gain-bar)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--accent)" }} /> Valor invertido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--gain-bar)" }} /> Ganancia / pérdida de capital
        </span>
      </div>
      {series.length < 3 && (
        <p className="mt-2 text-center text-[11px] text-ink-3">El snapshot diario guarda un punto por día: cada mes se agrega una barra.</p>
      )}
    </div>
  );
}
