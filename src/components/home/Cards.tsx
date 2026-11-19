"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { ClassSummary, Position, Targets } from "@/lib/types";
import type { Alert } from "@/lib/alerts";
import { RECEIVED_LABELS, type ReceivedSummary } from "@/lib/received";
import { fmtBRL, fmtBRLCompact, fmtDateLong, fmtPct, fmtSignedBRL, fmtSince, signClass } from "@/lib/format";
import { Card, ChangePill, Segmented, TickerAvatar } from "../ui";
import { Icon } from "../icons";

const classColor = (c: string) => `var(--c-${c})`;

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
      {children}
      <Icon name="arrowRight" className="h-3.5 w-3.5" strokeWidth={2} />
    </Link>
  );
}

/* ---------------- Asignación ---------------- */

export function AllocationCard({
  classes,
  total,
  targets,
  managedPct,
  className,
}: {
  classes: ClassSummary[];
  total: number;
  targets: Targets | null;
  /** % de cada clase sobre lo invertible (null = fuera de objetivos, p.ej. previdencia de empresa). */
  managedPct: Record<string, number | null> | null;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const focus = classes.find((c) => c.class === hover) ?? null;
  const cur = (c: ClassSummary) => (managedPct ? (managedPct[c.class] ?? null) : c.weight);
  const out = classes.filter((c) => managedPct && managedPct[c.class] === null).map((c) => c.label);
  const outLabel = out.length > 1 ? `${out.slice(0, -1).join(", ")} e ${out.at(-1)}` : (out[0] ?? "");
  const max = Math.max(...classes.map((c) => Math.max(cur(c) ?? 0, targets?.allocation[c.class] ?? 0)), 1);
  return (
    <Card
      className={className}
      title="Alocação"
      subtitle={targets ? `Atual x meta, sobre o que vocês administram${outLabel ? ` (sem ${outLabel})` : ""}` : "Por classe"}
      action={<MoreLink href="/ativos">Ver ativos</MoreLink>}
    >
      <div className="grid items-center gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative mx-auto h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={classes}
                dataKey="value"
                nameKey="label"
                innerRadius="74%"
                outerRadius="100%"
                paddingAngle={1.2}
                cornerRadius={4}
                stroke="var(--surface)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
                onMouseEnter={(d) => setHover((d as unknown as ClassSummary).class)}
                onMouseLeave={() => setHover(null)}
              >
                {classes.map((c) => (
                  <Cell key={c.class} fill={classColor(c.class)} opacity={hover && hover !== c.class ? 0.35 : 1} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="text-[11px] leading-tight text-ink-3">{focus ? focus.label : `${classes.length} classes`}</div>
            <div className="num mt-0.5 text-lg font-semibold tracking-tight">{fmtBRLCompact(focus ? focus.value : total)}</div>
            {focus && <div className="num text-xs text-ink-2">{fmtPct(focus.weight, 1, false)}</div>}
          </div>
        </div>
        <ul className="space-y-2.5">
          {classes.map((c) => {
            const pct = cur(c);
            const excluded = pct === null;
            const target = excluded ? null : (targets?.allocation[c.class] ?? null);
            const off = target !== null && targets && pct !== null ? Math.abs(pct - target) > targets.tolerance_pct : false;
            return (
              <li
                key={c.class}
                onMouseEnter={() => setHover(c.class)}
                onMouseLeave={() => setHover(null)}
                className={`rounded-lg transition ${hover && hover !== c.class ? "opacity-50" : ""}`}
              >
                <Link href={`/ativos#${c.class}`} className="block">
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: classColor(c.class) }} />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    {excluded ? (
                      <span className="text-[11px] text-ink-3">fora das metas · {fmtPct(c.weight, 1, false)} do total</span>
                    ) : (
                      <>
                        <span className="num font-semibold">{fmtPct(pct, 1, false)}</span>
                        {target !== null && <span className={`num w-12 text-right text-[11px] ${off ? "text-warn" : "text-ink-3"}`}>/ {fmtPct(target, 0, false)}</span>}
                      </>
                    )}
                  </div>
                  {!excluded && (
                    <div className="relative mt-1.5 ml-4 h-1.5 rounded-full bg-surface-2">
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${((pct ?? 0) / max) * 100}%`, background: classColor(c.class) }} />
                      {target !== null && (
                        <div className="absolute -top-1 -bottom-1 w-[2px] rounded bg-ink/70" style={{ left: `calc(${(target / max) * 100}% - 1px)` }} title={`Meta ${target}%`} />
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {targets && <p className="mt-4 text-[11px] text-ink-3">A marca escura indica a meta; em âmbar, as classes fora da tolerância de ±{targets.tolerance_pct} p.p.</p>}
    </Card>
  );
}

/* ---------------- Movimientos del día ---------------- */

export function MoversCard({ positions, className }: { positions: Position[]; className?: string }) {
  const [tab, setTab] = useState<"up" | "down">("up");
  const market = positions.filter((p) => p.dayChangePct !== null && p.status === "fresh" && Math.abs(p.dayChangePct) >= 0.005);
  const list = [...market].sort((a, b) => (tab === "up" ? b.dayChangePct! - a.dayChangePct! : a.dayChangePct! - b.dayChangePct!)).filter((p) => (tab === "up" ? p.dayChangePct! > 0 : p.dayChangePct! < 0)).slice(0, 5);
  return (
    <Card
      className={className}
      title="Movimentos de hoje"
      subtitle="Maiores variações dos seus ativos"
      action={
        <Segmented
          label="Direção"
          options={[
            { id: "up", label: "Altas" },
            { id: "down", label: "Baixas" },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
    >
      {list.length ? (
        <ul className="-my-1 divide-y divide-line">
          {list.map((p) => (
            <li key={p.asset.ticker} className="flex items-center gap-3 py-2.5">
              <TickerAvatar ticker={p.asset.ticker} cls={p.asset.class} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{p.asset.ticker}</div>
                <div className={`num text-xs ${signClass(p.dayChange)}`}>{fmtSignedBRL(p.dayChange)}</div>
              </div>
              <ChangePill pct={p.dayChangePct} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-3">{tab === "up" ? "Nenhum ativo sobe hoje." : "Nenhum ativo cai hoje."}</p>
      )}
    </Card>
  );
}

/* ---------------- Proventos ---------------- */

const MONTHS = ["j", "f", "m", "a", "m", "j", "j", "a", "s", "o", "n", "d"];

export function IncomeCard({ received, className }: { received: ReceivedSummary | null; className?: string }) {
  if (!received) {
    return (
      <Card className={className} title="Proventos" subtitle="Dividendos, JCP e rendimentos" action={<MoreLink href="/proventos">Importar</MoreLink>}>
        <div className="flex h-full flex-col items-start justify-center gap-2 py-4 text-sm text-ink-2">
          <p>Importe o extrato de Movimentação da B3 para ver o que vocês receberam.</p>
        </div>
      </Card>
    );
  }
  const months = received.byMonth.slice(-6);
  return (
    <Card className={className} title="Proventos" subtitle={received.firstDate ? `Dados desde ${fmtSince(received.firstDate)} · histórico ${fmtBRL(received.total)}` : undefined} action={<MoreLink href="/proventos">Ver tudo</MoreLink>}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-ink-3">Últimos 12 meses</div>
          <div className="num mt-1 text-2xl font-semibold tracking-tight">{fmtBRL(received.last12m)}</div>
        </div>
        <div className="h-14 w-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" hide />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }) => {
                  const m = payload?.[0]?.payload as { month: string; total: number } | undefined;
                  return active && m ? (
                    <div className="rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow-[var(--shadow-lg)]">
                      <span className="num">{fmtBRL(m.total)}</span>
                    </div>
                  ) : null;
                }}
              />
              <Bar dataKey="total" fill="var(--r-rendimento)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-0.5 flex justify-between px-0.5 text-[9px] text-ink-3">
            {months.map((m) => (
              <span key={m.month}>{MONTHS[Number(m.month.slice(5, 7)) - 1]}</span>
            ))}
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 border-t border-line pt-3">
        {received.recent.slice(0, 3).map((p, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--r-${p.type})` }} />
            <span className="font-medium">{p.ticker}</span>
            <span className="text-xs text-ink-3">{RECEIVED_LABELS[p.type].split(" (")[0]} · {fmtDateLong(p.date)}</span>
            <span className="num ml-auto font-medium">{fmtBRL(p.amount)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Alertas ---------------- */

export function AlertsCard({ alerts, className }: { alerts: Alert[] | null; className?: string }) {
  const warnings = alerts?.filter((a) => a.level === "warning") ?? [];
  return (
    <Card className={className} title="Alertas" subtitle="Concentração e desvio da meta" action={<MoreLink href="/alertas">Ver</MoreLink>}>
      {!alerts ? (
        <div className="skeleton h-24" />
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-sm text-ink-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pos-bg text-pos">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
          </span>
          Tudo dentro dos limites.
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="num text-2xl font-semibold tracking-tight">{alerts.length}</span>
            <span className="text-sm text-ink-2">
              ativo{alerts.length > 1 ? "s" : ""}
              {warnings.length ? ` · ${warnings.length} de concentração` : ""}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-[13px] leading-snug">
                <Icon name={a.level === "warning" ? "alert" : "info"} className={`mt-0.5 h-4 w-4 shrink-0 ${a.level === "warning" ? "text-warn" : "text-ink-3"}`} />
                <span className="text-ink-2">{a.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
