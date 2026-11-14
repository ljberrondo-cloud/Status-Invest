"use client";

import { useJson } from "@/components/data";
import { Card, ErrorState, Skeleton } from "@/components/ui";
import { classColor } from "@/components/charts";
import type { Alert, AllocationRow } from "@/lib/alerts";
import type { Targets } from "@/lib/types";
import { fmtBRL, fmtPct } from "@/lib/format";

interface AlertsResponse {
  targets: Targets | null;
  alerts: Alert[];
  allocation: { base: number; rows: AllocationRow[] } | null;
  missing?: string[];
}

function AllocationBar({ r, max }: { r: AllocationRow; max: number }) {
  const w = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="relative h-2 rounded-full bg-surface-2">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(r.currentPct), background: classColor(r.class) }} />
      <div className="absolute -inset-y-1 w-0.5 rounded bg-ink" style={{ left: w(r.targetPct) }} title={`Objetivo ${r.targetPct}%`} />
    </div>
  );
}

export default function Alertas() {
  const { data, error, isLoading } = useJson<AlertsResponse>("/api/alerts");
  if (error && !data) return <ErrorState message={error.message} />;
  if (isLoading || !data) return <Skeleton className="h-72" />;
  if (!data.targets || !data.allocation) return <ErrorState message="Falta data/targets.json con la asignación objetivo." />;
  const t = data.targets;
  const max = Math.max(...data.allocation.rows.flatMap((r) => [r.currentPct, r.targetPct]), 1) * 1.1;

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <div className="text-sm text-ink-3">Alertas</div>
        <div className="text-3xl font-semibold tracking-tight">{data.alerts.length ? `${data.alerts.length} activa${data.alerts.length > 1 ? "s" : ""}` : "Todo en orden"}</div>
        <div className="mt-1 text-xs text-ink-3">
          Límites: {t.concentration.max_asset_pct}% por activo · {t.concentration.max_class_pct}% por clase · tolerancia ±{t.tolerance_pct} p.p. sobre el objetivo
        </div>
      </div>

      {!!data.missing?.length && (
        <div className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
          {data.missing.length} activos sin cotización quedan fuera del cálculo ({data.missing.slice(0, 5).join(", ")}
          {data.missing.length > 5 ? "…" : ""}): los porcentajes y desvíos están incompletos.
        </div>
      )}

      {data.alerts.length > 0 && (
        <ul className="space-y-2">
          {data.alerts.map((a) => (
            <li key={a.id} className="card flex gap-3 p-4">
              <span
                aria-hidden
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${a.level === "warning" ? "bg-warn-bg text-warn" : "bg-surface-2 text-ink-2"}`}
              >
                {a.level === "warning" ? "!" : "i"}
              </span>
              <div>
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-ink-3">
                  <span className="sr-only">{a.level === "warning" ? "Advertencia: " : "Aviso: "}</span>
                  {a.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card title="Asignación actual vs objetivo">
        <ul className="space-y-4">
          {data.allocation.rows.map((r) => (
            <li key={r.class}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: classColor(r.class) }} />
                  {r.label}
                  {r.outOfBand && <span className="rounded bg-warn-bg px-1.5 text-[11px] text-warn">fuera de banda</span>}
                </span>
                <span className="num text-ink-2">
                  {fmtPct(r.currentPct, 1, false)} <span className="text-ink-3">/ {fmtPct(r.targetPct, 0, false)}</span>
                </span>
              </div>
              <AllocationBar r={r} max={max} />
              <div className="num mt-1 text-right text-[11px] text-ink-3">
                {Math.abs(r.rebalance) < 1 ? "En objetivo" : `${r.rebalance > 0 ? "Comprar" : "Reducir"} ${fmtBRL(Math.abs(r.rebalance))} para volver al objetivo`}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-3">
          Base de cálculo {fmtBRL(data.allocation.base)}
          {t.exclude_from_allocation?.length ? ` (excluye ${t.exclude_from_allocation.join(", ")})` : ""}. La línea negra marca el objetivo. Se edita en data/targets.json.
        </p>
      </Card>
    </div>
  );
}
