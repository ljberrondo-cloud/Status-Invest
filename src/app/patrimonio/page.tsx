"use client";

import { useJson, usePortfolio } from "@/components/data";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import type { BemValue } from "@/lib/bens";
import { isoToBr } from "@/lib/dates";
import { fmtBRL, fmtMoneyInt, fmtPct } from "@/lib/format";

interface BensResponse {
  asOf: string | null;
  items: BemValue[];
}

const monthRef = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

export default function Patrimonio() {
  const { data, error } = usePortfolio();
  const bens = useJson<BensResponse>("/api/bens");

  if (!data && error) return <ErrorState message={error.message} />;
  if (!data || !bens.data) return <Skeleton className="h-96" />;

  const value = (t: string) => data.positions.find((p) => p.asset.ticker === t)?.value ?? 0;
  const previdencia = value("PREVIDENCIA");
  const fgts = value("FGTS");
  const livres = data.total - previdencia - fgts;
  const items = bens.data.items;
  const imovel = items.filter((b) => b.kind === "imovel").reduce((s, b) => s + b.value, 0);
  const veiculos = items.filter((b) => b.kind === "veiculo").reduce((s, b) => s + b.value, 0);
  const total = data.total + imovel + veiculos;
  const usd = data.indicators.find((i) => i.id === "usd" && i.value > 0);
  const ars = data.indicators.find((i) => i.id === "brlArs" && i.value > 0);

  const parts = [
    { key: "livres", label: "Investimentos livres", value: livres, color: "var(--accent)" },
    { key: "previdencia", label: "Previdência", value: previdencia, color: "var(--c-etfs)" },
    { key: "fgts", label: "FGTS", value: fgts, color: "var(--c-otros)" },
    { key: "imovel", label: "Imóvel", value: imovel, color: "var(--c-tesouro)" },
    { key: "veiculos", label: "Veículos", value: veiculos, color: "var(--c-renta_fija)" },
  ]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <PageHeader title="Patrimônio total" subtitle="Investimentos + bens (casa e carros). Os bens não entram nas metas nem na rentabilidade." />

      <section className="card hero p-5 sm:p-7">
        <div className="eyebrow">Patrimônio total</div>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="num text-[2.1rem] leading-none font-semibold tracking-[-0.035em] sm:text-[2.6rem]">{fmtBRL(total)}</div>
          <div className="flex items-end gap-5 pb-0.5 sm:border-l sm:border-line-strong sm:pl-6">
            {usd && (
              <div>
                <div className="text-[11px] text-ink-3">Em dólar</div>
                <div className="num text-lg leading-tight font-semibold tracking-tight text-ink-2 sm:text-xl">{fmtMoneyInt("US$", total / usd.value)}</div>
              </div>
            )}
            {ars && (
              <div>
                <div className="text-[11px] text-ink-3">Em peso argentino</div>
                <div className="num text-lg leading-tight font-semibold tracking-tight text-ink-2 sm:text-xl">{fmtMoneyInt("AR$", total * ars.value)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Composição do patrimônio">
          {parts.map((p) => (
            <div key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label} ${fmtPct((p.value / total) * 100, 1, false)}`} />
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          {parts.map((p) => (
            <div key={p.key}>
              <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </dt>
              <dd className="num mt-0.5 font-semibold">{fmtBRL(p.value)}</dd>
              <dd className="num text-[11px] text-ink-3">{fmtPct((p.value / total) * 100, 1, false)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card title="Investimentos + bens" subtitle="Em reais, dólar (PTAX) e peso argentino (oficial)">
        <div className="divide-y divide-line">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-3 pb-2 text-xs text-ink-3 sm:grid">
            <span />
            <span className="text-right">Reais</span>
            <span className="text-right">Dólar</span>
            <span className="text-right">Peso argentino</span>
          </div>
          {[
            { key: "inv", label: "Investimentos", hint: "carteira, previdência e FGTS", value: data.total },
            { key: "bens", label: "Bens", hint: "casa e carros", value: imovel + veiculos },
            { key: "total", label: "Patrimônio total", hint: null, value: total },
          ].map((r) => (
            <div key={r.key} className={`grid grid-cols-1 gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline ${r.key === "total" ? "font-semibold" : ""}`}>
              <div className="mb-1 sm:mb-0">
                <span className={r.key === "total" ? "" : "font-medium"}>{r.label}</span>
                {r.hint && <span className="ml-2 text-xs font-normal text-ink-3">{r.hint}</span>}
              </div>
              <span className="num text-[15px] whitespace-nowrap sm:text-right">{fmtBRL(r.value)}</span>
              <span className="num text-sm whitespace-nowrap text-ink-2 sm:text-right sm:text-[15px]">{usd ? fmtMoneyInt("US$", r.value / usd.value) : "—"}</span>
              <span className="num text-sm whitespace-nowrap text-ink-2 sm:text-right sm:text-[15px]">{ars ? fmtMoneyInt("AR$", r.value * ars.value) : "—"}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Bens" subtitle={`Valores estimados em ${bens.data.asOf ? isoToBr(bens.data.asOf) : "—"}: média entre a tabela FIPE e a mediana dos anúncios; o imóvel, pela mediana do R$/m² de casas comparáveis.`}>
        {/* Celular: una tarjeta por bien */}
        <ul className="space-y-3 sm:hidden">
          {items.map((b) => (
            <li key={b.id} className="rounded-xl border border-line p-3.5">
              <div className="font-medium">{b.name}</div>
              {b.details && <div className="text-xs text-ink-3">{b.details}</div>}
              <dl className="mt-3 space-y-1.5 text-sm">
                {b.fipe && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-3">FIPE (ref. {monthRef(b.fipe.ref)})</dt>
                    <dd className="num">{fmtBRL(b.fipe.value)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-ink-3">Mercado · mediana de {b.market.length} anúncios</dt>
                  <dd className="num">{fmtBRL(b.marketValue)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
                  <dt className="text-xs text-ink-3">Valor considerado</dt>
                  <dd className="num font-semibold">{fmtBRL(b.value)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="-mx-1 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="px-1 py-2 font-normal">Bem</th>
                <th className="px-1 py-2 text-right font-normal">FIPE</th>
                <th className="px-1 py-2 text-right font-normal">Mercado (mediana)</th>
                <th className="px-1 py-2 text-right font-normal">Valor considerado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="px-1 py-3">
                    <div className="font-medium">{b.name}</div>
                    {b.details && <div className="text-xs text-ink-3">{b.details}</div>}
                  </td>
                  <td className="num px-1 py-3 text-right">
                    {b.fipe ? (
                      <>
                        <a href={b.fipe.source} target="_blank" rel="noreferrer" className="hover:underline">
                          {fmtBRL(b.fipe.value)}
                        </a>
                        <div className="text-[11px] text-ink-3">ref. {monthRef(b.fipe.ref)}</div>
                      </>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="num px-1 py-3 text-right">
                    {fmtBRL(b.marketValue)}
                    <div className="text-[11px] text-ink-3">
                      {b.market.length} anúncios · {fmtBRL(Math.min(...b.market.map((l) => l.price)))} a {fmtBRL(Math.max(...b.market.map((l) => l.price)))}
                    </div>
                  </td>
                  <td className="num px-1 py-3 text-right">
                    <span className="font-semibold">{fmtBRL(b.value)}</span>
                    <div className="text-[11px] text-ink-3">{b.method}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
          Os anúncios mostram o preço pedido, que costuma ficar acima do preço de fechamento. Carros perdem valor todo ano; o imóvel não desconta financiamento:
          se houver saldo devedor, ele deve ser subtraído. Valores atualizados à mão em data/bens.json.
        </p>
      </Card>
    </div>
  );
}
