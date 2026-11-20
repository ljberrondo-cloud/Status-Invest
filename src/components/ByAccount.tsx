"use client";

import { useState } from "react";
import { ACCOUNTS } from "@/lib/accounts";
import { summarizeByAccount, UNASSIGNED } from "@/lib/by-account";
import { CLASS_LABELS, type Position } from "@/lib/types";
import { fmtBRL, fmtPct, fmtQty, fmtSignedBRL, signClass } from "@/lib/format";
import { Card, TickerAvatar } from "./ui";

const ACCOUNT_COLOR: Record<string, string> = {
  "conta-1": "var(--accent)",
  "conta-2": "var(--c-tesouro)",
  [UNASSIGNED]: "var(--c-otros)",
};

export function ByAccount({ positions }: { positions: Position[] }) {
  const groups = summarizeByAccount(positions, ACCOUNTS);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {/* Reparto del patrimonio */}
      <Card title="Divisão do patrimônio" subtitle="Valor de hoje de cada conta">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
          {groups.map((g) => (
            <div key={g.id} style={{ width: `${g.weight}%`, background: ACCOUNT_COLOR[g.id] ?? "var(--c-etfs)" }} title={`${g.label} ${fmtPct(g.weight, 1, false)}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {groups.map((g) => (
            <span key={g.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCOUNT_COLOR[g.id] ?? "var(--c-etfs)" }} />
              {g.label}
              <span className="num font-semibold">{fmtPct(g.weight, 1, false)}</span>
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => {
          const isOpen = open === g.id;
          const byClass = Object.entries(
            g.items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.class]: (acc[i.class] ?? 0) + i.value }), {}),
          ).sort((a, b) => b[1] - a[1]);
          return (
            <section key={g.id} className={`card overflow-hidden ${g.id === UNASSIGNED ? "lg:col-span-2" : ""}`}>
              <div className="relative p-5 sm:p-6">
                <span className="absolute inset-y-5 left-0 w-1 rounded-r-full" style={{ background: ACCOUNT_COLOR[g.id] ?? "var(--c-etfs)" }} aria-hidden />
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight">{g.label}</h2>
                  <span className="num text-xs text-ink-3">{fmtPct(g.weight, 1, false)} do total</span>
                </div>
                <div className="num mt-2 text-3xl font-semibold tracking-tight">{fmtBRL(g.value)}</div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-3">Ativos</dt>
                    <dd className="num mt-0.5 font-semibold">{g.count}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Investido</dt>
                    <dd className="num mt-0.5 font-semibold">{g.invested > 0 ? fmtBRL(g.invested) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Ganho</dt>
                    <dd className={`num mt-0.5 font-semibold ${signClass(g.gain)}`}>
                      {g.invested > 0 ? (
                        <>
                          {fmtSignedBRL(g.gain)}
                          <span className="block text-xs font-medium">{fmtPct(g.gainPct, 1)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {byClass.map(([cls, val]) => (
                    <span key={cls} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-ink-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--c-${cls})` }} />
                      {CLASS_LABELS[cls as keyof typeof CLASS_LABELS]}
                      <span className="num font-medium text-ink">{fmtBRL(val)}</span>
                    </span>
                  ))}
                </div>
                {g.id === UNASSIGNED && (
                  <p className="mt-3 text-xs text-ink-3">Ativos fora da B3 sem titular definido (cripto, previdência, FGTS, CDB). Indique de quem é cada um para dividi-los.</p>
                )}
              </div>
              <button
                onClick={() => setOpen(isOpen ? null : g.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between border-t border-line px-5 py-3 text-sm font-medium text-accent hover:bg-surface-2/50 sm:px-6"
              >
                {isOpen ? "Ocultar ativos" : `Ver os ${g.count} ativos`}
                <span aria-hidden>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <ul className="divide-y divide-line border-t border-line">
                  {g.items.map((i) => (
                    <li key={i.ticker} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                      <TickerAvatar ticker={i.ticker} cls={i.class} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{i.name && !/^[A-Z]{4}\d/.test(i.ticker) ? i.name : i.ticker}</div>
                        <div className="num text-xs text-ink-3">
                          {fmtQty(i.quantity)} {i.invested !== null ? `· inv. ${fmtBRL(i.invested)}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-sm font-semibold">{fmtBRL(i.value)}</div>
                        {i.invested !== null && i.invested > 0 && (
                          <div className={`num text-[11px] ${signClass(i.value - i.invested)}`}>{fmtPct(((i.value - i.invested) / i.invested) * 100, 1)}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-ink-3">
        Investido por conta = quantidade da conta × preço médio (o preço médio é o mesmo nas duas contas); no Tesouro usa-se o valor aplicado informado pela
        B3. As quantidades de cada conta são atualizadas ao enviar o relatório mensal.
      </p>
    </div>
  );
}
