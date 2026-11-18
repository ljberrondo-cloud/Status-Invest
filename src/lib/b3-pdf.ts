/**
 * Lector del PDF "Extrato de Movimentação" de la Área do Investidor de B3.
 * Recibe los textos de cada página con su posición (x, y en puntos PDF) y reconstruye las filas
 * con los mismos encabezados que el Excel, para pasarlas a parseMovimentacaoRows.
 *
 * Estructura del PDF: un título por día ("13 de novembro de 2026"), debajo una tabla con encabezado
 * Movimentação | Produto | Instituição | Quantidade | Preço Unitário | Valor da Operação.
 * Las celdas pueden ocupar varias líneas y las columnas cambian de posición en cada tabla.
 */
export interface PdfItem {
  x: number;
  y: number;
  str: string;
}

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "13 de novembro de 2026" → "13/11/2026" */
export function parsePtDate(s: string): string | null {
  const m = norm(s).match(/^(\d{1,2}) de ([a-z]+) de (\d{4})$/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[1].padStart(2, "0")}/${String(MONTHS[m[2]]).padStart(2, "0")}/${m[3]}`;
}

interface Columns {
  produto: number;
  instituicao: number;
  quantidade: number;
  preco: number;
  valor: number;
  headerY: number;
}

/** Busca un encabezado de tabla en las líneas cercanas a "Movimentação". */
function findColumns(items: PdfItem[], anchor: PdfItem): Columns | null {
  const near = items.filter((i) => Math.abs(i.y - anchor.y) <= 8);
  const at = (re: RegExp) => near.find((i) => re.test(norm(i.str)))?.x;
  const produto = at(/^produto$/);
  const instituicao = at(/^instituicao$/);
  const quantidade = at(/^quantidade$/);
  const preco = at(/^unitario$/) ?? at(/^preco/);
  const valor = at(/^operacao$/) ?? at(/^valor da/);
  if ([produto, instituicao, quantidade, preco, valor].some((v) => v === undefined)) return null;
  return { produto: produto!, instituicao: instituicao!, quantidade: quantidade!, preco: preco!, valor: valor!, headerY: Math.min(...near.map((i) => i.y)) };
}

const ROW_GAP = 15; // separación vertical mínima entre filas (las líneas de una misma fila están a ~10)
const IGNORE = /^(acesse|extrato de movimentacao$|\d+\/\d+$)/;

function joinCell(items: PdfItem[]): string {
  return items
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.str.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convierte las páginas del PDF en filas { Data, Movimentação, Produto, ... }. */
export function parseB3PdfPages(pages: PdfItem[][]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  let date: string | null = null;
  let cols: Columns | null = null;

  for (const page of pages) {
    const items = page.filter((i) => i.str.trim() && !IGNORE.test(norm(i.str))).sort((a, b) => b.y - a.y || a.x - b.x);
    // Agrupar en "bloques": títulos de fecha, encabezados y filas de datos, de arriba hacia abajo.
    let current: PdfItem[] = [];
    const flush = () => {
      if (!current.length || !cols || !date) {
        current = [];
        return;
      }
      const c = cols;
      const cell = (from: number, to: number) => joinCell(current.filter((i) => i.x >= from - 3 && i.x < to - 3));
      const numeric = current.filter((i) => i.x >= c.quantidade - 25);
      const valor = joinCell(numeric.filter((i) => i.x >= c.valor - 12));
      const preco = joinCell(numeric.filter((i) => i.x >= c.preco - 12 && i.x < c.valor - 12));
      const qtd = joinCell(numeric.filter((i) => i.x < c.preco - 12));
      const mov = cell(0, c.produto);
      if (mov) {
        rows.push({
          Data: date,
          "Movimentação": mov,
          Produto: cell(c.produto, c.instituicao),
          "Instituição": cell(c.instituicao, c.quantidade - 25),
          Quantidade: qtd.replace(/\./g, "").replace(",", "."),
          "Preço unitário": preco,
          "Valor da Operação": valor,
        });
      }
      current = [];
    };

    let lastY = Infinity;
    for (const it of items) {
      const d = parsePtDate(it.str);
      if (d) {
        flush();
        date = d;
        cols = null;
        lastY = it.y;
        continue;
      }
      if (norm(it.str) === "movimentacao") {
        const found = findColumns(items, it);
        if (found) {
          flush();
          cols = found;
          lastY = found.headerY;
          continue;
        }
      }
      if (!cols || it.y >= cols.headerY - 2) continue; // todavía en el encabezado
      if (lastY - it.y > ROW_GAP && current.length) flush();
      current.push(it);
      lastY = Math.min(lastY, it.y);
    }
    flush();
  }
  return rows;
}
