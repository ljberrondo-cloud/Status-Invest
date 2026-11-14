import { promises as fs } from "node:fs";
import path from "node:path";
import type { HistoryPoint, Portfolio, Snapshot, Targets } from "./types";

/**
 * Ruta a un archivo de data/. El path queda acotado a data/ para que el bundler
 * sólo incluya esa carpeta. PORTFOLIO_DATA_DIR es un override para pruebas del script.
 */
function dataPath(file: string) {
  const override = process.env.PORTFOLIO_DATA_DIR;
  return override ? path.join(/*turbopackIgnore: true*/ override, file) : path.join(process.cwd(), "data", file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(dataPath(file), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function loadPortfolio(): Promise<Portfolio> {
  const p = await readJson<Portfolio>("portfolio.json");
  if (!p?.assets?.length) throw new Error("data/portfolio.json no existe o no tiene activos");
  return p;
}

export async function loadTargets(): Promise<Targets | null> {
  return readJson<Targets>("targets.json");
}

export async function loadLatestSnapshot(): Promise<Snapshot | null> {
  return readJson<Snapshot>("snapshots/latest.json");
}

export async function loadHistory(): Promise<HistoryPoint[]> {
  return (await readJson<HistoryPoint[]>("history.json")) ?? [];
}

export async function writeJson(file: string, data: unknown) {
  const full = dataPath(file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(data, null, 2) + "\n");
}
