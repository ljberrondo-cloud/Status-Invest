"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useJson } from "@/components/data";
import { Card, ErrorState, Skeleton } from "@/components/ui";
import { UploadExtract } from "./Upload";
import { RECEIVED_LABELS, type CalendarPayment, type ReceivedSummary, type ReceivedType } from "@/lib/received";
import { PaymentsCalendar } from "./PaymentsCalendar";
import { fmtBRL, fmtBRLCompact, fmtDateLong, fmtPct, fmtSince } from "@/lib/format";

interface ReceivedResponse {
  imported: boolean;
  importedAt?: string;
  sourceFiles?: string[];
  owners?: string[];
  summary?: ReceivedSummary;
  calendar?: CalendarPayment[];
  upcoming?: CalendarPayment[];
}

const TYPES: ReceivedType[] = ["dividendo", "jcp", "rendimento", "outro"];
const color = (t: ReceivedType) => `var(--r-${t})`;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMonth = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

type MonthRow = ReceivedSummary["byMonth"][number] & { previsto: number };

/** Meses del gráfico: los 12 recibidos + lo previsto (estimado), y el mes siguiente si tiene previstos. */
function withExpected(s: ReceivedSummary, upcoming: CalendarPayment[]): MonthRow[] {
  const exp = new Map<string, number>();
  for (const p of upcoming) exp.set(p.date.slice(0, 7), (exp.get(p.date.slice(0, 7)) ?? 0) + p.amount);
  const rows: MonthRow[] = s.byMonth.map((m) => ({ ...m, previsto: Math.round((exp.get(m.month) ?? 0) * 100) / 100 }));
  const lastMonth = rows.at(-1)?.month;
  for (const [month, v] of [...exp].sort(([a], [b]) => a.localeCompare(b))) {
    if (lastMonth && month > lastMonth) rows.push({ month, total: 0, dividendo: 0, jcp: 0, rendimento: 0, outro: 0, previsto: Math.round(v * 100) / 100 });
  }
  return rows;
}

function MonthlyChart({ s, upcoming }: { s: ReceivedSummary; upcoming: CalendarPayment[] }) {
  const types = TYPES.filter((t) => s.byMonth.some((m) => m[t] > 0));
  const data = withExpected(s, upcoming);
  const hasExpected = data.some((m) => m.previsto > 0);
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={(v: number) => fmtBRLCompact(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const m = payload?.[0]?.payload as MonthRow | undefined;
                return active && m ? (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium">{fmtMonth(m.month)}</div>
                    {types.filter((t) => m[t] > 0).map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-sm" style={{ background: color(t) }} />
                        <span className="flex-1 text-ink-2">{RECEIVED_LABELS[t]}</span>
                        <span className="num">{fmtBRL(m[t])}</span>
                      </div>
                    ))}
                    {m.total > 0 && <div className="num mt-1 border-t border-line pt-1 text-right font-medium">Recebido {fmtBRL(m.total)}</div>}
                    {m.previsto > 0 && (
                      <div className="mt-1 flex items-center gap-2 text-ink-3">
                        <span className="h-2 w-2 rounded-sm border border-dashed" style={{ borderColor: "var(--r-rendimento)", background: "color-mix(in oklab, var(--r-rendimento) 30%, transparent)" }} />
                        <span className="flex-1">Previsto (estimado)</span>
                        <span className="num">~{fmtBRL(m.previsto)}</span>
                      </div>
                    )}
                  </div>
                ) : null;
              }}
            />
            {types.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                stackId="a"
                fill={color(t)}
                stroke="var(--surface)"
                strokeWidth={1}
                radius={i === types.length - 1 && !hasExpected ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
            {hasExpected && (
              <Bar
                dataKey="previsto"
                stackId="a"
                fill="var(--r-rendimento)"
                fillOpacity={0.28}
                stroke="var(--r-rendimento)"
                strokeOpacity={0.7}
                strokeDasharray="3 3"
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-2">
        {types.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(t) }} />
            {RECEIVED_LABELS[t]}
          </span>
        ))}
        {hasExpected && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed" style={{ borderColor: "var(--r-rendimento)", background: "color-mix(in oklab, var(--r-rendimento) 28%, transparent)" }} />
            Previsto (estimado)
          </span>
        )}
      </div>
    </div>
  );
}

export function EmptyReceived() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Ainda não há proventos carregados. Envie o extrato de Movimentação da B3 de cada conta.</p>
      <UploadExtract defaultOpen />
    </div>
  );
}

export function ReceivedView() {
  // Siempre consolidado: los proventos de todas las cuentas juntos.
  const { data, error, isLoading } = useJson<ReceivedResponse>("/api/received");
  if (error && !data) return <ErrorState message={error.message} />;
  if (isLoading || !data) return <Skeleton className="h-72" />;
  if (!data.imported || !data.summary) return <EmptyReceived />;
  const s = data.summary;
  const thisYear = new Date().getFullYear().toString();
  // Meses cubiertos por los datos importados (máx. 12), para no subestimar el promedio.
  const months = s.firstDate
    ? Math.min(12, Math.max(1, (Number(thisYear) - Number(s.firstDate.slice(0, 4))) * 12 + (new Date().getMonth() + 1) - Number(s.firstDate.slice(5, 7)) + 1))
    : 12;

  const owners = data.owners ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <UploadExtract />
      </div>
      <section className="card hero p-5 sm:p-7">
        <div className="eyebrow">Recebido nos últimos 12 meses{owners.length > 1 ? " · as duas contas" : ""}</div>
        <div className="num mt-2 text-[2.4rem] leading-none font-semibold tracking-[-0.03em] sm:text-5xl">{fmtBRL(s.last12m)}</div>
        {s.firstDate && (
          <div className="mt-3 inline-flex rounded-lg bg-warn-bg px-2.5 py-1 text-xs text-warn">
            Inclui só o que foi importado: dados desde {fmtSince(s.firstDate)}{owners.length < 2 ? ", de uma só conta" : ""}. Envie os relatórios que faltam para completar o histórico.
          </div>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-4 sm:max-w-xl">
          <div>
            <dt className="text-xs text-ink-3">Por mês</dt>
            <dd className="num mt-1 font-semibold">{fmtBRL(s.last12m / months)}</dd>
            {months < 12 && <dd className="text-[11px] text-ink-3">média de {months} {months === 1 ? "mês" : "meses"}</dd>}
          </div>
          <div>
            <dt className="text-xs text-ink-3">En {thisYear}</dt>
            <dd className="num mt-1 font-semibold">{fmtBRL(s.ytd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Histórico</dt>
            <dd className="num mt-1 font-semibold">{fmtBRL(s.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPES.filter((t) => s.byType[t] > 0 || t !== "outro")
          .sort((a, b) => s.byType[b] - s.byType[a])
          .map((t) => (
          <div key={t} className="card px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className="h-2 w-2 rounded-sm" style={{ background: color(t) }} />
              {RECEIVED_LABELS[t]}
            </div>
            <div className="num mt-0.5 font-medium">{fmtBRL(s.byType[t])}</div>
            <div className="num text-[11px] text-ink-3">{fmtPct(s.total ? (s.byType[t] / s.total) * 100 : 0, 1, false)} do total</div>
          </div>
        ))}
      </div>

      <Card title="Por mês · últimos 12 meses" subtitle="Pagamentos com data; em transparente, o previsto estimado pelo histórico. Os anos que só têm total anual não são divididos por mês.">
        <MonthlyChart s={s} upcoming={data.upcoming ?? []} />
      </Card>

      {data.calendar && <PaymentsCalendar received={data.calendar} upcoming={data.upcoming ?? []} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Por ativo">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="py-2 text-left font-normal">Ativo</th>
                <th className="py-2 text-right font-normal">12 meses</th>
                <th className="py-2 text-right font-normal">Histórico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.byTicker.map((t) => (
                <tr key={t.ticker}>
                  <td className="py-2">
                    <div className="font-medium">{t.ticker}</div>
                    <div className="text-[11px] text-ink-3">
                      {t.lastDate ? `${t.count} ${t.count === 1 ? "pagamento" : "pagamentos"} · último ${fmtDateLong(t.lastDate)}` : "só totais anuais"}
                    </div>
                  </td>
                  <td className="num py-2 text-right">{fmtBRL(t.last12m)}</td>
                  <td className="num py-2 text-right text-ink-2">{fmtBRL(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4">
          <Card title="Por ano">
            <ul className="divide-y divide-line text-sm">
              {s.byYear.map((y) => (
                <li key={y.year} className="flex items-center justify-between py-2">
                  <span>{y.year}</span>
                  <span className="num font-medium">{fmtBRL(y.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Últimos pagamentos">
            <ul className="divide-y divide-line text-sm">
              {s.recent.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.ticker}</span>
                      <span className="flex items-center gap-1 text-[11px] text-ink-3">
                        <span className="h-2 w-2 rounded-sm" style={{ background: color(p.type) }} />
                        {RECEIVED_LABELS[p.type]}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-3">{fmtDateLong(p.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-medium">{fmtBRL(p.amount)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <p className="text-xs text-ink-3">
        Fonte: B3 (extratos de Movimentação e relatórios consolidados, {data.sourceFiles?.length ?? 0} arquivos importados). Dados até{" "}
        {s.lastDate ? fmtDateLong(s.lastDate) : "—"}. Valores líquidos conforme informados pela B3.
      </p>
    </div>
  );
}
