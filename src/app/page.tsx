"use client";

import Link from "next/link";
import { useJson, usePortfolio } from "@/components/data";
import { AllocationDonut, Heatmap } from "@/components/charts";
import { KpiCards, MonthlyEvolution } from "@/components/summary";
import { Card, ChangePill, ErrorState, ProviderErrors, Skeleton } from "@/components/ui";
import { fmtBRL, fmtDDMM, fmtPct } from "@/lib/format";
import type { HistoryPoint, Indicator, Targets } from "@/lib/types";
import type { ReceivedSummary } from "@/lib/received";

function Indicators({ items }: { items: Indicator[] }) {
  if (!items.length) return null;
  const fmt = (i: Indicator) =>
    i.unit === "R$" ? i.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 }) : `${i.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <div key={i.id} className="card shrink-0 px-3 py-2" title={`${i.label} · ${i.unit} · al ${fmtDDMM(`${i.date}T12:00:00Z`)}`}>
          <div className="text-[11px] text-ink-3">{i.label}</div>
          <div className="num text-sm font-medium">
            {fmt(i)} <span className="text-[11px] font-normal text-ink-3">{i.unit === "R$" ? "" : i.unit.replace("% ", "")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Resumen() {
  const { data, error } = usePortfolio();
  const history = useJson<{ history: HistoryPoint[] }>("/api/history");
  const received = useJson<{ imported: boolean; summary?: ReceivedSummary }>("/api/received");
  const alerts = useJson<{ targets: Targets | null }>("/api/alerts");

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data) return <LoadingResumen />;
  const targets = alerts.data?.targets;
  const rec = received.data?.imported ? (received.data.summary ?? null) : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <KpiCards data={data} received={rec} />
      {data.missing.length > 0 && (
        <p className="text-xs text-neg">
          {data.missing.length} activo{data.missing.length > 1 ? "s" : ""} sin cotización, fuera del total ({data.missing.slice(0, 4).join(", ")}
          {data.missing.length > 4 ? "…" : ""}).
        </p>
      )}
      <Indicators items={data.indicators} />
      <ProviderErrors errors={data.errors} />

      <Card title="Evolución del patrimonio">
        {history.data ? <MonthlyEvolution history={history.data.history} data={data} /> : <Skeleton className="h-60" />}
      </Card>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Card title="Distribución por clase">
          <AllocationDonut classes={data.byClass} total={data.total} />
        </Card>
        <Card title="Por clase" action={<span className="text-[11px] text-ink-3">actual / ideal · hoy</span>}>
          <ul className="divide-y divide-line">
            {data.byClass.map((c) => (
              <li key={c.class}>
                <Link href={`/activos#${c.class}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--c-${c.class})` }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.label}</span>
                  <span className="num text-xs text-ink-3">
                    {fmtPct(c.weight, 0, false)}
                    {targets ? ` / ${fmtPct(targets.allocation[c.class] ?? 0, 0, false)}` : ""}
                  </span>
                  <span className="num w-24 text-right text-sm text-ink-2">{fmtBRL(c.value)}</span>
                  <ChangePill pct={c.dayChangePct} className="w-16 justify-center" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Mapa de calor · variación del día">
        <Heatmap positions={data.positions} />
      </Card>

      <p className="pb-2 text-center text-[11px] text-ink-3">Precios: brapi (B3), CoinGecko, Tesouro Transparente, Banco Central. Valores manuales: Zurich, FGTS.</p>
    </div>
  );
}

function LoadingResumen() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="h-72" />
      <Skeleton className="h-48" />
    </div>
  );
}
