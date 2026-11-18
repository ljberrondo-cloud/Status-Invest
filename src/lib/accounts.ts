/** Cuentas (carpetas de data/b3/). El nombre visible coincide con el que genera el importador desde la carpeta. */
export const ACCOUNTS = [
  { id: "mi-cuenta", label: "Mi Cuenta" },
  { id: "esposa", label: "Esposa" },
] as const;
export type AccountId = (typeof ACCOUNTS)[number]["id"];
