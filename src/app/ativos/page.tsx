"use client";

import { useEffect, useMemo, useState } from "react";
import { useJson, usePortfolio } from "@/components/data";
import { AssetGroups, type AssetExtra } from "@/components/AssetGroups";
import {
  ErrorState,
  PageHeader,
  ProviderErrors,
  Segmented,
  Skeleton,
} from "@/components/ui";
import { ByAccount } from "@/components/ByAccount";
import { Icon } from "@/components/icons";
import { assetTargets, classPctOfInvestable } from "@/lib/alerts";
import type { ReceivedSummary } from "@/lib/received";
import type { Targets } from "@/lib/types";
import { fmtBRL, fmtPct, fmtSignedBRL, signClass } from "@/lib/format";
import { ACCOUNTS } from "@/lib/accounts";
import { isoToBr } from "@/lib/dates";

export default function Activos() {
  const { data, error } = usePortfolio();
  const alerts = useJson<{ targets: Targets | null }>("/api/alerts");
  const received = useJson<{ imported: boolean; summary?: ReceivedSummary }>(
    "/api/received",
  );
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"clase" | "cuenta">("clase");
  // /ativos#contas abre directo la vista por cuenta
  useEffect(() => {
    const sync = () => window.location.hash === "#contas" && setView("cuenta");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const extra = useMemo(() => {
    const out: Record<string, AssetExtra> = {};
    if (!data) return out;
    const t = alerts.data?.targets
      ? assetTargets(data, alerts.data.targets)
      : {};
    const rec = new Map(
      (received.data?.summary?.byTicker ?? []).map((r) => [r.ticker, r.total]),
    );
    for (const p of data.positions) {
      const x = t[p.asset.ticker];
      out[p.asset.ticker] = {
        idealPct: x?.idealPct ?? 0,
        buy: x?.buy ?? false,
        received: rec.get(p.asset.ticker) ?? 0,
      };
    }
    return out;
  }, [data, alerts.data, received.data]);

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data) return <Skeleton className="h-96" />;

  const metrics = [
    {
      label: "Valor atual",
      value: fmtBRL(data.total),
      tone: null as number | null,
    },
    { label: "Investido", value: fmtBRL(data.invested), tone: null },
    {
      label: "Ganho de capital",
      value: fmtSignedBRL(data.gain),
      tone: data.gain,
    },
    { label: "Variação", value: fmtPct(data.gainPct), tone: data.gainPct },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ativos"
        action={
          <Segmented
            label="Visão"
            size="md"
            options={[
              { id: "clase", label: "Por classe" },
              { id: "cuenta", label: "Por conta" },
            ]}
            value={view}
            onChange={setView}
          />
        }
        subtitle={
          <>
            {data.positions.length} ativos em {data.byClass.length} classes, do
            maior para o menor valor
            {data.positionsAsOf && (
              <span className="block text-xs">
                Posições da B3 em{" "}
                {Object.entries(data.positionsAsOf)
                  .map(
                    ([id, d]) =>
                      `${isoToBr(d)} (${ACCOUNTS.find((a) => a.id === id)?.label ?? id})`,
                  )
                  .join(" · ")}
                . São atualizadas ao enviar o relatório mensal de cada conta.
              </span>
            )}
          </>
        }
      />
      <dl className="card grid grid-cols-2 gap-y-4 py-4 sm:grid-cols-4 sm:divide-x sm:divide-line">
        {metrics.map((m) => (
          <div key={m.label} className="px-5">
            <dt className="text-xs text-ink-3">{m.label}</dt>
            <dd
              className={`num mt-1 text-lg font-semibold tracking-tight ${m.tone !== null ? signClass(m.tone) : ""}`}
            >
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
      <ProviderErrors errors={data.errors} />
      {view === "cuenta" ? (
        <ByAccount positions={data.positions} />
      ) : (
        <>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-[var(--shadow)] focus-within:border-accent sm:max-w-xs">
            <Icon name="search" className="h-4 w-4 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ativo"
              className="w-full bg-transparent outline-none placeholder:text-ink-3"
            />
          </label>
          <AssetGroups
            classes={data.byClass}
            positions={data.positions}
            extra={extra}
            targets={alerts.data?.targets ?? null}
            managedPct={data && alerts.data?.targets ? classPctOfInvestable(data, alerts.data.targets) : null}
            query={query}
          />
        </>
      )}
      {view === "clase" && (
        <p className="text-[11px] leading-relaxed text-ink-3">
          <b>Variação</b>: preço atual x preço médio. <b>Rentab.</b>:
          ganho de capital + proventos recebidos (importados da B3), sobre o
          investido. <b>Ideal</b>: meta da classe ÷ quantidade de ativos;{" "}
          <b>Comprar</b> marca os que pesam menos que o ideal. * Preço médio
          estimado a partir da variação informada pelo Investidor10.
        </p>
      )}
    </div>
  );
}
