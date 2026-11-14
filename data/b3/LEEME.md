# Extractos de B3

Una subcarpeta por titular: `mi-cuenta/` y `esposa/` (el nombre de la carpeta es el que se ve en la app; podés renombrarlas o agregar otras).

1. Área do Investidor de B3 → **Extratos** → **Movimentação**.
2. Elegí el período y descargá el Excel.
3. Subilo a la carpeta del titular (en GitHub: entrá a la carpeta → *Add file → Upload files*).

El GitHub Action "Importar proventos B3" procesa todos los archivos y actualiza `data/proventos-recebidos.json`.
Podés subir extractos superpuestos del mismo titular: los pagos repetidos se cuentan una sola vez.
