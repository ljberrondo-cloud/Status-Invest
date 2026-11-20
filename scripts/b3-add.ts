/**
 * Convierte archivos de B3 (extracto de Movimentação PDF/Excel o relatório consolidado) al formato
 * que guarda el botón "Subir extracto": data/b3/<cuenta>/<período>-<hash>.json, sólo proventos.
 *
 * Uso: npm run b3:add -- <cuenta> <archivo> [<archivo>...]     (cuenta: conta-1 | conta-2)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { ACCOUNTS } from "../src/lib/accounts";
import { buildPositionRecord, buildUploadRecord, parseExtract } from "../src/lib/b3-upload";

async function main() {
  const [accountId, ...files] = process.argv.slice(2);
  const account = ACCOUNTS.find((a) => a.id === accountId);
  if (!account || !files.length) {
    console.error(`Uso: npm run b3:add -- <${ACCOUNTS.map((a) => a.id).join("|")}> <archivo>...`);
    process.exit(1);
  }
  for (const f of files) {
    const buf = await fs.readFile(f);
    const parsed = await parseExtract(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, path.basename(f));
    if (parsed.positions) {
      const pr = buildPositionRecord(parsed.positions, account.id);
      await fs.mkdir(path.dirname(path.join(process.cwd(), pr.path)), { recursive: true });
      await fs.writeFile(path.join(process.cwd(), pr.path), pr.content);
      console.log(`${path.basename(f)}: posiciones al ${parsed.positions.asOf} (${parsed.positions.positions.length} activos) → ${pr.path}`);
    }
    if (!parsed.payments.length) {
      console.log(`${path.basename(f)}: sin proventos (${parsed.kind}, ${parsed.rowsRead} filas)`);
      continue;
    }
    const rec = await buildUploadRecord(parsed, account.id, account.label);
    const out = path.join(process.cwd(), rec.path);
    await fs.mkdir(path.dirname(out), { recursive: true });
    const exists = await fs.stat(out).then(() => true, () => false);
    if (!exists) await fs.writeFile(out, rec.content);
    console.log(`${path.basename(f)}: ${parsed.kind}, ${rec.payments.length} proventos, R$ ${rec.total.toFixed(2)} → ${rec.path}${exists ? " (ya existía)" : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
