# Patrimonio — dashboard personal de inversiones (BRL)

App web mobile-first para ver el patrimonio valuado en reales con precios del día: total, variación diaria, evolución, distribución por clase, mapa de calor, tablas por clase, proventos de la semana y alertas de concentración y desvío.

- **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind 4 + Recharts + SWR. Tests con Vitest.
- **Sin base de datos**: las posiciones viven en [`data/portfolio.json`](data/portfolio.json) y los objetivos en [`data/targets.json`](data/targets.json). El código no tiene activos hardcodeados.
- **Fuentes gratuitas, sin scraping**: brapi.dev (B3), CoinGecko (cripto), API SGS del Banco Central (CDI, Selic, IPCA, dólar PTAX) y el CSV de datos abiertos de Tesouro Transparente (Tesouro Direto).

## Correrla localmente

```bash
npm install
cp .env.example .env.local   # completá BRAPI_TOKEN
npm run dev                  # http://localhost:3000
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Tests de valuación, alertas, proventos y adaptadores |
| `npm run typecheck` | Chequeo de tipos |
| `npm run build && npm start` | Build y servidor de producción |
| `npm run snapshot` | Genera el snapshot del día en `data/` (lo mismo que hace el Action) |
| `npm run import:b3` | Importa los extractos de B3 de `data/b3/` a `data/proventos-recebidos.json` |
| `npx tsx scripts/check-providers.ts` | Diagnóstico: consulta todas las fuentes e imprime precios y errores |

> Detrás de un proxy corporativo, Node no usa `HTTPS_PROXY` por defecto: anteponé `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).

## Claves de API

Van en `.env.local` (local), en las variables de entorno de Vercel (producción) y en los *secrets* del repo (GitHub Action). Nunca en el código.

| Variable | Obligatoria | Cómo obtenerla |
|---|---|---|
| `BRAPI_TOKEN` | Sí | Creá una cuenta en [brapi.dev](https://brapi.dev/dashboard) → *API Keys*. Sin token sólo cotizan unos pocos tickers de prueba (PETR4, VALE3…). Se envía como `Authorization: Bearer`. |
| `COINGECKO_API_KEY` | No | Clave "Demo" gratuita en [coingecko.com/en/api](https://www.coingecko.com/en/api/pricing). Sin clave funciona, pero con límite de requests más bajo. |
| `QUOTES_REVALIDATE_SECONDS` | No | Caché de cotizaciones (3600–21600). Default 3600 (1 h). |
| `SLOW_REVALIDATE_SECONDS` | No | Caché de BCB, Tesouro y proventos. Default 21600 (6 h). |
| `BRAPI_BATCH_SIZE` | No | Tickers por request a brapi. Default 1 (límite del plan gratuito); con plan pago, hasta 10. Si un lote falla se reintenta de a uno. |

BCB y Tesouro Transparente no requieren clave.

## Desplegar en Vercel

1. Importá el repo en [vercel.com/new](https://vercel.com/new) (framework: Next.js, sin cambios de build).
2. En *Settings → Environment Variables* cargá `BRAPI_TOKEN` (y opcionalmente `COINGECKO_API_KEY`).
3. Deploy. Abrí la URL desde el celular y agregala a la pantalla de inicio.

**Snapshot diario (GitHub Action)**: en el repo, *Settings → Secrets and variables → Actions*, creá `BRAPI_TOKEN` (y `COINGECKO_API_KEY` si la tenés). El workflow [`daily-snapshot.yml`](.github/workflows/daily-snapshot.yml) corre todos los días a las 18:40 de São Paulo (también se puede lanzar a mano desde *Actions → Snapshot diario → Run workflow*). Commitea `data/snapshots/` y `data/history.json`; ese commit dispara un redeploy en Vercel, así la app ve el historial nuevo.

> Si el repo es privado y no querés que tu patrimonio sea visible, mantenelo privado: los snapshots incluyen valores. Para proteger la URL, usá *Vercel Authentication* (Settings → Deployment Protection).

**Cloudflare**: es posible con [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), pero no está probado en este repo. Las rutas leen `data/` con `fs` y el CSV del Tesouro se procesa en streaming (~15 MB), así que Vercel es el destino recomendado.

## Cómo funciona

```
data/                     portfolio.json · targets.json · history.json · snapshots/{fecha}.json · snapshots/latest.json
src/providers/            un adaptador por fuente, misma interfaz (PriceProvider)
  brapi.ts                acciones, FIIs, ETFs + proventos
  coingecko.ts            cripto en BRL
  bcb.ts                  indicadores (CDI, Selic, IPCA, PTAX) + devengo CDI para CDB
  tesouro.ts              PU base de Tesouro Direto (CSV oficial, D-1)
  manual.ts               valores manuales (previdencia, FGTS)
  index.ts                registro y ruteo activo → proveedor
src/lib/
  valuation.ts            lógica pura: cantidad × precio, totales, variaciones, pesos, devengo CDI
  alerts.ts               concentración y desvío contra targets.json
  dividends.ts            proventos de un período × cantidades
  portfolio-service.ts    orquesta proveedores + fallback al último snapshot
src/app/api/              portfolio · history · dividends · alerts · refresh
src/app/                  Resumen (/) · /activos · /proventos · /alertas
scripts/snapshot.ts       snapshot diario
tests/                    Vitest
```

**Caché y frescura.** Las rutas API corren en cada request, pero las llamadas a las fuentes usan la Data Cache de Next: cotizaciones 1 h, BCB/Tesouro/proventos 6 h. El botón **Actualizar** invalida las cotizaciones de mercado (`revalidateTag("quotes")`, máx. 1 vez por minuto); BCB y Tesouro publican una vez por día y vencen sólo por tiempo. En el navegador se guarda la última respuesta para mostrarla al instante mientras carga la nueva.

**Si una fuente falla** se usa la cotización del último snapshot con su fecha original y la UI muestra "Última cotización del DD/MM". Si tampoco hay snapshot, el activo queda **sin cotización** y fuera del total (se avisa en pantalla). Nunca se inventan precios. Los valores manuales se marcan como "Manual".

**Cambiar de proveedor**: implementá `PriceProvider` (`id`, `supports(asset)`, `getQuotes(assets)`) en `src/providers/` y registralo en `providers/index.ts`. Nada más cambia.

## Editar posiciones

Cada activo en `data/portfolio.json` tiene `ticker`, `class` (`acciones` · `fiis` · `etfs` · `cripto` · `tesouro` · `renta_fija` · `fondos` · `otros`), `quantity` y `avg_price` (precio medio, para calcular invertido, ganancia y rentabilidad), más campos opcionales (ver [`portfolio.schema.json`](data/portfolio.schema.json)):

- **B3**: sólo ticker, clase y cantidad.
- **Cripto**: `provider_id` = id de CoinGecko (p.ej. `avalanche-2`).
- **Tesouro**: `"provider": "tesouro"`, `"provider_id": "Tesouro IPCA+;15/05/2029"` (tipo y vencimiento como en el CSV oficial), `quantity` = cantidad de títulos.
- **CDB / posfijado**: `"provider": "cdi"`, `cdi_percent`, `manual_value` y `manual_date`. El valor se devenga con el CDI diario del BCB desde esa fecha (bruto, sin IR). Al conciliar con el extracto, actualizá ambos campos.
- **Sin cotización** (previdencia, FGTS): `"provider": "manual"`, `manual_value`, `manual_date`.

`data/targets.json` define los límites de concentración (`max_asset_pct`, `max_class_pct`), la asignación objetivo por clase, la tolerancia en puntos porcentuales y los activos excluidos del cálculo de asignación (p.ej. FGTS).

## Proventos recibidos (extracto de B3)

B3 no ofrece una API abierta para personas, pero permite descargar el extracto de **Movimentação** (Área do Investidor → Extratos → Movimentação → Excel). Subí ese `.xlsx` a la carpeta del titular en [`data/b3/`](data/b3/) (`mi-cuenta/`, `esposa/`; la app las muestra consolidadas, la separación evita descartar como duplicado un mismo pago recibido en ambas cuentas) y el workflow [`import-b3.yml`](.github/workflows/import-b3.yml) genera `data/proventos-recebidos.json`. La pestaña **Proventos → Recibidos** muestra el acumulado (12 meses, año, histórico), separado en dividendos, JCP y rendimientos, por mes y por activo. Podés subir extractos superpuestos: los pagos repetidos se cuentan una sola vez. Localmente: `npm run import:b3`.

## Limitaciones conocidas

- La variación diaria de cripto es la de las últimas 24 h (CoinGecko). En B3, fuera del horario de mercado se muestra la del último pregão.
- Tesouro Transparente publica con un día de atraso (D-1): se ve la fecha en la tabla.
- Los proventos dependen de que el plan de brapi incluya el módulo de dividendos. El monto es bruto y usa tu cantidad actual.
- El historial arranca con el primer snapshot del Action. Los días con activos sin cotización quedan marcados con `missing` en `history.json`.
