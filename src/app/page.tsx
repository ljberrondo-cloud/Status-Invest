"use client";

import { useJson, usePortfolio } from "@/components/data";
import { Heatmap } from "@/components/charts";
import { Hero } from "@/components/home/Hero";
import { MarketClock } from "@/components/home/MarketClock";
import { AlertsCard, AllocationCard, IncomeCard, MoversCard } from "@/components/home/Cards";
import { MarketStrip } from "@/components/AppShell";
import { Card, ErrorState, ProviderErrors, Skeleton } from "@/components/ui";
import { classPctOfInvestable, type Alert } from "@/lib/alerts";
import type { HistoryPoint, Targets } from "@/lib/types";
import type { ReceivedSummary } from "@/lib/received";

const today = () => {
  const s = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function Resumen() {
  const { data, error } = usePortfolio();
  const history = useJson<{ history: HistoryPoint[] }>("/api/history");
  const received = useJson<{ imported: boolean; summary?: ReceivedSummary }>("/api/received");
  const alerts = useJson<{ targets: Targets | null; alerts: Alert[] }>("/api/alerts");

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data) return <LoadingResumen />;
  const rec = received.data?.imported ? (received.data.summary ?? null) : null;

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Resumen</h1>
          <p className="mt-1 text-sm text-ink-3">
            {today()} · {data.positions.length} activos
          </p>
        </div>
        <MarketClock className="w-full sm:w-auto sm:min-w-[540px]" />
      </div>

      {data.missing.length > 0 && (
        <p className="rounded-xl bg-neg-bg px-4 py-2.5 text-sm text-neg">
          {data.missing.length} activo{data.missing.length > 1 ? "s" : ""} sin cotización quedan fuera del total ({data.missing.slice(0, 4).join(", ")}
          {data.missing.length > 4 ? "…" : ""}).
        </p>
      )}
      <ProviderErrors errors={data.errors} />

      <Hero data={data} history={history.data?.history ?? null} received={rec} />
      <MarketStrip />

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <AllocationCard
          classes={data.byClass}
          total={data.total}
          targets={alerts.data?.targets ?? null}
          managedPct={alerts.data?.targets ? classPctOfInvestable(data, alerts.data.targets) : null}
          className="lg:col-span-7"
        />
        <MoversCard positions={data.positions} className="lg:col-span-5" />
        <IncomeCard received={rec} className="lg:col-span-7" />
        <AlertsCard alerts={alerts.data?.alerts ?? null} className="lg:col-span-5" />
        <Card title="Mapa de calor" subtitle="Variación del día · el tamaño es el valor de cada posición" className="lg:col-span-12">
          <Heatmap positions={data.positions} />
        </Card>
      </div>
      <p className="pb-2 text-center text-[11px] text-ink-3">
        Precios: brapi (B3), CoinGecko, Tesouro Transparente y Banco Central. Valores manuales: Zurich y FGTS.
      </p>
    </div>
  );
}

function LoadingResumen() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-[420px]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

