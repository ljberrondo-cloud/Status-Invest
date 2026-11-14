"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/types";
import { fmtBRL, fmtPct, fmtPrice, fmtQty, fmtSignedBRL } from "@/lib/format";
import { ChangePill, ChangeText, QuoteBadge } from "./ui";

type SortKey = "ticker" | "quantity" | "price" | "change" | "value" | "weight";
const COLS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "ticker", label: "Activo", align: "left" },
  { key: "quantity", label: "Cantidad", align: "right" },
  { key: "price", label: "Precio", align: "right" },
  { key: "change", label: "Var. día", align: "right" },
  { key: "value", label: "Posición", align: "right" },
  { key: "weight", label: "% total", align: "right" },
];

const getter: Record<SortKey, (p: Position) => number | string | null> = {
  ticker: (p) => p.asset.ticker,
  quantity: (p) => p.asset.quantity,
  price: (p) => p.price,
  change: (p) => p.dayChangePct,
  value: (p) => p.value,
  weight: (p) => p.weight,
};

export function sortPositions(rows: Position[], key: SortKey, dir: 1 | -1) {
  return [...rows].sort((a, b) => {
    const x = getter[key](a);
    const y = getter[key](b);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // sin dato siempre al final
    if (y === null) return -1;
    return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * dir;
  });
}

export function PositionsTable({ positions }: { positions: Position[] }) {
  const [key, setKey] = useState<SortKey>("value");
  const [dir, setDir] = useState<1 | -1>(-1);
  const rows = useMemo(() => sortPositions(positions, key, dir), [positions, key, dir]);
  const onSort = (k: SortKey) => {
    if (k === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setKey(k);
      setDir(k === "ticker" ? 1 : -1);
    }
  };
  const arrow = (k: SortKey) => (k === key ? (dir === 1 ? "↑" : "↓") : "");

  return (
    <div>
      {/* Orden en celular */}
      <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 pb-1 sm:hidden" role="group" aria-label="Ordenar por">
        {COLS.map((c) => (
          <button
            key={c.key}
            onClick={() => onSort(c.key)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${key === c.key ? "border-ink bg-ink text-bg" : "border-line text-ink-2"}`}
          >
            {c.label} {arrow(c.key)}
          </button>
        ))}
      </div>

      {/* Celular: filas de dos líneas */}
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((p) => (
          <li key={p.asset.ticker} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{p.asset.ticker}</div>
                {p.asset.name && <div className="truncate text-xs text-ink-3">{p.asset.name}</div>}
              </div>
              <div className="num text-right font-medium">{fmtBRL(p.value)}</div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-ink-3">
              <span className="num">
                {fmtQty(p.asset.quantity)} × {fmtPrice(p.price)}
              </span>
              <span className="flex items-center gap-2">
                <span className="num">{fmtPct(p.weight, 1, false)}</span>
                <ChangePill pct={p.dayChangePct} />
              </span>
            </div>
            <div className="mt-1 empty:hidden">
              <QuoteBadge p={p} />
            </div>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            {COLS.map((c) => (
              <th key={c.key} className={`py-2 font-normal ${c.align === "right" ? "text-right" : "text-left"}`} aria-sort={key === c.key ? (dir === 1 ? "ascending" : "descending") : "none"}>
                <button onClick={() => onSort(c.key)} className={`hover:text-ink ${key === c.key ? "font-medium text-ink" : ""}`}>
                  {c.label} {arrow(c.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => (
            <tr key={p.asset.ticker} className="hover:bg-surface-2/60">
              <td className="py-3 pr-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.asset.ticker}</span>
                  <QuoteBadge p={p} />
                </div>
                {p.asset.name && <div className="text-xs text-ink-3">{p.asset.name}</div>}
              </td>
              <td className="num py-3 text-right text-ink-2">{fmtQty(p.asset.quantity)}</td>
              <td className="num py-3 text-right">{fmtPrice(p.price)}</td>
              <td className="py-3 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <ChangePill pct={p.dayChangePct} />
                  {p.dayChange !== null && (
                    <ChangeText value={p.dayChange}>
                      <span className="text-[11px]">{fmtSignedBRL(p.dayChange)}</span>
                    </ChangeText>
                  )}
                </div>
              </td>
              <td className="num py-3 text-right font-medium">{fmtBRL(p.value)}</td>
              <td className="num py-3 text-right text-ink-2">{fmtPct(p.weight, 1, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
