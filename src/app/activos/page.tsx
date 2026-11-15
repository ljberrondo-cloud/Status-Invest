"use client";

import { useMemo } from "react";
import { useJson, usePortfolio } from "@/components/data";
import { AssetGroups, type AssetExtra } from "@/components/AssetGroups";
import { ErrorState, ProviderErrors, Skeleton } from "@/components/ui";
import { assetTargets } from "@/lib/alerts";
import type { ReceivedSummary } from "@/lib/received";
import type { Targets } from "@/lib/types";
import { fmtBRL, fmtPct, fmtSignedBRL, signClass } from "@/lib/format";

export default function Activos() {
  const { data, error } = usePortfolio();
  const alerts = useJson<{ targets: Targets | null }>("/api/alerts");
  const received = useJson<{ imported: boolean; summary?: ReceivedSummary }>("/api/received");

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

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <div className="text-sm text-ink-3">Mis activos ({data.positions.length})</div>
          <div className="num text-3xl font-semibold tracking-tight">{fmtBRL(data.total)}</div>
        </div>
        <div className="num text-right text-sm text-ink-3">
          Invertido {fmtBRL(data.invested)}
          <br />
          Capital <span className={signClass(data.gain)}>{fmtSignedBRL(data.gain)}</span> ({fmtPct(data.gainPct)})
        </div>
      </section>
      <ProviderErrors errors={data.errors} />
      <AssetGroups classes={data.byClass} positions={data.positions} extra={extra} targets={alerts.data?.targets ?? null} />
      <p className="text-[11px] text-ink-3">
        <b>Variación</b>: precio actual vs precio medio. <b>Rentab.</b>: ganancia de capital + proventos recibidos (si importaste el extracto de B3), sobre lo
        invertido. <b>% ideal</b>: objetivo de la clase ÷ cantidad de activos; <b>¿Comprar?</b> = pesa menos que su ideal. * Precio medio estimado a partir de la
        variación informada por Investidor10.
      </p>
    </div>
  );
}
