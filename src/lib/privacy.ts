/**
 * Modo privado: oculta montos en reales y cantidades (los porcentajes y precios de mercado quedan).
 * Las funciones de formato leen esta bandera; el AppShell la fija antes de dibujar la página.
 */
let hidden = false;
export const isPrivate = () => hidden;
export function setPrivate(v: boolean) {
  hidden = v;
}
export const MASK = "•••••";
