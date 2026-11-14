"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { usePortfolio } from "@/components/data";
import { PositionsTable } from "@/components/PositionsTable";
import { Card, ChangePill, ChangeText, ErrorState, ProviderErrors, Skeleton } from "@/components/ui";
import { ASSET_CLASSES, CLASS_LABELS, type AssetClass } from "@/lib/types";
import { fmtBRL, fmtPct, fmtSignedBRL } from "@/lib/format";

export default function ClasePage() {
  const { clase } = useParams<{ clase: string }>();
  const cls = (ASSET_CLASSES as readonly string[]).includes(clase) ? (clase as AssetClass) : null;
  const { data, error } = usePortfolio();

  return (
    <div className="space-y-4">
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Clases de activo">
        {ASSET_CLASSES.map((c) => (
          <Link
            key={c}
            href={`/clase/${c}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${c === cls ? "bg-ink font-medium text-bg" : "bg-surface text-ink-2 ring-1 ring-line"}`}
          >
            {CLASS_LABELS[c]}
          </Link>
        ))}
      </nav>

      {!cls ? (
        <ErrorState message={`La clase "${clase}" no existe.`} />
      ) : !data && error ? (
        <ErrorState message={error.message} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        (() => {
          const summary = data.byClass.find((c) => c.class === cls);
          const positions = data.positions.filter((p) => p.asset.class === cls);
          const errs = data.errors.filter((e) => e.tickers.some((t) => positions.some((p) => p.asset.ticker === t)));
          if (!summary) return <ErrorState message="No tenés posiciones en esta clase." />;
          return (
            <>
              <section className="flex flex-wrap items-end justify-between gap-3 pt-1">
                <div>
                  <div className="text-sm text-ink-3">{summary.label}</div>
                  <div className="num text-3xl font-semibold tracking-tight">{fmtBRL(summary.value)}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-sm">
                    <ChangeText value={summary.dayChange}>{fmtSignedBRL(summary.dayChange)}</ChangeText>
                    <ChangePill pct={summary.dayChangePct} />
                  </div>
                </div>
                <div className="text-sm text-ink-3 sm:text-right">
                  <div className="num text-lg font-medium text-ink">{fmtPct(summary.weight, 1, false)}</div>
                  del patrimonio · {summary.count} activos
                </div>
              </section>
              <ProviderErrors errors={errs} />
              <Card>
                <PositionsTable positions={positions} />
              </Card>
              {cls === "renta_fija" && (
                <p className="text-xs text-ink-3">
                  Tesouro: precio unitario (PU base) publicado por Tesouro Transparente, D-1. CDB: valor manual devengado con el CDI diario del BCB (bruto, sin IR). Valores manuales sin cotización diaria.
                </p>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
