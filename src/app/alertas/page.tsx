"use client";

import { useJson } from "@/components/data";
import { Badge, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { classColor } from "@/components/charts";
import type { Alert, AllocationRow } from "@/lib/alerts";
import type { Targets } from "@/lib/types";
import { fmtBRL, fmtPct } from "@/lib/format";

/** "PREVIDENCIA", "FGTS" → "Previdencia ni FGTS" (las siglas cortas quedan en mayúsculas). */
const excludedNames = (t: Targets) =>
  (t.exclude_from_allocation ?? []).map((x) => (x.length <= 4 ? x : x.charAt(0) + x.slice(1).toLowerCase())).join(" ni ");

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
    <div className="space-y-5">
      <PageHeader
        title="Alertas"
        subtitle={`Sobre lo que manejan${t.exclude_from_allocation?.length ? ` (sin ${excludedNames(t)})` : ""}. Límites: ${t.concentration.max_asset_pct}% por activo · ${t.concentration.max_class_pct}% por clase · tolerancia ±${t.tolerance_pct} p.p.`}
        action={
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${data.alerts.length ? "bg-warn-bg text-warn" : "bg-pos-bg text-pos"}`}>
            {data.alerts.length ? `${data.alerts.length} activa${data.alerts.length > 1 ? "s" : ""}` : "Todo en orden"}
          </span>
        }
      />

      {!!data.missing?.length && (
        <div className="rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
          {data.missing.length} activos sin cotización quedan fuera del cálculo ({data.missing.slice(0, 5).join(", ")}
          {data.missing.length > 5 ? "…" : ""}): los porcentajes y desvíos están incompletos.
        </div>
      )}

      {data.alerts.length > 0 && (
        <ul className="card divide-y divide-line">
          {data.alerts.map((a) => (
            <li key={a.id} className="flex gap-3.5 px-5 py-4">
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.level === "warning" ? "bg-warn-bg text-warn" : "bg-surface-2 text-ink-2"}`}
              >
                <Icon name={a.level === "warning" ? "alert" : "info"} className="h-4 w-4" />
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

      <Card title="Asignación actual vs objetivo" subtitle="Cuánto comprar o reducir en cada clase para volver al objetivo">
        <ul className="space-y-4">
          {data.allocation.rows.map((r) => (
            <li key={r.class}>
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: classColor(r.class) }} />
                  {r.label}
                  {r.outOfBand && <Badge tone="warn">fuera de banda</Badge>}
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
          {t.exclude_from_allocation?.length ? ` (sin ${excludedNames(t)}: cuentan en el patrimonio, pero no se pueden mover)` : ""}. La línea negra marca el objetivo. Se edita en data/targets.json.
        </p>
      </Card>
    </div>
  );
}
