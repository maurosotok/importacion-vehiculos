# Lectura de Carros.xlsx y decisiones sobre fórmulas

Se inspeccionaron las nueve hojas del archivo original con sus fórmulas y valores almacenados.
El archivo no fue modificado. Este documento describe el alcance leido, no certifica todos los
importes históricos ni recalcula el libro completo. Los valores en cache se contrastaron con
aritmetica independiente para el caso 104.

## Hojas y destino

| Hoja original | Destino en la aplicación | Carga inicial |
|---|---|---|
| Quotes | Vehículos / Cotizaciones | Estructura y reglas; ninguna operación antigua. |
| Grúas | Configuración / Tarifas de grúa | 282 filas del catálogo, con procedencia y notas. |
| Cotización Piezas | Repuestos / Comparador | Encabezados de 45 proveedores; no precios/ofertas antiguas. |
| Cotización grúas | Comparador de navieras dentro del vehículo | Nombres de cuatro navieras; no viajes anteriores. |
| Purchases | Vehículos / Compras | Campos y relaciones; sin registros antiguos. |
| Spare Parts Purchases | Gastos de compras propias | Estructura; sin gastos antiguos. |
| Market Research | Vehículos / Mercado | Estructura; sin observaciones antiguas. |
| Final Prices | Vehículos / Precios objetivo | Estructura; sin precios antiguos. |
| Bank Statement | Excluida | No desarrollar ni importar el estado bancario. |

Los nombres exactos con acentos y sus columnas estan en `data/estructura_excel.json`.
La transcripcion hablaba de otras hojas auxiliares; el archivo adjunto contiene estas nueve.
No crear módulos de hojas que no estan en el alcance.

## Caso ID104: la fila real es 101
El número 104 esta en `Quotes!A101`; no corresponde a la fila 104 del libro.
VIN `5J6RE4H39BL018538`, Honda CR-V LX, 2011, Richmond (VA), fecha 15-10-2026.

### Entradas verificadas
| Celdas | Concepto | Valor |
|---|---|---:|
| H101 | Grúa USD | 270 |
| I101 | Barco USD | 1020 |
| J101 | Puja USD | 2200 |
| K101 | Carro + fees USD | 2995 |
| L101 = K101-J101 | Fees USD | 795 |
| M101 | Papelería USD | 15 |
| O101 | HNL por USD | 27.0288 |
| U101 | Total manual de salida HNL | 50297.89 |
| X101 | Reparación presupuestada HNL | 20000 |
| AB101 | Precio de venta esperado HNL | 220000 |

### Dos diferencias confirmadas, no correcciones ocultas
`V101 = SUM(H101:N101)` incluye J101, L101 y también K101, que ya contiene J101+L101.
Por tanto repite US$2995. El resultado mostrado US$9155.90 no es el costo coherente con sumar
cada concepto una vez. El equivalente correcto con papelería es US$6160.90.

`W101 = SUM(Q101:U101)` omite P101, la papelería de L405.432. El original arroja L166116.298.
Incluir esa papelería una sola vez produce L166521.730. El efecto llega al total con reparación
y a la utilidad, no al impuesto manual.

| Resultado | Original guardado en Excel | Propuesto para el nuevo motor |
|---|---:|---:|
| Costo importado USD equivalente | 9155.90 | 6160.90 |
| Costo importado HNL | 166116.298 | 166521.730 |
| Con reparación HNL | 186116.298 | 186521.730 |
| Utilidad estimada HNL | 33883.702 | 33478.270 |

La diferencia HNL es exactamente US$15 x 27.0288 = L405.432. Se preservan los originales en
`data/fixtures/caso_104.json`. El fixture no se importa a producción. La política explícita del
nuevo motor es sumar costos una sola vez e incluir papelería. No alterar el libro para ocultar
la diferencia ni fingir que los totales nuevos son los que tenia el archivo.

No descomponer U101 en impuestos/gastos locales por inferencia. No agregar L10000 o L20000 a
ese valor. Los fees US$795 son históricos/manuales dentro del caso, no una regla actual de IAA.

## Mapeo completo de Quotes
| Columna | Encabezado original | Campo propuesto | Tratamiento |
|---|---|---|---|
| A | ID | `display_id` | Identificador de referencia. No es el número fisico de fila ni una clave de VIN. |
| B | Marca | `vehicle.make` | Dato manual o completado por VIN, editable. |
| C | Modelo | `vehicle.model_text / trim` | Conservar texto original y permitir separar versión sin exigirlo. |
| D | Año | `vehicle.year` | Manual/autocompletado, no regla fiscal. |
| E | VIN | `vehicle.vin` | Trim/mayusculas; historiales y revisiones; no requisito para borrador. |
| F | Fecha | `quote.business_date` | Fecha de negocio America/Tegucigalpa. |
| G | Location | `location_label / location_id` | Subasta/sede/sublote o texto manual. |
| H | Grúa ($) | `towing_usd` | Referencia o importe manual. |
| I | Embarque ($) | `ocean_usd` | Referencia por tipo sencillo/puerto o manual. |
| J | Carro ($) | `bid_usd` | Puja deseada, no suma con K de nuevo. |
| K | Total (Carro + Fee) | `car_plus_fees_usd` | Subtotal derivado. Puede capturarse en modo alterno, no sumando adicional. |
| L | Buyer Fee | `auction_fees_total_usd` | En este flujo es el total adicional de subasta. Separar desglose si hay fuente. |
| M | Papelería ($) | `paperwork_usd` | Gasto independiente que debe incluirse una vez. |
| N | Impuestos ($) | `landing_usd_equivalent` | Derivado del total HNL, no segundo cargo. |
| O | Cambio dólar | `fx_hnl_per_usd` | Factor HNL por USD, no vigente por defecto. |
| P | Papelería | `paperwork_hnl` | Derivado de M x O; incluido en nuevo total. |
| Q | Grúa | `towing_hnl` | Derivado de H x O. |
| R | Embarque | `ocean_hnl` | Derivado de I x O. |
| S | Carro | `bid_hnl` | Derivado de J x O. |
| T | Buyer Fee2 | `auction_fees_hnl` | Derivado de L x O, no doble fee. |
| U | Impuestos | `manual_landing_total_hnl` | En el ejemplo es total manual de salida. No inventar desglose. |
| V | Total $ | `import_cost_usd_equivalent` | Fórmula nueva documentada, no SUM(H:N). |
| W | Total Lps | `import_cost_hnl` | Fórmula nueva incluye papelería, no SUM(Q:U). |
| X | Gastos calculados (repuestos) | `repair_budget_hnl` | Presupuesto, no gasto real. |
| Y | Dia subasta | `auction_date` | Opcional. |
| Z | Verified in bidcars | `history_check_notes` | Texto/estado y enlace opcional; no automatizar consulta. |
| AA | Total + Gastos Calculados | `investment_with_repair_hnl` | Costo importado + presupuesto. |
| AB | Mean de venta | `expected_sale_price_hnl` | Media sugerida o precio manual. |
| AC | Ganancia | `expected_profit_hnl` | Precio objetivo menos inversión prevista. |
| AD | Seller | `seller_name` | Texto opcional, no inventar aseguradora. |
| AE | Not won, why? | `not_won_reason` | Opcional. |
| AF | Max Bid set | `manual_max_bid / max_bid_set` | Campo manual; no optimizador fiscal. |


## Resto de las hojas: columnas conservadas
Las columnas duplicadas por conversión USD/HNL pasan a ser proyecciones calculadas de un mismo
concepto. Se conserva la vista legible, no un esquema fisico con columnas repetidas por cada
proveedor. Esto evita doble conteo y migraciones cada vez que agregas un negocio.

### `Gruas`
C: Punto de embarque | D: Estado | E: Ciudad | F: Price | G: Nieva

### `Cotización Piezas`
A: Marca | B: Modelo | C: Año | D: Pieza | E: Suyapa AutoPartes | F: Inmecro | G: Autos Import Repuestos | H: Prime AutoPartes | I: Parillas One | J: Glass Depot | K: Leos Wheels - 8888-1511 | L: Carbono AutoParts 3156-0796 | M: Center New Parts 9251-1274 | N: City New Parts 9581-7815 | O: Honda Parts - 3376-7433 | P: Revaparts - 3389 - 2655 | Q: Inversiones Peña Gomez | R: Reconcos Autoparts - 9669-9141 | S: Dominican Yonker | T: Remo Partes | U: Yonker Renacer | V: Yonker el Triangulo | W: Yonker Dubon 3294-4253 | X: Yonker Invercan 3351-4252 | Y: Yonker Motores 9655-0821 | Z: Yonker Cortes 9842-5070 | AA: Yonker Alex 3232-9355 | AB: Yonker Mafer 3300-8030 | AC: Yonker Caballero - 3259-4380 | AD: Yonker Deras - 9949-7237 | AE: Yonker Dubon 2 - 9802-6955 | AF: Yonker Reconco Motors - 3326-3750 | AG: Manix Yonker 3398-3932 | AH: Yonker Pastrana - 9868-2264 | AI: Yonker Reconco 9619-8192 | AJ: Yonker Josue 9890-2116 | AK: Yonker  Macam 9767-9131 | AL: Yonker Costa - 9438-7066 | AM: Racing AutoParts 9231-8900 | AN: Maxi Yonker 3279-9650 | AO: Kike Llantas 8900-7250 | AP: Yonker Miami 9628-3872 | AQ: Yonker Parmenas | AR: Yonker Sinai - 9690-6501 | AS: Yonker Ferreauto 9603-8249 | AT: Yonker Arnold - 3364-5597 | AU: Yonker El Suave - 9622-8636 | AV: Yonker Lopez - 8930-3270 | AW: Yonker Revaparts 3384-6518

### `Cotizacion gruas`
A: Naviera | B: Marca | C: Modelo | D: Ubicación | E: VIN | F: Grúa | G: Barco | H: Papelería | I: Total

### `Purchases`
A: ID | B: Marca | C: Modelo | D: Año | E: VIN | F: Fecha | G: Location | H: Grúa ($) | I: Embarque ($) | J: Papelería ($) | K: Carro ($) | L: Buyer Fee | M: BAC Fees / BP Fees ($) | N: Paypal Fees | O: Fee of bank receiver | P: Impuestos ($) | Q: Cambio dólar | R: Grúa (Lps) | S: Embarque (Lps) | T: Papelería (Lps) | U: Carro (Lps) | V: Buyer Fee (Lps) | W: BAC Fees/BP Fees (Lps)  | X: Paypal Fees (Lps) | Y: Fee of bank receiver (Lps) | Z: Impuestos | AA: Total $ | AB: Repuestos | AC: Total Sin Repuestos | AD: Total Lps | AE: Date received | AF: Vendido a | AG: Ganancia | AH: Date sold

### `Spare Parts Purchases`
A: ID | B: Marca | C: Modelo | D: Año | E: VIN | F: Fecha de compra | G: Fecha pagado | H: Repuesto | I: Lugar | J: Total

### `Market Research`
A: Marca | B: Modelo | C: Año | D: Precio | E: Motor | F: Tracción | G: Millas | H: Fecha consultado | I: Link | J: Recién ingreso

### `Final Prices`
A: Marca | B: Modelo | C: Año | D: Precio | E: Fecha


## Particularidades que no deben perderse
**Compras:** BAC/BP, PayPal y banco receptor son gastos distintos. `Purchases!AB3` agrega
repuestos con `SUMIF` por VIN, por lo que la relación compra-gastos debe existir de verdad.
`Purchases!AG5` usa una mitad del costo y `M3:O4` muestran comisiones divididas entre dos;
conservar posibilidad de importe/cuota manual sin interpretar una sociedad ni regla global.

**Repuestos:** el libro incluye gastos como gasolina y aceite además de piezas. Fecha de
compra y fecha pagado son campos diferentes; registrarlos no genera dos costos.
Las columnas de proveedores incluyen números y texto "No". Un "No" significa ausencia de
oferta/disponibilidad, no precio cero. No importar ofertas viejas como inventario o precios vigentes.

**Grúas:** hay 282 filas en `Gruas!C3:G284`; 41 contienen "Se cotiza" con precio 0.
En los JSON el importe de esas filas es null y se conserva el cero original como evidencia.
Hay texto duplicado y clasificaciones de estado a revisar. Por ejemplo, las primeras filas
mencionan Denver y conservan ARIZONA en la columna D. No corregir geografia silenciosamente;
conservar fuente y resolver en reconciliación con PDF/proveedor sin impedir captura manual.

**Navieras:** los nombres del Excel son North Atlantic, Carusa, JL y Matus. La transcripcion
contiene nombres mal reconocidos. Se conservan estos nombres del archivo. Algunos gastos de
papelería estan vacios y otros son cero: no son equivalentes. Los valores se guardan solo como
referencia para elegir un predeterminado, no como ofertas históricas activas.

**Mercado:** `Market Research` no tiene una columna de ubicación; esa se propone como opcional
por la transcripcion. `Recien ingreso` se conserva. `Final Prices` tiene fecha propia y se
mantiene como precio objetivo editable, no precio de venta realizada.

## Privacidad y límites de la extracción
El original contiene información bancaria. Se incluye solo en `fuentes_privadas/` y esta ruta
queda ignorada por Git. No copiar hojas ni celdas fuera del alcance a seed, logs, public o dist.
El script de verificación del paquete usa solo catálogos y el caso expresamente aportado por el
usuario. La aplicación futura debe importar catálogos con un usuario autorizado y sin importar
las operaciones del ejemplo. No se público ningun dato en servicios externos.
