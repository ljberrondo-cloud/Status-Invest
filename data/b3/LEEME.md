# Extractos de B3

Una subcarpeta por cuenta: `conta-1/` y `conta-2/`. En la app se muestran siempre juntas; las carpetas separadas sólo sirven para que un mismo pago recibido en las dos cuentas no se cuente como repetido.

Lo más simple: en la app, **Proventos → Subir extracto de B3**. Acepta:
- Extrato de **Movimentação** (PDF o Excel).
- **Relatório consolidado** mensal (pagos con fecha) o anual (sólo totales del año).

Se guarda sólo un `.json` con los proventos (sin datos personales). A mano: `npm run b3:add -- <cuenta> <archivos>`.

El GitHub Action "Importar proventos B3" procesa todos los archivos y actualiza `data/proventos-recebidos.json`.
Podés subir extractos superpuestos del mismo titular: los pagos repetidos se cuentan una sola vez.
