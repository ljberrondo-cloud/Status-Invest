"use client";

import { useState } from "react";
import { useJson } from "@/components/data";
import { Card, ErrorState, ProviderErrors, Skeleton } from "@/components/ui";
import type { DividendRow } from "@/lib/dividends";
import type { ProviderError } from "@/lib/types";
import { fmtBRL, fmtDateLong, fmtPrice, fmtQty } from "@/lib/format";

interface DividendsResponse {
  range: "week" | "next30";
  start: string;
  end: string;
  rows: DividendRow[];
  total: number;
  errors: ProviderError[];
}

const LABELS: Record<string, string> = { DIVIDENDO: "Dividendo", JCP: "JCP", "JUROS SOBRE CAPITAL PRÓPRIO": "JCP", RENDIMENTO: "Rendimiento" };

export function DividendCalendar() {
  const [range, setRange] = useState<"week" | "next30">("week");
  const { data, error, isLoading } = useJson<DividendsResponse>(`/api/dividends?range=${range}`);

  const byDay = new Map<string, DividendRow[]>();
  for (const r of data?.rows ?? []) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const allFailed = data && data.errors.length > 0 && data.rows.length === 0;
  const planError = data?.errors.find((e) => /plano|plan/i.test(e.message) && /403|402/.test(e.message));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <div className="text-sm text-ink-3">Próximos proventos {range === "week" ? "nesta semana" : "em 30 dias"} (estimado)</div>
          {data ? <div className="num text-3xl font-semibold tracking-tight">{planError || allFailed ? "—" : fmtBRL(data.total)}</div> : <Skeleton className="mt-1 h-9 w-48" />}
          {data && (
            <div className="mt-1 text-xs text-ink-3">
              {fmtDateLong(data.start)} – {fmtDateLong(data.end)} · bruto, para tus cantidades actuales
            </div>
          )}
        </div>
        <div className="flex rounded-full bg-surface-2 p-0.5">
          {(["week", "next30"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 text-xs ${range === r ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-3"}`}
            >
              {r === "week" ? "Semana" : "30 dias"}
            </button>
          ))}
        </div>
      </div>

      {error && !data && <ErrorState message={error.message} />}
      {planError && (
        <div className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
          <p className="font-medium">Seu plano da brapi não inclui proventos</p>
          <p className="mt-1 text-xs">
            O calendário de dividendos e JCP exige o plano Startup da brapi. Se você contratar, esta tela se completa sozinha com o mesmo
            token; não precisa mudar nada no app.
          </p>
        </div>
      )}
      {data && !planError && <ProviderErrors errors={data.errors} summary={`Não foi possível consultar os proventos de ${data.errors.reduce((s, e) => s + e.tickers.length, 0)} ativos.`} />}

      {isLoading && !data ? (
        <Skeleton className="h-64" />
      ) : data && byDay.size === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-3">
            {planError ? "Sem dados de proventos no plano atual." : allFailed ? "Não foi possível consultar o calendário de proventos (veja o detalhe acima)." : "Não há data com nem pagamentos neste período."}
          </p>
        </Card>
      ) : (
        [...byDay].map(([day, rows]) => (
          <Card key={day} title={fmtDateLong(day)} action={<span className="num text-sm font-medium">{fmtBRL(rows.reduce((s, r) => s + r.estimated, 0))}</span>}>
            <ul className="divide-y divide-line">
              {rows.map((r, i) => {
                const isPay = r.date === r.paymentDate;
                return (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.ticker}</span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-3">{LABELS[r.label] ?? r.label}</span>
                        <span className={`text-[11px] ${isPay ? "text-pos" : "text-ink-3"}`}>{isPay ? "Pagamento" : "Data com"}</span>
                      </div>
                      <div className="num mt-0.5 text-xs text-ink-3">
                        {fmtQty(r.quantity)} × {fmtPrice(r.rate)}
                        {r.exDate && ` · data com ${fmtDateLong(r.exDate)}`}
                        {r.paymentDate && ` · pagamento ${fmtDateLong(r.paymentDate)}`}
                      </div>
                    </div>
                    <div className="num shrink-0 font-medium">{fmtBRL(r.estimated)}</div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
      <p className="text-xs text-ink-3">Fonte: brapi. Valores brutos (o JCP tem 15% de IR retido). A estimativa usa a quantidade atual, não a que vocês tinham na data com.</p>
    </div>
  );
}
