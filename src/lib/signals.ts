/**
 * Señal por activo (Compra / Hodl / Alerta / Venta) a partir de:
 *  - técnico: tendencia (medias de 20 y 50 ruedas), RSI, MACD, distancia al máximo;
 *  - fundamental: P/L y dividend yield (acciones), yield y estabilidad de rendimientos (FIIs);
 *  - cartera: peso del activo y de su clase frente al objetivo.
 * Es una regla fija y transparente, no una recomendación personalizada.
 */

import type { AssetClass } from "./types";
import type { TechSummary } from "./technical";

export type SignalKind = "compra" | "hodl" | "alerta" | "venta";

export const SIGNAL_LABELS: Record<SignalKind, string> = { compra: "Compra", hodl: "Hodl", alerta: "Alerta", venta: "Venda" };

export interface Note {
  text: string;
  tone: "pos" | "neg" | "neutral";
}

export interface SignalInput {
  cls: AssetClass;
  /** Fuera de los objetivos (previdencia de la empresa, FGTS): no se puede mover. */
  excluded: boolean;
  tech: TechSummary | null;
  /** Precio / lucro (brapi). */
  pe: number | null;
  /** Mínimo y máximo de 52 semanas (brapi). */
  low52: number | null;
  high52: number | null;
  price: number | null;
  /** Dividend yield anual % estimado con los proventos cobrados. */
  dy: number | null;
  /** Variación % de los últimos 3 pagos frente a los 3 anteriores (FIIs). */
  incomeTrend: number | null;
  /** % del patrimonio total. */
  weight: number | null;
  maxAssetPct: number;
  /** Clase: actual − objetivo, en p.p. sobre lo invertible. null si no hay objetivo. */
  classGap: number | null;
  tolerance: number;
}

export interface SignalResult {
  signal: SignalKind;
  score: number;
  techScore: number | null;
  fundScore: number | null;
  tech: Note[];
  fund: Note[];
  portfolio: Note[];
  /** Una línea que resume por qué. */
  headline: string;
}

const pct = (n: number, d = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: d })}%`;
const num = (n: number, d = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

const FIXED: AssetClass[] = ["tesouro", "renta_fija", "fondos", "otros"];

function techPart(t: TechSummary | null, alerts: string[]): { score: number | null; notes: Note[] } {
  if (!t) return { score: null, notes: [{ text: "Sem histórico de preços suficiente para a análise técnica", tone: "neutral" }] };
  const notes: Note[] = [];
  let s = 0;
  if (t.trend === "alcista") {
    s += 1;
    notes.push({ text: "Tendência de alta: preço acima das médias de 20 e 50 pregões", tone: "pos" });
  } else if (t.trend === "bajista") {
    s -= 1;
    notes.push({ text: "Tendência de baixa: preço abaixo das médias de 20 e 50 pregões", tone: "neg" });
  } else if (t.trend === "lateral") notes.push({ text: "Tendência lateral (médias de 20 e 50 pregões cruzadas)", tone: "neutral" });

  if (t.sma200 !== null) {
    const above = t.last > t.sma200;
    s += above ? 0.5 : -0.5;
    notes.push({ text: `${above ? "Acima" : "Abaixo"} da média de 200 pregões`, tone: above ? "pos" : "neg" });
  }
  if (t.rsi !== null) {
    if (t.rsi < 30) {
      s += 1;
      notes.push({ text: `RSI ${num(t.rsi, 0)}: sobrevendido, costuma antecipar repique`, tone: "pos" });
    } else if (t.rsi > 70) {
      s -= 1;
      notes.push({ text: `RSI ${num(t.rsi, 0)}: sobrecomprado, melhor esperar`, tone: "neg" });
    } else notes.push({ text: `RSI ${num(t.rsi, 0)}: neutro`, tone: "neutral" });
  }
  if (t.macdCross === "up") {
    s += 0.5;
    notes.push({ text: "MACD cruzou para cima nos últimos dias", tone: "pos" });
  } else if (t.macdCross === "down") {
    s -= 0.5;
    notes.push({ text: "MACD cruzou para baixo nos últimos dias", tone: "neg" });
  }
  if (t.fromHigh <= -25 && t.trend === "bajista") {
    alerts.push(`Caiu ${pct(t.fromHigh)} desde a máxima do período e segue em queda`);
  } else if (t.fromHigh <= -10) notes.push({ text: `${pct(t.fromHigh)} desde a máxima do período`, tone: "neutral" });
  return { score: s, notes };
}

function fundPart(i: SignalInput, alerts: string[]): { score: number | null; notes: Note[] } {
  const notes: Note[] = [];
  let s = 0;
  let any = false;
  if (i.cls === "acciones") {
    if (i.pe !== null) {
      any = true;
      if (i.pe < 0) {
        s -= 1;
        alerts.push("A empresa dá prejuízo (P/L negativo)");
      } else if (i.pe <= 10) {
        s += 1;
        notes.push({ text: `P/L ${num(i.pe)}: barata em relação ao lucro`, tone: "pos" });
      } else if (i.pe > 25) {
        s -= 1;
        notes.push({ text: `P/L ${num(i.pe)}: cara em relação ao lucro`, tone: "neg" });
      } else notes.push({ text: `P/L ${num(i.pe)}: preço razoável`, tone: "neutral" });
    }
    if (i.dy !== null) {
      any = true;
      if (i.dy >= 8) {
        s += 1;
        notes.push({ text: `Dividend yield de ${num(i.dy)}% em 12 meses: alto`, tone: "pos" });
      } else if (i.dy >= 4) notes.push({ text: `Dividend yield de ${num(i.dy)}% em 12 meses`, tone: "neutral" });
      else notes.push({ text: `Dividend yield de ${num(i.dy)}% em 12 meses: baixo`, tone: "neutral" });
    }
  } else if (i.cls === "fiis") {
    if (i.dy !== null) {
      any = true;
      if (i.dy >= 10) {
        s += 1;
        notes.push({ text: `Rende ${num(i.dy)}% ao ano em rendimentos: atrativo`, tone: "pos" });
      } else if (i.dy < 7) {
        s -= 1;
        notes.push({ text: `Rende ${num(i.dy)}% ao ano: abaixo da renda fixa`, tone: "neg" });
      } else notes.push({ text: `Rende ${num(i.dy)}% ao ano em rendimentos`, tone: "neutral" });
    }
    if (i.incomeTrend !== null) {
      any = true;
      if (i.incomeTrend <= -15) {
        s -= 1;
        alerts.push(`Rendimento mensal caiu: ${pct(i.incomeTrend)} nos últimos 3 pagamentos`);
      } else if (i.incomeTrend >= 5) {
        s += 0.5;
        notes.push({ text: `Rendimento mensal em alta (${pct(i.incomeTrend)})`, tone: "pos" });
      } else notes.push({ text: "Rendimento mensal estável", tone: "pos" });
    }
  } else if (i.cls === "etfs") notes.push({ text: "ETF: replica um índice, sem balanço próprio para analisar", tone: "neutral" });
  else if (i.cls === "cripto") notes.push({ text: "Cripto: não tem lucro nem dividendos, só análise técnica", tone: "neutral" });

  if (i.price !== null && i.low52 !== null && i.high52 !== null && i.high52 > i.low52) {
    const pos = ((i.price - i.low52) / (i.high52 - i.low52)) * 100;
    any = true;
    notes.push({
      text: `Em ${num(pos, 0)}% da faixa de 52 semanas (R$ ${num(i.low52, 2)} – R$ ${num(i.high52, 2)})`,
      tone: pos <= 20 ? "pos" : pos >= 90 ? "neg" : "neutral",
    });
    if (pos <= 20) s += 0.5;
    else if (pos >= 90) s -= 0.5;
  }
  if (!any && !notes.length) notes.push({ text: "Sem dados fundamentalistas disponíveis", tone: "neutral" });
  return { score: any ? s : null, notes };
}

export function buildSignal(i: SignalInput): SignalResult {
  if (i.excluded)
    return {
      signal: "hodl",
      score: 0,
      techScore: null,
      fundScore: null,
      tech: [],
      fund: [],
      portfolio: [{ text: "Fora das metas: é um aporte da empresa e não pode ser movido", tone: "neutral" }],
      headline: "Não pode ser movido: manter",
    };
  if (FIXED.includes(i.cls))
    return {
      signal: "hodl",
      score: 0,
      techScore: null,
      fundScore: null,
      tech: [],
      fund: [{ text: "Renda fixa: a rentabilidade é definida na compra; vender antes do vencimento pode custar caro", tone: "neutral" }],
      portfolio: classNotes(i, []),
      headline: "Renda fixa: manter até o vencimento",
    };

  const alerts: string[] = [];
  const tech = techPart(i.tech, alerts);
  const fund = fundPart(i, alerts);
  const portfolio = classNotes(i, alerts);

  let fit = 0;
  if (i.classGap !== null) {
    if (i.classGap > i.tolerance) fit -= 0.5;
    else if (i.classGap < -i.tolerance) fit += 0.5;
  }
  const score = (tech.score ?? 0) + (fund.score ?? 0) + fit;
  const classOver = i.classGap !== null && i.classGap > i.tolerance;
  const overweight = i.weight !== null && i.weight > i.maxAssetPct;

  let signal: SignalKind;
  let headline: string;
  if (score <= -2) {
    signal = "venta";
    headline = alerts[0] ?? "Técnico e fundamentos contra: avaliar reduzir";
  } else if (alerts.length) {
    signal = "alerta";
    headline = alerts[0];
  } else if (score >= 1.5 && !classOver && !overweight) {
    signal = "compra";
    headline = "Sinais a favor e a classe tem espaço na carteira";
  } else {
    signal = "hodl";
    headline =
      score >= 1.5 && (classOver || overweight)
        ? "Bons sinais, mas já pesa muito na carteira: manter"
        : score <= -1
          ? "Sinais fracos: manter e não aportar por enquanto"
          : "Sem sinais fortes: manter";
  }
  return { signal, score: Math.round(score * 10) / 10, techScore: tech.score, fundScore: fund.score, tech: tech.notes, fund: fund.notes, portfolio, headline };
}

function classNotes(i: SignalInput, alerts: string[]): Note[] {
  const out: Note[] = [];
  if (i.weight !== null && i.weight > i.maxAssetPct) alerts.push(`Concentração: pesa ${num(i.weight)}% do investível (limite ${i.maxAssetPct}%)`);
  if (i.classGap !== null) {
    if (i.classGap > i.tolerance) out.push({ text: `A classe está ${num(i.classGap)} p.p. acima da meta`, tone: "neg" });
    else if (i.classGap < -i.tolerance) out.push({ text: `A classe está ${num(-i.classGap)} p.p. abaixo da meta`, tone: "pos" });
    else out.push({ text: "A classe está dentro da meta", tone: "neutral" });
  }
  return out;
}
