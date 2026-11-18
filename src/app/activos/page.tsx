"use client";

import { useMemo, useState } from "react";
import { useJson, usePortfolio } from "@/components/data";
import { AssetGroups, type AssetExtra } from "@/components/AssetGroups";
import { ErrorState, PageHeader, ProviderErrors, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { assetTargets } from "@/lib/alerts";
import type { ReceivedSummary } from "@/lib/received";
import type { Targets } from "@/lib/types";
import { fmtBRL, fmtPct, fmtSignedBRL, signClass } from "@/lib/format";

export default function Activos() {
  const { data, error } = usePortfolio();
  const alerts = useJson<{ targets: Targets | null }>("/api/alerts");
  const received = useJson<{ imported: boolean; summary?: ReceivedSummary }>("/api/received");
  const [query, setQuery] = useState("");

  const extra = useMemo(() => {
    const out: Record<string, AssetExtra> = {};
    if (!data) return out;
    const t = alerts.data?.targets ? assetTargets(data, alerts.data.targets) : {};
    const rec = new Map((received.data?.summary?.byTicker ?? []).map((r) => [r.ticker, r.total]));
    for (const p of data.positions) {
      const x = t[p.asset.ticker];
      out[p.asset.ticker] = { idealPct: x?.idealPct ?? 0, buy: x?.buy ?? false, received: rec.get(p.asset.ticker) ?? 0 };
    }
    return out;
  }, [data, alerts.data, received.data]);

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data) return <Skeleton className="h-96" />;

  const metrics = [
    { label: "Valor actual", value: fmtBRL(data.total), tone: null as number | null },
    { label: "Invertido", value: fmtBRL(data.invested), tone: null },
    { label: "Ganancia de capital", value: fmtSignedBRL(data.gain), tone: data.gain },
    { label: "Variación", value: fmtPct(data.gainPct), tone: data.gainPct },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Activos" subtitle={`${data.positions.length} activos en ${data.byClass.length} clases, de mayor a menor valor`} />
      <dl className="card grid grid-cols-2 gap-y-4 py-4 sm:grid-cols-4 sm:divide-x sm:divide-line">
        {metrics.map((m) => (
          <div key={m.label} className="px-5">
            <dt className="text-xs text-ink-3">{m.label}</dt>
            <dd className={`num mt-1 text-lg font-semibold tracking-tight ${m.tone !== null ? signClass(m.tone) : ""}`}>{m.value}</dd>
          </div>
        ))}
      </dl>
      <ProviderErrors errors={data.errors} />
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-[var(--shadow)] focus-within:border-accent sm:max-w-xs">
        <Icon name="search" className="h-4 w-4 text-ink-3" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar activo" className="w-full bg-transparent outline-none placeholder:text-ink-3" />
      </label>
      <AssetGroups classes={data.byClass} positions={data.positions} extra={extra} targets={alerts.data?.targets ?? null} query={query} />
      <p className="text-[11px] leading-relaxed text-ink-3">
        <b>Variación</b>: precio actual vs precio medio. <b>Rentab.</b>: ganancia de capital + proventos recibidos (importados de B3), sobre lo invertido.{" "}
        <b>Ideal</b>: objetivo de la clase ÷ cantidad de activos; <b>Comprar</b> marca los que pesan menos que su ideal. * Precio medio estimado a partir de la
        variación informada por Investidor10.
      </p>
    </div>
  );
}
