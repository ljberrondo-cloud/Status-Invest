"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import type { Position } from "@/lib/types";
import { fmtBRL, fmtPct } from "@/lib/format";

export const classColor = (cls: string) => `var(--c-${cls})`;

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
      <rect x={x + 1.5} y={y + 1.5} width={Math.max(0, width - 3)} height={Math.max(0, height - 3)} rx={8} style={{ fill: bg }} />
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
  if (!data.length) return <p className="text-sm text-ink-3">Sem variações disponíveis.</p>;
  return (
    <div>
      <div className="h-72 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" nameKey="name" content={<Tile />} isAnimationActive={false}>
            <Tooltip
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as { name: string; size: number; pct: number | null } | undefined;
                return active && d ? (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-lg)]">
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
        <span className="ml-2">Tamanho = valor da posição</span>
      </div>
    </div>
  );
}
