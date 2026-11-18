"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClassSummary, Position, Targets } from "@/lib/types";
import { fmtBRL, fmtPct, fmtPrice, fmtQty, signClass } from "@/lib/format";
import { sortPositions, type SortKey } from "@/lib/sort";
import { Badge, ChangePill, QuoteBadge, TickerAvatar } from "./ui";
import { Icon } from "./icons";

export interface AssetExtra {
  idealPct: number;
  buy: boolean;
  /** Proventos recibidos (histórico) del activo, si se importaron. */
  received: number;
}

/** Rentabilidad = (ganancia de capital + proventos recibidos) ÷ costo. */
export function rentability(p: Position, received: number): number | null {
  if (p.cost === null || p.gain === null || p.cost <= 0) return null;
  return ((p.gain + received) / p.cost) * 100;
}

const COLS: { key: SortKey | null; label: string; title?: string; align?: "left" }[] = [
  { key: "ticker", label: "Activo", align: "left" },
  { key: "quantity", label: "Cantidad" },
  { key: "avg", label: "P. medio" },
  { key: "price", label: "Precio" },
  { key: "change", label: "Hoy", title: "Variación del día" },
  { key: "gain", label: "Variación", title: "Precio actual vs precio medio" },
  { key: "rent", label: "Rentab.", title: "Ganancia de capital + proventos recibidos, sobre el costo" },
  { key: "value", label: "Saldo" },
  { key: "weight", label: "Cartera", title: "% de la cartera / % ideal" },
  { key: null, label: "" },
];

function BuyTag({ buy }: { buy: boolean }) {
  return buy ? <Badge tone="accent">Comprar</Badge> : null;
}

/** Barra de % actual con marca del objetivo. */
function WeightBar({ value, target, color, max }: { value: number; target: number | null; color: string; max: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface-2">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      {target !== null && <div className="absolute -top-1 -bottom-1 w-[2px] rounded bg-ink/70" style={{ left: `calc(${Math.min(100, (target / max) * 100)}% - 1px)` }} />}
    </div>
  );
}

function Group({
  summary,
  positions,
  extra,
  targetPct,
  tolerance,
  open,
  onToggle,
  sort,
  onSort,
}: {
  summary: ClassSummary;
  positions: Position[];
  extra: Record<string, AssetExtra>;
  targetPct: number | null;
  tolerance: number;
  open: boolean;
  onToggle: () => void;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  const rows = useMemo(() => sortPositions(positions, sort.key, sort.dir, extra), [positions, sort, extra]);
  const receivedTotal = positions.reduce((s, p) => s + (extra[p.asset.ticker]?.received ?? 0), 0);
  const rent = summary.cost > 0 ? ((summary.gain + receivedTotal) / summary.cost) * 100 : null;
  const color = `var(--c-${summary.class})`;
  const off = targetPct !== null && Math.abs(summary.weight - targetPct) > tolerance;
  const maxW = Math.max(summary.weight, targetPct ?? 0, 1) * 1.15;
  const arrow = (k: SortKey | null) => (k && k === sort.key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  return (
    <section id={summary.class} className="card scroll-mt-24 overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="relative flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface-2/40 sm:px-6">
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] leading-tight font-semibold tracking-tight sm:truncate">{summary.label}</span>
            <span className="text-xs text-ink-3">{summary.count}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="w-20 shrink-0 sm:w-40">
              <WeightBar value={summary.weight} target={targetPct} color={color} max={maxW} />
            </div>
            <span className="num text-xs whitespace-nowrap text-ink-2">
              {fmtPct(summary.weight, 1, false)}
              {targetPct !== null && <span className={off ? "text-warn" : "text-ink-3"}> / {fmtPct(targetPct, 0, false)}</span>}
            </span>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[11px] text-ink-3">Variación</div>
          <div className={`num text-sm font-semibold ${signClass(summary.gainPct)}`}>{fmtPct(summary.gainPct)}</div>
        </div>
        <div className="hidden w-24 text-right md:block">
          <div className="text-[11px] text-ink-3">Rentab.</div>
          <div className={`num text-sm font-semibold ${signClass(rent)}`}>{fmtPct(rent)}</div>
        </div>
        <div className="shrink-0 text-right sm:w-32">
          <div className="num text-[15px] font-semibold tracking-tight">{fmtBRL(summary.value)}</div>
          <div className={`num text-xs sm:hidden ${signClass(summary.gainPct)}`}>{fmtPct(summary.gainPct)}</div>
          <div className="hidden text-[11px] text-ink-3 sm:block">{summary.cost > 0 ? `inv. ${fmtBRL(summary.cost)}` : ""}</div>
        </div>
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-ink-3 transition ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>

      {open && (
        <div className="border-t border-line">
          {/* Celular */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((p) => {
              const x = extra[p.asset.ticker];
              const r = rentability(p, x?.received ?? 0);
              return (
                <li key={p.asset.ticker} className="flex gap-3 px-5 py-3.5">
                  <TickerAvatar ticker={p.asset.ticker} cls={p.asset.class} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{p.asset.ticker}</span>
                      <span className="num font-semibold">{fmtBRL(p.value)}</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ink-3">
                      <span className="num truncate">
                        {fmtQty(p.asset.quantity)} × {fmtPrice(p.price)}
                      </span>
                      <span className={`num ${signClass(p.gainPct)}`}>{fmtPct(p.gainPct)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-3">
                      <ChangePill pct={p.dayChangePct} />
                      {p.asset.avg_price ? <span className="num">PM {fmtPrice(p.asset.avg_price)}</span> : null}
                      {x?.received ? (
                        <span className="num">
                          Rentab. <span className={signClass(r)}>{fmtPct(r)}</span>
                        </span>
                      ) : null}
                      <span className="num">
                        {fmtPct(p.weight, 2, false)} / {x ? fmtPct(x.idealPct, 2, false) : "—"}
                      </span>
                      {x && <BuyTag buy={x.buy} />}
                      <QuoteBadge p={p} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Escritorio */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wide text-ink-3 uppercase">
                  {COLS.map((c, i) => (
                    <th
                      key={i}
                      title={c.title}
                      aria-sort={c.key && sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                      className={`border-b border-line bg-surface-2/40 px-3 py-2.5 font-medium whitespace-nowrap ${c.align === "left" ? "pl-6 text-left" : "text-right"} ${i === COLS.length - 1 ? "pr-6" : ""}`}
                    >
                      {c.key ? (
                        <button onClick={() => onSort(c.key!)} className={`uppercase hover:text-ink ${sort.key === c.key ? "text-ink" : ""}`}>
                          {c.label}
                          {arrow(c.key)}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => {
                  const x = extra[p.asset.ticker];
                  const r = rentability(p, x?.received ?? 0);
                  return (
                    <tr key={p.asset.ticker} className="transition hover:bg-surface-2/50">
                      <td className="py-3 pr-3 pl-6">
                        <div className="flex items-center gap-3">
                          <TickerAvatar ticker={p.asset.ticker} cls={p.asset.class} size={34} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.asset.ticker}</span>
                              <QuoteBadge p={p} />
                            </div>
                            {p.asset.name && <div className="max-w-52 truncate text-xs text-ink-3">{p.asset.name}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="num px-3 text-right text-ink-2">{fmtQty(p.asset.quantity)}</td>
                      <td className="num px-3 text-right text-ink-2" title={p.asset.note}>
                        {p.asset.avg_price ? fmtPrice(p.asset.avg_price) : "—"}
                        {p.asset.note?.includes("derivad") ? "*" : ""}
                      </td>
                      <td className="num px-3 text-right">{fmtPrice(p.price)}</td>
                      <td className="px-3 text-right">
                        <ChangePill pct={p.dayChangePct} />
                      </td>
                      <td className={`num px-3 text-right font-medium ${signClass(p.gainPct)}`}>{fmtPct(p.gainPct)}</td>
                      <td className={`num px-3 text-right ${signClass(r)}`} title={x?.received ? `Incluye ${fmtBRL(x.received)} en proventos` : "Sin proventos importados"}>
                        {fmtPct(r)}
                      </td>
                      <td className="num px-3 text-right font-semibold">{fmtBRL(p.value)}</td>
                      <td className="num px-3 text-right">
                        <div className="text-ink-2">{fmtPct(p.weight, 2, false)}</div>
                        <div className="text-[11px] text-ink-3">ideal {x ? fmtPct(x.idealPct, 2, false) : "—"}</div>
                      </td>
                      <td className="pr-6 pl-3 text-right">{x && <BuyTag buy={x.buy} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export function AssetGroups({
  classes,
  positions,
  extra,
  targets,
  query,
}: {
  classes: ClassSummary[];
  positions: Position[];
  extra: Record<string, AssetExtra>;
  targets: Targets | null;
  query: string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });

  // Abrir la clase indicada en el hash (/activos#fiis), p.ej. desde el Resumen.
  useEffect(() => {
    const sync = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (h) setOpen((s) => new Set(s).add(h));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const q = query.trim().toUpperCase();
  const match = (p: Position) => !q || p.asset.ticker.toUpperCase().includes(q) || (p.asset.name ?? "").toUpperCase().includes(q);
  const visible = classes.filter((c) => positions.some((p) => p.asset.class === c.class && match(p)));
  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: k === "ticker" ? 1 : -1 }));
  const allOpen = visible.every((c) => open.has(c.class));

  if (!visible.length) return <p className="card p-10 text-center text-sm text-ink-3">Ningún activo coincide con “{query}”.</p>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setOpen(allOpen ? new Set() : new Set(classes.map((c) => c.class)))} className="text-xs font-medium text-accent hover:underline">
          {allOpen ? "Contraer todo" : "Expandir todo"}
        </button>
      </div>
      {visible.map((c) => (
        <Group
          key={c.class}
          summary={c}
          positions={positions.filter((p) => p.asset.class === c.class && match(p))}
          extra={extra}
          targetPct={targets ? (targets.allocation[c.class] ?? 0) : null}
          tolerance={targets?.tolerance_pct ?? 5}
          open={q ? true : open.has(c.class)}
          onToggle={() =>
            setOpen((s) => {
              const n = new Set(s);
              if (n.has(c.class)) n.delete(c.class);
              else n.add(c.class);
              return n;
            })
          }
          sort={sort}
          onSort={onSort}
        />
      ))}
    </div>
  );
}
