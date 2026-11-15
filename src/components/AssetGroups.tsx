"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClassSummary, Position, Targets } from "@/lib/types";
import { fmtBRL, fmtPct, fmtPrice, fmtQty, signClass } from "@/lib/format";
import { ChangePill, QuoteBadge } from "./ui";
import { sortPositions, type SortKey } from "@/lib/sort";

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

const COLS: { key: SortKey | null; label: string; title?: string }[] = [
  { key: "ticker", label: "Activo" },
  { key: "quantity", label: "Cant." },
  { key: "avg", label: "P. medio" },
  { key: "price", label: "Precio" },
  { key: "change", label: "Hoy", title: "Variación del día" },
  { key: "gain", label: "Variación", title: "Precio actual vs precio medio" },
  { key: "rent", label: "Rentab.", title: "Ganancia de capital + proventos recibidos, sobre el costo" },
  { key: "value", label: "Saldo" },
  { key: "weight", label: "% cartera" },
  { key: null, label: "% ideal" },
  { key: null, label: "¿Comprar?" },
];

function BuyTag({ buy }: { buy: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${buy ? "bg-surface-2 text-ink" : "text-ink-3"}`}>
      <span aria-hidden>{buy ? "●" : "○"}</span>
      {buy ? "Sí" : "No"}
    </span>
  );
}

function Group({
  summary,
  positions,
  extra,
  targetPct,
  open,
  onToggle,
  sort,
  onSort,
}: {
  summary: ClassSummary;
  positions: Position[];
  extra: Record<string, AssetExtra>;
  targetPct: number | null;
  open: boolean;
  onToggle: () => void;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  const rows = useMemo(() => sortPositions(positions, sort.key, sort.dir, extra), [positions, sort, extra]);
  const receivedTotal = positions.reduce((s, p) => s + (extra[p.asset.ticker]?.received ?? 0), 0);
  const rent = summary.cost > 0 ? ((summary.gain + receivedTotal) / summary.cost) * 100 : null;
  const arrow = (k: SortKey | null) => (k && k === sort.key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  return (
    <section id={summary.class} className="card scroll-mt-20 overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/50 sm:px-5">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `var(--c-${summary.class})` }} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{summary.label}</span>
          <span className="block text-xs text-ink-3">{summary.count} activos</span>
        </span>
        <span className="hidden text-right sm:block">
          <span className="block text-[11px] text-ink-3">Variación</span>
          <span className={`num text-sm font-medium ${signClass(summary.gainPct)}`}>{fmtPct(summary.gainPct)}</span>
        </span>
        <span className="hidden w-24 text-right sm:block">
          <span className="block text-[11px] text-ink-3">Rentab.</span>
          <span className={`num text-sm font-medium ${signClass(rent)}`}>{fmtPct(rent)}</span>
        </span>
        <span className="hidden w-24 text-right md:block">
          <span className="block text-[11px] text-ink-3">Actual / ideal</span>
          <span className="num text-sm">
            {fmtPct(summary.weight, 0, false)} / {targetPct !== null ? fmtPct(targetPct, 0, false) : "—"}
          </span>
        </span>
        <span className="w-28 text-right">
          <span className="block text-[11px] text-ink-3">Valor total</span>
          <span className="num text-sm font-semibold">{fmtBRL(summary.value)}</span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-ink-3 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* En celular, el resumen de la clase va debajo del título */}
      <div className="num flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-xs text-ink-3 sm:hidden">
        <span>
          Variación <span className={signClass(summary.gainPct)}>{fmtPct(summary.gainPct)}</span>
        </span>
        <span>
          Rentab. <span className={signClass(rent)}>{fmtPct(rent)}</span>
        </span>
        <span>
          {fmtPct(summary.weight, 0, false)} / {targetPct !== null ? fmtPct(targetPct, 0, false) : "—"} ideal
        </span>
      </div>

      {open && (
        <div className="border-t border-line">
          {/* Celular */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((p) => {
              const x = extra[p.asset.ticker];
              const r = rentability(p, x?.received ?? 0);
              return (
                <li key={p.asset.ticker} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{p.asset.name && p.asset.class !== "acciones" && p.asset.class !== "fiis" ? p.asset.name : p.asset.ticker}</div>
                      <div className="num text-xs text-ink-3">
                        {fmtQty(p.asset.quantity)} × {fmtPrice(p.price)}
                        {p.asset.avg_price ? ` · PM ${fmtPrice(p.asset.avg_price)}` : ""}
                      </div>
                    </div>
                    <div className="num text-right font-medium">{fmtBRL(p.value)}</div>
                  </div>
                  <div className="num mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                    <span className="flex items-center gap-1">
                      Hoy <ChangePill pct={p.dayChangePct} />
                    </span>
                    <span>
                      Var. <span className={signClass(p.gainPct)}>{fmtPct(p.gainPct)}</span>
                    </span>
                    {x?.received ? (
                      <span>
                        Rentab. <span className={signClass(r)}>{fmtPct(r)}</span>
                      </span>
                    ) : null}
                    <span>
                      {fmtPct(p.weight, 2, false)} / {x ? fmtPct(x.idealPct, 2, false) : "—"}
                    </span>
                    {x && <BuyTag buy={x.buy} />}
                  </div>
                  <div className="mt-1 empty:hidden">
                    <QuoteBadge p={p} />
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Escritorio */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-xs text-ink-3">
                  {COLS.map((c, i) => (
                    <th key={c.label} title={c.title} className={`px-3 py-2 font-normal whitespace-nowrap ${i === 0 ? "pl-5 text-left" : "text-right"} ${i === COLS.length - 1 ? "pr-5" : ""}`}>
                      {c.key ? (
                        <button onClick={() => onSort(c.key!)} className={`hover:text-ink ${sort.key === c.key ? "font-medium text-ink" : ""}`}>
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
                    <tr key={p.asset.ticker} className="hover:bg-surface-2/50">
                      <td className="py-2.5 pr-3 pl-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{p.asset.ticker}</span>
                          <QuoteBadge p={p} />
                        </div>
                        {p.asset.name && <div className="max-w-48 truncate text-[11px] text-ink-3">{p.asset.name}</div>}
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
                      <td className={`num px-3 text-right ${signClass(p.gainPct)}`}>{fmtPct(p.gainPct)}</td>
                      <td className={`num px-3 text-right ${signClass(r)}`} title={x?.received ? `Incluye ${fmtBRL(x.received)} en proventos` : "Sin proventos importados"}>
                        {fmtPct(r)}
                      </td>
                      <td className="num px-3 text-right font-medium">{fmtBRL(p.value)}</td>
                      <td className="num px-3 text-right text-ink-2">{fmtPct(p.weight, 2, false)}</td>
                      <td className="num px-3 text-right text-ink-3">{x ? fmtPct(x.idealPct, 2, false) : "—"}</td>
                      <td className="pr-5 pl-3 text-right">{x && <BuyTag buy={x.buy} />}</td>
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
}: {
  classes: ClassSummary[];
  positions: Position[];
  extra: Record<string, AssetExtra>;
  targets: Targets | null;
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

  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: k === "ticker" ? 1 : -1 }));
  const allOpen = open.size === classes.length;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setOpen(allOpen ? new Set() : new Set(classes.map((c) => c.class)))} className="text-xs text-accent hover:underline">
          {allOpen ? "Contraer todo" : "Expandir todo"}
        </button>
      </div>
      {[...classes]
        .sort((a, b) => b.value - a.value)
        .map((c) => (
          <Group
            key={c.class}
            summary={c}
            positions={positions.filter((p) => p.asset.class === c.class)}
            extra={extra}
            targetPct={targets ? (targets.allocation[c.class] ?? 0) : null}
            open={open.has(c.class)}
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
