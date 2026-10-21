# Reconciliación de tarifas: embarques y grúas

Estado: parcial. Los embarques quedan conciliados. La conciliación de grúas es estructural y por conteo; la comparación fila por fila contra el PDF no está terminada y no debe presentarse como extracción limpia.

Fuentes privadas (no versionadas, en `fuentes_privadas/`):
- `embarques_honduras_2025.pdf` (4 páginas).
- `gruas_north_atlantic.pdf` (tarifario de grúas, 16 páginas con capa de texto).
- `Carros.xlsx` (origen de los registros de prueba).

Ninguna referencia canadiense ni calculadora de terceros se usó como fuente.

## Corrección 2026-10-21: nueve importes de grúa tomados del PDF

Decisión del usuario: el PDF North Atlantic es la fuente de estos importes. Se reemplazan los nueve
importes del Excel; el anterior queda en `raw_price` (y en `monto_usd_anterior` tras la migración
`20261021000100`). La página es la del PDF `gruas_north_atlantic.pdf`.

| ID | Zona | Etiqueta | Origen | Excel (anterior) | PDF (nuevo) | Página |
|---|---|---|---|---|---|---|
| NA-XLSX-GRUAS-0056 | DELAWARE | Central New Jersey - IAA | NEW JERSEY | 165 | 275 | 4 |
| NA-XLSX-GRUAS-0078 | FLORIDA | Orlando - Copart - IAA | FLORIDA | 200 | 225 | 7 |
| NA-XLSX-GRUAS-0079 | FLORIDA | Orlando North & South - Copart - IAA | FLORIDA | 200 | 210 | 7 |
| NA-XLSX-GRUAS-0089 | FLORIDA | Tampa IAA | FLORIDA | 220 | 225 | 7 |
| NA-XLSX-GRUAS-0093 | FLORIDA | Orlando IAA - Sublot Boggy Greek | FLORIDA | 225 | 350 | 7 |
| NA-XLSX-GRUAS-0095 | FLORIDA | Tampa North IAA | FLORIDA | 225 | 265 | 7 |
| NA-XLSX-GRUAS-0101 | FLORIDA | Tampa US41 IAA | FLORIDA | 250 | 200 | 7 |
| NA-XLSX-GRUAS-0121 | DELAWARE | Richmond - Copart - IAA | VIRGINIA | 270 | 325 | 6 |
| NA-XLSX-GRUAS-0165 | DELAWARE | Richmond Doswell - IAA | VIRGINIA | 350 | 500 | 6 |

- Orlando Manheim (`NA-XLSX-GRUAS-0086`) no cambia.
- Richmond Doswell: el origen VIRGINIA viene del Excel; no se verificó en el PDF.
- Cotizaciones guardadas no cambian: guardan `grua_usd` y `grua_referencia_clave`.
- Nashville (`NA-XLSX-GRUAS-0238`): "Nashville Copart - IAA", zona FLORIDA, origen TENNESSEE, US$500.
  El PDF no muestra precio para esa línea en la capa de texto. El importe viene de la confirmación
  explícita del usuario el 2026-10-21 (válida para Nashville, TN, en IAA y COPART). Conviene revisar
  visualmente la página 9.
- Alias: `alias_sedes` = NASHVILLE / TN / subastas IAA y COPART / fuente `confirmacion_usuario_2026-10-21`.
  Sin subasta definida, la sede queda pendiente; otros estados (TX, KY) no confirman Nashville.

## Embarques (30 tarifas)

- Catálogo: `data/catalogos/embarques_referencia_2025.json`, 30 filas.
- Verificación: los 30 montos coinciden con las páginas 1–4 del PDF, revisadas visualmente.
- Pendiente: `current_provider_confirmation` es `false` en todas las filas. Son referencias de trabajo, no confirmación vigente de la naviera.

## Grúas (282 filas; nueve importes corregidos al PDF el 2026-10-21)

Catálogo: `data/catalogos/gruas_desde_excel.json`.

| Zona | Con importe (`usable_reference`) | Sin importe (`manual_quote`) | Total |
|---|---|---|---|
| Delaware | 87 | 5 | 92 |
| Florida | 80 | 16 | 96 |
| Texas | 40 | 5 | 45 |
| California | 30 | 19 | 49 |
| **Total** | **237** | **45** | **282** |

- Montos distintos: 71 valores entre USD 75 y USD 1,070.
- Sin importe: 41 filas marcadas por la fuente como "Se cotiza" y 4 filas con cero no confirmado (`zero_not_confirmed_free`). "Se cotiza" significa cotización pendiente, no cero.
- Identificadores únicos: 282.

### Conteos del PDF (texto extraído con `pdftotext -layout`)

- Apariciones de "Se cotiza" en el texto extraído: 58. No coincide con las 45 filas sin importe. La extracción de columnas múltiples agrupa encabezados de estado, filas de Hawái/Alaska y textos repetidos, así que el conteo no es un 1:1 fiable.
- Importes en formato `$x.00`: 354. Incluyen precios de encabezado por estado (por ejemplo, un precio general para todo Connecticut) que no son filas de ciudad. Por eso tampoco es comparable con las 237 filas con importe.

## Discrepancias y puntos a revisar

1. **Fila 29 (`NA-XLSX-GRUAS-0029`, Delaware, Pittsburgh – Manheim (Cranberry Township, PA))**: el catálogo no tiene importe, pero el texto del PDF muestra `$350.00` junto a esa etiqueta. Se deja sin importe hasta confirmar visualmente la página.
2. **Filas 30 y 32 (`...-0030`, `...-0032`, Texas, "Houston South North & West")**: etiqueta repetida y sin importe. El PDF muestra "Houston South North & West Copart - IAA" con `$250.00` y otra línea con `$425.00` cerca. La asignación es ambigua; se mantienen como cotización manual.
3. **Fila 31 (`...-0031`, Texas, "Copart - IAA")**: etiqueta fragmentaria, sin ciudad. Revisar contra el PDF.
4. **Filas 3–5 (`...-0003`, `...-0004`, `...-0005`, California)**: el origen indicado es ARIZONA, pero las ciudades son Denver, Denver East y Webster Colorado. La zona California es correcta según la columna del PDF; el campo de estado de origen está mal etiquetado. No se corrigió.
5. **Fila 6 (`...-0006`, California, Fontana San Bernardino)**: origen indicado CALIFORNIA, revisar.
6. **Filas 18–25 y 29**: el origen de estado no coincide con la sección donde aparece el texto en el PDF; revisar geografía antes de usarlas en búsqueda por estado.
7. **Duplicado "Webster Colorado IAA"**: filas `...-0005` y `...-0044`. Ambas se conservan; no se deduplica automáticamente porque pueden ser subastas distintas.
8. **Texto repetido**: 190 filas tienen la nota `possible_repeated_text`. La etiqueta de origen contiene la ciudad duplicada (por ejemplo, "Denver Copart - IAADenver Copart - IAA"). El nombre visible debe limpiarse antes de mostrarlo.
9. **Sublotes con importes distintos**: `resolverGrua` devuelve `ambigua` si una búsqueda coincide con varios importes. Nunca colapsa a un solo precio.

## Pendiente de conciliar

- Comparación fila por fila de las 282 filas contra las páginas de tarifas (Delaware p. 4–6, Florida p. 7–9, Texas p. 10, California p. 11–12).
- Confirmación visual de las discrepancias 1–6.
- Fuentes de Hawái y Alaska: el PDF exige pago anticipado y cancelación del servicio de grúa; no están en el catálogo como tarifas.
