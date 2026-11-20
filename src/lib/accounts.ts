/**
 * Cuentas (carpetas de data/b3/). El `id` es el nombre de la carpeta y no cambia;
 * `label` es el nombre que se ve en la app y en los proventos importados.
 */
export const ACCOUNTS = [
  { id: "conta-1", label: "Conta 1" },
  { id: "conta-2", label: "Conta 2" },
] as const;
export type AccountId = (typeof ACCOUNTS)[number]["id"];

/** Nombre visible de una carpeta de cuenta (las que no están en ACCOUNTS: "conta-3" → "Conta 3"). */
export function accountLabel(dir: string): string {
  return ACCOUNTS.find((a) => a.id === dir)?.label ?? dir.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
