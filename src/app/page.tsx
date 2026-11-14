"use client";

import Link from "next/link";
import { useJson, usePortfolio } from "@/components/data";
import { AllocationDonut, EvolutionChart, Heatmap } from "@/components/charts";
import { Card, ChangePill, ChangeText, ErrorState, ProviderErrors, Skeleton } from "@/components/ui";
import { fmtBRL, fmtDDMM, fmtPct, fmtSignedBRL } from "@/lib/format";
import type { HistoryPoint, Indicator } from "@/lib/types";

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
  const { data, error, isLoading } = usePortfolio();
  const history = useJson<{ history: HistoryPoint[] }>("/api/history");

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data || (isLoading && !data)) return <LoadingResumen />;

  const manualTotal = data.positions.filter((p) => p.status === "manual").reduce((s, p) => s + (p.value ?? 0), 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="pt-2 pb-1">
        <div className="text-sm text-ink-3">Patrimonio total</div>
        <div className="num mt-1 text-[2.4rem] leading-none font-semibold tracking-tight sm:text-5xl">{fmtBRL(data.total)}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
          <ChangeText value={data.dayChange}>{fmtSignedBRL(data.dayChange)}</ChangeText>
          <ChangePill pct={data.dayChangePct} />
          <span className="text-ink-3">hoy</span>
        </div>
        {(data.missing.length > 0 || manualTotal > 0) && (
          <p className="mt-2 text-xs text-ink-3">
            {manualTotal > 0 && <>Incluye {fmtBRL(manualTotal)} en valores manuales. </>}
            {data.missing.length > 0 && <span className="text-neg">
                {data.missing.length} activo{data.missing.length > 1 ? "s" : ""} sin cotización, fuera del total ({data.missing.slice(0, 4).join(", ")}
                {data.missing.length > 4 ? "…" : ""}).
              </span>}
          </p>
        )}
      </section>

      <Indicators items={data.indicators} />
      <ProviderErrors errors={data.errors} />

      <Card title="Evolución">
        {history.data ? (
          <EvolutionChart history={history.data.history} liveTotal={data.total} />
        ) : (
          <Skeleton className="h-52" />
        )}
      </Card>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Card title="Distribución por clase">
          <AllocationDonut classes={data.byClass} total={data.total} />
        </Card>
        <Card title="Por clase, hoy">
          <ul className="divide-y divide-line">
            {data.byClass.map((c) => (
              <li key={c.class}>
                <Link href={`/clase/${c.class}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--c-${c.class})` }} />
                  <span className="flex-1 text-sm">{c.label}</span>
                  {c.value === 0 ? (
                    <span className="text-xs text-neg">Sin cotización</span>
                  ) : (
                    <span className="num text-sm text-ink-2">{fmtBRL(c.value)}</span>
                  )}
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

      <p className="pb-2 text-center text-[11px] text-ink-3">
        Precios: brapi (B3), CoinGecko, Tesouro Transparente, Banco Central. Variación hoy {fmtPct(data.dayChangePct)} sobre activos con cotización de mercado.
      </p>
    </div>
  );
}

function LoadingResumen() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-11 w-64" />
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}
