"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from "recharts";
import type { ClassSummary, HistoryPoint, Position } from "@/lib/types";
import { fmtBRL, fmtBRLCompact, fmtDDMM, fmtPct } from "@/lib/format";
import { addDays, isoDateSP } from "@/lib/dates";

export const classColor = (cls: string) => `var(--c-${cls})`;

/* ---------- Evolución ---------- */

const RANGES = [
  { id: "1m", label: "1M", days: 31 },
  { id: "3m", label: "3M", days: 92 },
  { id: "1a", label: "1A", days: 366 },
  { id: "all", label: "Todo", days: 0 },
] as const;

export function EvolutionChart({ history, liveTotal }: { history: HistoryPoint[]; liveTotal: number | null }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("3m");
  const series = useMemo(() => {
    const today = isoDateSP();
    const pts = history.filter((h) => h.date < today).map((h) => ({ date: h.date, total: h.total }));
    if (liveTotal !== null) pts.push({ date: today, total: liveTotal });
    const days = RANGES.find((r) => r.id === range)!.days;
    return days ? pts.filter((p) => p.date >= addDays(today, -days)) : pts;
  }, [history, liveTotal, range]);

  const first = series[0]?.total;
  const last = series.at(-1)?.total;
  const delta = first && last ? last - first : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm text-ink-3">
          {delta !== null && series.length > 1 ? (
            <span className="num">
              En el período: <span className={delta >= 0 ? "text-pos" : "text-neg"}>{fmtPct((delta / first!) * 100)}</span>
            </span>
          ) : null}
        </div>
        <div className="flex rounded-full bg-surface-2 p-0.5" role="tablist" aria-label="Período">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-2.5 py-1 text-xs ${range === r.id ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-3"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {series.length < 2 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl bg-surface-2 px-6 text-center text-sm text-ink-3">
          <p className="font-medium text-ink-2">Todavía no hay historial suficiente</p>
          <p className="mt-1">El GitHub Action guarda un snapshot por día; la curva aparece desde el segundo día.</p>
        </div>
      ) : (
        <div className="h-52 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="evo" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => fmtDDMM(`${d}T12:00:00Z`)}
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => fmtBRLCompact(v)}
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                cursor={{ stroke: "var(--text-3)", strokeDasharray: "3 3" }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="card px-3 py-2 text-xs shadow-lg">
                      <div className="text-ink-3">{fmtDDMM(`${payload[0].payload.date}T12:00:00Z`)}</div>
                      <div className="num font-medium">{fmtBRL(payload[0].value as number)}</div>
                    </div>
                  ) : null
                }
              />
              <Area type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} fill="url(#evo)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ---------- Distribución ---------- */

export function AllocationDonut({ classes, total }: { classes: ClassSummary[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const focus = hover !== null ? classes[hover] : null;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={classes}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="var(--surface)"
              strokeWidth={2}
              cornerRadius={3}
              onMouseEnter={(_, i) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              isAnimationActive={false}
            >
              {classes.map((c) => (
                <Cell key={c.class} fill={classColor(c.class)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-xs text-ink-3">{focus ? focus.label : "Total"}</div>
          <div className="num text-sm font-semibold">{fmtBRLCompact(focus ? focus.value : total)}</div>
          {focus && <div className="num text-xs text-ink-2">{fmtPct(focus.weight, 1, false)}</div>}
        </div>
      </div>
      <ul className="w-full space-y-2">
        {classes.map((c, i) => (
          <li
            key={c.class}
            className={`flex items-center gap-3 rounded-lg px-2 py-1 text-sm ${hover === i ? "bg-surface-2" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: classColor(c.class) }} />
            <span className="flex-1 text-ink-2">{c.label}</span>
            <span className="num w-14 text-right font-medium">{fmtPct(c.weight, 1, false)}</span>
            <span className="num hidden w-28 text-right text-ink-3 sm:block lg:hidden">{fmtBRL(c.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Mapa de calor ---------- */

const HEAT_CAP = 4; // % de variación que satura el color

export function heatColor(pct: number | null) {
  if (pct === null) return { bg: "var(--heat-mid)", fg: "var(--text-2)" };
  const t = Math.min(1, Math.abs(pct) / HEAT_CAP);
  const pole = pct >= 0 ? "var(--pos)" : "var(--neg)";
  const mix = Math.round(18 + t * 72);
  return { bg: `color-mix(in oklab, ${pole} ${mix}%, var(--heat-mid))`, fg: mix > 55 ? "#fff" : "var(--text)" };
}

interface TileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pct?: number | null;
  depth?: number;
}

function Tile({ x = 0, y = 0, width = 0, height = 0, name, pct = null, depth }: TileProps) {
  if (depth !== 1 || width <= 0 || height <= 0) return null;
  const { bg, fg } = heatColor(pct);
  const showName = width > 34 && height > 18;
  const showPct = width > 44 && height > 34;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx={6} style={{ fill: bg }} />
      {showName && (
        <text x={x + width / 2} y={y + height / 2 + (showPct ? -3 : 4)} textAnchor="middle" style={{ fill: fg, fontSize: width > 80 ? 13 : 11, fontWeight: 600 }}>
          {name}
        </text>
      )}
      {showPct && (
        <text x={x + width / 2} y={y + height / 2 + 13} textAnchor="middle" className="num" style={{ fill: fg, fontSize: 11, opacity: 0.9 }}>
          {fmtPct(pct, 1)}
        </text>
      )}
    </g>
  );
}

export function Heatmap({ positions }: { positions: Position[] }) {
  const data = positions
    .filter((p) => p.value !== null && p.value > 0 && p.status !== "manual" && p.dayChangePct !== null)
    .map((p) => ({ name: p.asset.ticker, size: p.value as number, pct: p.dayChangePct }))
    .sort((a, b) => b.size - a.size);
  if (!data.length) return <p className="text-sm text-ink-3">Sin variaciones disponibles.</p>;
  return (
    <div>
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" nameKey="name" content={<Tile />} isAnimationActive={false}>
            <Tooltip
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as { name: string; size: number; pct: number | null } | undefined;
                return active && d ? (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <div className="font-medium">{d.name}</div>
                    <div className="num text-ink-2">{fmtBRL(d.size)}</div>
                    <div className={`num ${d.pct !== null && d.pct >= 0 ? "text-pos" : "text-neg"}`}>{fmtPct(d.pct)}</div>
                  </div>
                ) : null;
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-ink-3">
        <span className="num">−{HEAT_CAP}%</span>
        <div className="flex h-2 w-40 overflow-hidden rounded-full">
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((v) => (
            <span key={v} className="flex-1" style={{ background: heatColor(v).bg }} />
          ))}
        </div>
        <span className="num">+{HEAT_CAP}%</span>
        <span className="ml-2">Tamaño = valor de la posición</span>
      </div>
    </div>
  );
}
