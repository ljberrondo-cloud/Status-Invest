"use client";

import { diagnose } from "@/lib/strategy";
import type { PortfolioResponse, Targets } from "@/lib/types";
import { fmtBRL, fmtPct } from "@/lib/format";
import { Badge, Card } from "../ui";

/** Fecha de los datos de mercado citados en las recomendaciones (tasas del Tesouro Direto). */
const AS_OF = "18/11/2026";

function Rec({ n, title, tag, tone = "muted", children }: { n: number; title: string; tag: string; tone?: "warn" | "accent" | "muted"; children: React.ReactNode }) {
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{n}</span>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <Badge tone={tone}>{tag}</Badge>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2 [&_b]:text-ink">{children}</div>
    </li>
  );
}

export function Strategy({ data, targets, monthly }: { data: PortfolioResponse; targets: Targets; monthly: number }) {
  const d = diagnose(data, targets);
  const investable = d.total * (1 - d.lockedPct / 100);
  const months = d.monthsToBalance(monthly);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Estratégia e equilíbrio</h2>
        <p className="mt-1 text-sm text-ink-3">Diagnóstico com os números de hoje e o que eu faria para equilibrar a carteira, incluindo ativos que vocês ainda não têm.</p>
      </div>

      {/* Diagnóstico en vivo */}
      <Card title="Diagnóstico">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">Não pode ser movido livremente</dt>
            <dd className="num mt-1 text-lg font-semibold">{fmtPct(d.lockedPct, 0, false)}</dd>
            <dd className="text-[11px] text-ink-3">previdência {fmtPct(d.previdenciaPct, 0, false)} · FGTS {fmtPct(d.fgtsPct, 0, false)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Maior posição</dt>
            <dd className="num mt-1 text-lg font-semibold">{d.topAsset ? fmtPct(d.topAsset.pct, 0, false) : "—"}</dd>
            <dd className="truncate text-[11px] text-ink-3">{d.topAsset?.name ?? d.topAsset?.ticker}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Exposição ao dólar</dt>
            <dd className="num mt-1 text-lg font-semibold">{fmtPct(d.foreignPct, 0, false)}</dd>
            <dd className="text-[11px] text-ink-3">ETFs internacionais + cripto</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Cripto em altcoins</dt>
            <dd className="num mt-1 text-lg font-semibold">{fmtPct(d.altcoinShareOfCrypto, 0, false)}</dd>
            <dd className="text-[11px] text-ink-3">do cripto (fora BTC/ETH)</dd>
          </div>
        </dl>
        {d.under.length > 0 && (
          <div className="mt-5 border-t border-line pt-4 text-sm">
            <div className="text-xs font-medium text-ink-2">Para chegar às metas sem vender</div>
            <ul className="mt-2 space-y-1.5">
              {d.under.map((u) => (
                <li key={u.label} className="flex items-baseline justify-between gap-3">
                  <span>
                    {u.label}{" "}
                    <span className="num text-xs text-ink-3">
                      {fmtPct(u.currentPct, 1, false)} → {fmtPct(u.targetPct, 0, false)}
                    </span>
                  </span>
                  <span className="num font-medium">{fmtBRL(u.gap)}</span>
                </li>
              ))}
            </ul>
            {monthly > 0 && Number.isFinite(months) && (
              <p className="mt-3 text-xs text-ink-3">
                Com {fmtBRL(monthly)} por mês entre os dois, completar tudo leva cerca de <b className="text-ink-2">{months} meses</b> (sem contar a oscilação dos preços).
              </p>
            )}
          </div>
        )}
        {d.over.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            Acima da meta: {d.over.map((o) => `${o.label} (${fmtPct(o.currentPct, 1, false)} x ${fmtPct(o.targetPct, 0, false)})`).join(", ")}. Não precisa vender: basta parar de aportar nelas.
          </p>
        )}
      </Card>

      {/* Recomendaciones */}
      <ol className="space-y-4">
        <Rec n={1} title="Aproveitar os juros reais altos, por mais tempo" tag="Renda fixa · prioridade alta" tone="warn">
          <p>
            Em {AS_OF} o Tesouro IPCA+ paga <b>IPCA + 7,89% em 2035</b> e <b>IPCA + 7,61% em 2045</b>, com a Selic em 13,75% e o IPCA em 4,63%. Juros reais perto de 8% são
            excepcionais na história do Brasil: travá-los por muitos anos é uma das melhores decisões de longo prazo disponíveis hoje.
          </p>
          <p>
            O IPCA+ 2029 é a maior posição de renda fixa, mas vence em 2029: depois vocês vão reinvestir à taxa que houver na época. Para os novos aportes no Tesouro
            vale <b>alongar o prazo com IPCA+ 2035</b> (e uma parte em 2045 se for dinheiro para a aposentadoria), formando uma escada de vencimentos. Levem até o
            vencimento: no caminho o preço sobe e desce (marcação a mercado), mas no final recebe-se a taxa contratada.
          </p>
          <p>
            Se vocês acham que a Selic vai cair, o <b>Tesouro Prefixado 2031/2032 (~15,3% ao ano)</b> ganha do CDI nesse cenário; se a inflação surpreender, perde. Uma
            parte pequena, como complemento.
          </p>
        </Rec>

        <Rec n={2} title="Primeiro, a reserva de emergência" tag="Liquidez">
          <p>
            Antes de somar risco, tenham <b>6 meses de gastos da família</b> em algo que dê para resgatar no mesmo dia: Tesouro Selic ou um CDB com liquidez diária de 100% do
            CDI ou mais. Hoje vocês têm {fmtBRL(data.positions.find((p) => p.asset.class === "tesouro" && p.asset.ticker.startsWith("SELIC"))?.value ?? 0)} no Tesouro Selic e{" "}
            {fmtBRL(data.byClass.find((c) => c.class === "renta_fija")?.value ?? 0)} em CDB. Se isso não cobre 6 meses, completar a reserva vem antes de qualquer outra compra.
          </p>
        </Rec>

        <Rec n={3} title="Metas sobre o que vocês administram" tag="Planejamento" tone="accent">
          <p>
            A previdência da empresa (<b>{fmtPct(d.previdenciaPct, 0, false)}</b>) e o FGTS (<b>{fmtPct(d.fgtsPct, 0, false)}</b>) contam como patrimônio, mas vocês não podem
            movê-los: por isso as metas são medidas só sobre o que vocês realmente decidem (~{fmtBRL(investable)}). Hoje essas metas são as do Investidor10 distribuídas sobre essa
            parte. Uma distribuição mais equilibrada, com os juros de hoje:
          </p>
          <div className="overflow-x-auto">
            <table className="mt-1 w-full max-w-md text-sm">
              <tbody className="divide-y divide-line">
                {[
                  ["Tesouro IPCA+ largo (2035/2045)", "25%"],
                  ["Reserva e renda fixa (Selic, CDB, LCI/LCA)", "20%"],
                  ["Ações Brasil", "15%"],
                  ["Internacional (ETFs em dólar)", "15%"],
                  ["FIIs", "15%"],
                  ["Cripto (BTC e ETH)", "5%"],
                  ["Ouro", "5%"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-1.5 pr-4">{k}</td>
                    <td className="num py-1.5 text-right font-semibold text-ink">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">Se fizer sentido, eu configuro como meta do app e os alertas e recomendações são recalculados sozinhos.</p>
        </Rec>

        <Rec n={4} title="Previdência da empresa: aproveitar a contrapartida" tag="Previdência">
          <p>
            É o investimento com melhor retorno garantido que vocês têm: na maioria dos planos corporativos a empresa <b>aporta um valor igual ou proporcional</b> ao do
            funcionário (contrapartida). Por isso vale <b>aportar no mínimo o necessário para receber o máximo da empresa</b> antes de qualquer outro investimento.
          </p>
          <p>
            Confiram no regulamento do plano: o percentual de contrapartida, o <b>vesting</b> (que parte do que a empresa aportou fica com vocês ao trocar de emprego), se o
            regime de IR é <b>regressivo</b> (cai até 10% depois de 10 anos) e, se for <b>PGBL</b>, que os aportes deduzem até 12% da renda bruta na declaração
            completa. Ao sair da empresa, o saldo pode ir para outro plano por <b>portabilidade</b>, sem pagar imposto.
          </p>
        </Rec>

        <Rec n={5} title="Cripto: núcleo em BTC e ETH, sem fazer preço médio em altcoins" tag="Cripto" tone="warn">
          <p>
            {fmtPct(d.altcoinShareOfCrypto, 0, false)} do que vocês têm em cripto está em altcoins (SOL, DOGE, DOT, AVAX), com quedas de 70% a 94% sobre o preço de compra.
            As altcoins podem nunca se recuperar; BTC e, em menor grau, ETH são as que têm mais histórico e liquidez. Por isso, na recomendação mensal{" "}
            <b>os aportes em cripto vão só para BTC (70%) e ETH (30%)</b>.
          </p>
          <p>
            No total: <b>5% a 10% do patrimônio no máximo</b>. Consolidar aos poucos as altcoins em BTC é razoável; antes de vender, confiram as regras de imposto
            sobre cripto vigentes no Brasil, que mudaram nos últimos anos.
          </p>
        </Rec>

        <Rec n={6} title="Mais diversificação em dólar" tag="Internacional">
          <p>
            Só <b>{fmtPct(d.foreignPct, 0, false)}</b> do patrimônio está em dólar (ETFs + cripto). Para uma família que vive em reais, entre 15% e 25% fora protege contra
            desvalorizações e crises locais. O núcleo mais eficiente é o <b>IVVB11</b> (S&amp;P 500, um dos mais baratos). <b>SPYI11 e QQQI11</b> vendem opções para pagar
            rendimentos mensais: dão mais renda, mas sobem menos em mercados de alta; para crescimento de longo prazo, priorizar IVVB11. Para ir além dos EUA:
            ETFs de Nasdaq (NASD11), da Europa ou de emergentes, ou BDRs de ETFs globais.
          </p>
        </Rec>

        <Rec n={7} title="Ações Brasil: completar com qualidade, não com quantidade" tag="Renda variável">
          <p>
            Estão em {fmtPct(data.byClass.find((c) => c.class === "acciones")?.weight ?? 0, 1, false)} contra 10% de meta, divididas em{" "}
            {data.byClass.find((c) => c.class === "acciones")?.count ?? 0} posições pequenas. Com a Selic alta a bolsa costuma estar barata, o que favorece comprar aos poucos.
            Melhor reforçar as de maior qualidade e bons dividendos do que somar nomes novos; ou simplificar com um ETF amplo como <b>BOVA11</b> (Ibovespa) ou <b>SMAL11</b>{" "}
            (small caps, mais risco e mais potencial).
          </p>
        </Rec>

        <Rec n={8} title="FIIs: pausar aportes e reinvestir em outras classes" tag="FIIs">
          <p>
            Estão acima da meta. Os rendimentos de FIIs são mensais e isentos de IR: usem-nos para completar as classes atrasadas em vez de recomprar FIIs.
            Revisem a tese dos que mais caíram
            {d.worst.filter((w) => w.ticker.endsWith("11") && !["IVVB11", "SPYI11", "QQQI11"].includes(w.ticker)).length
              ? ` (${d.worst
                  .filter((w) => w.ticker.endsWith("11") && !["IVVB11", "SPYI11", "QQQI11"].includes(w.ticker))
                  .map((w) => `${w.ticker} ${fmtPct(w.gainPct, 0)}`)
                  .join(", ")})`
              : ""}
            : um FII de desenvolvimento ou de recebíveis com problemas não se recupera só com o tempo. Os fundos de fundos (como HFOF11) somam uma camada de custos.
          </p>
        </Rec>

        <Rec n={9} title="Ouro como seguro da carteira" tag="Ativo novo">
          <p>
            Uns <b>3% a 5% em ouro</b> (por exemplo, o ETF <b>GOLD11</b>) costuma subir quando todo o resto cai e protege em crises e desvalorizações. Não paga renda: é um seguro,
            não uma fonte de renda.
          </p>
        </Rec>

        <Rec n={10} title="Renda fixa privada isenta de IR" tag="Renda fixa">
          <p>
            Para completar a renda fixa: <b>LCI e LCA</b> são isentas de IR para pessoa física, e <b>CDBs</b> de bancos sólidos pagam mais que o CDI em prazos longos. Todos
            têm garantia do <b>FGC de até R$ 250 mil por CPF por instituição</b>: se os dois investirem, cada um tem seu próprio limite.
          </p>
        </Rec>
      </ol>

      <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-3">
        Análise educativa feita com os dados da carteira e princípios de investimento de longo prazo; não substitui a recomendação personalizada de um consultor certificado (CEA,
        CFP®) nem considera a situação fiscal completa. Taxas do Tesouro em {AS_OF}; o resto dos números se atualiza sozinho. Rentabilidade passada não garante
        rentabilidade futura.
      </p>
    </div>
  );
}
