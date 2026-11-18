"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useJson } from "@/components/data";
import { Card, ErrorState, Skeleton } from "@/components/ui";
import { UploadExtract } from "./Upload";
import { RECEIVED_LABELS, type ReceivedSummary, type ReceivedType } from "@/lib/received";
import { fmtBRL, fmtBRLCompact, fmtDateLong, fmtPct } from "@/lib/format";

interface ReceivedResponse {
  imported: boolean;
  importedAt?: string;
  sourceFiles?: string[];
  owners?: string[];
  summary?: ReceivedSummary;
}

const TYPES: ReceivedType[] = ["dividendo", "jcp", "rendimento", "outro"];
const color = (t: ReceivedType) => `var(--r-${t})`;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtMonth = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

function MonthlyChart({ s }: { s: ReceivedSummary }) {
  const types = TYPES.filter((t) => s.byMonth.some((m) => m[t] > 0));
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={s.byMonth} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={(v: number) => fmtBRLCompact(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const m = payload?.[0]?.payload as ReceivedSummary["byMonth"][number] | undefined;
                return active && m ? (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium">{fmtMonth(m.month)}</div>
                    {types.map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-sm" style={{ background: color(t) }} />
                        <span className="flex-1 text-ink-2">{RECEIVED_LABELS[t]}</span>
                        <span className="num">{fmtBRL(m[t])}</span>
                      </div>
                    ))}
                    <div className="num mt-1 border-t border-line pt-1 text-right font-medium">{fmtBRL(m.total)}</div>
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
                radius={i === types.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
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
      </div>
    </div>
  );
}

export function EmptyReceived() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Todavía no hay proventos cargados. Subí el extracto de Movimentação de B3 de cada cuenta.</p>
      <UploadExtract defaultOpen />
    </div>
  );
}

export function ReceivedView() {
  // Siempre consolidado: tus proventos y los de tu esposa juntos.
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
        <div className="eyebrow">Recibido en los últimos 12 meses{owners.length > 1 ? " · ambas cuentas" : ""}</div>
        <div className="num mt-2 text-[2.4rem] leading-none font-semibold tracking-[-0.03em] sm:text-5xl">{fmtBRL(s.last12m)}</div>
        {s.firstDate && (
          <div className="mt-3 inline-flex rounded-lg bg-warn-bg px-2.5 py-1 text-xs text-warn">
            Incluye sólo lo importado: desde {fmtDateLong(s.firstDate)} {s.firstDate.slice(0, 4)}. Subí extractos más antiguos para completar el historial.
          </div>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-4 sm:max-w-xl">
          <div>
            <dt className="text-xs text-ink-3">Por mes</dt>
            <dd className="num mt-1 font-semibold">{fmtBRL(s.last12m / months)}</dd>
            {months < 12 && <dd className="text-[11px] text-ink-3">promedio de {months} {months === 1 ? "mes" : "meses"}</dd>}
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
            <div className="num text-[11px] text-ink-3">{fmtPct(s.total ? (s.byType[t] / s.total) * 100 : 0, 1, false)} del total</div>
          </div>
        ))}
      </div>

      <Card title="Por mes · últimos 12 meses">
        <MonthlyChart s={s} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Por activo">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="py-2 text-left font-normal">Activo</th>
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
                      {t.count} pagos · último {fmtDateLong(t.lastDate)}
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
          <Card title="Por año">
            <ul className="divide-y divide-line text-sm">
              {s.byYear.map((y) => (
                <li key={y.year} className="flex items-center justify-between py-2">
                  <span>{y.year}</span>
                  <span className="num font-medium">{fmtBRL(y.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Últimos pagos">
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
        Fuente: extracto de Movimentação de B3 ({data.sourceFiles?.join(", ")}). Datos hasta {s.lastDate ? fmtDateLong(s.lastDate) : "—"}. Montos tal como los informa B3.
      </p>
    </div>
  );
}
