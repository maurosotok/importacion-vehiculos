# Pruebas de aceptación - deben convertirse en tests y comprobaciones reales

## Experiencia sin bloqueos
| ID | Escenario | Resultado esperado |
|---|---|---|
| UX01 | Tipo SUV + Richmond + puerto Delaware | Usa referencia US$1020 de barco; no pide longitud. |
| UX02 | Seleccionar pickup o modelo de tamaño especial | Referencia de trabajo o importe manual; no modal obligatorio. |
| UX03 | Tarifa 2025 | Se puede usar/guardar sin aceptar advertencia. |
| UX04 | Fila "Se cotiza" | Permite importe manual o pendiente; no convierte a cero. |
| UX05 | Sin VIN / VIN parcial / API fuera de servicio | Editar manual y guardar sigue disponible. |
| UX06 | VIN ya cotizado | Ofrecer historial/revisión sin prohibir nuevo escenario. |
| UX07 | Sin sede conocida pero con grúa/barco manual | Permite calcular y guardar el escenario. |
| UX08 | Campo monetario inválido | Marcar solo el campo, conservar texto; guardar datos válidos como borrador parcial. |
| UX09 | Respuesta VIN tardia | No sobrescribe edición manual ni el VIN de otro escenario. |
| UX10 | Importe de grúa editado manualmente | Cambiar otro campo no lo sustituye; "Volver a tarifa" si lo sustituye. |

## Fees y fiscal manual
| ID | Escenario | Resultado esperado |
|---|---|---|
| F01 | Usuario nuevo | Perfil IAA Standard Volume seleccionado. |
| F02 | Cambio a Copart | Usa perfil de Copart recordado; nunca IAA silenciosamente. |
| F03 | Perfil sin tabla completa | Sigue seleccionable con total manual, sin datos ficticios. |
| F04 | Límites de tramo | Probar justo abajo/en/arriba de cada corte, porcentaje y redondeo. |
| F05 | Base buyer fee + adicionales | No duplicar componentes ni confundir papelería con title handling. |
| F06 | Entrada carro+fees 2995 y puja 2200 | Fee 795; subtotal no sumado otra vez. |
| F07 | Tabla oficial y override manual | Manual prevalece y registra procedencia. |
| F08 | Cambiar puja con fees manuales | Mantiene fee con nota no bloqueante; no deriva fee negativo de total viejo. |
| T01 | Impuestos manuales | Cero requests a SARAH y cero inferencia fiscal por año/motor/origen. |
| T02 | Cambia puja/flete/cambio | Impuesto manual permanece; nota informativa, permite guardar. |
| T03 | Total combinado 50297.89 | Suma una sola vez sin L10000 ni locales adicionales. |
| T04 | Impuesto manual 10000 + locales manuales 21000 | Salida 31000; solo porque se ingresaron por separado. |
| T05 | Sin botón de pago único | El botón se retiró; el importe de impuesto 10000 solo aparece por año ≤ 2010 y nunca sobrescribe un importe capturado. |
| T06 | Cambiar total/desglose | Solo suma el modo activo; no partidas ocultas ni reparto inventado. |
| T07 | Impuesto no ingresado | Subtotal conocido y estado parcial; no "cero impuestos". |

## Dinero y ciclo de compra
| ID | Escenario | Resultado esperado |
|---|---|---|
| M01 | Fixture 104 como entradas manuales | L166521.73 importado, L186521.73 con reparación, L33478.27 utilidad. |
| M02 | Evidencia original fixture | Conserva L166116.298 / L33883.702 separados del resultado nuevo. |
| M03 | Tipo de cambio ausente/cero | No NaN/Infinity ni conversión falsa; borrador guardable. |
| M04 | Versión de tarifa posterior | No cambia revisiones confirmadas anteriores. |
| M05 | Autoguardado fuera de orden / dos pestañas | No pierde datos ni pisa revisión más reciente. |
| P01 | Doble clic marcar comprado | Una compra, conservando revisión de origen. |
| P02 | Presupuesto de reparación | No se registra como gasto real o pagado. |
| P03 | Cotización de pieza convertida a gasto dos veces | Un gasto; conserva oferta. |
| P04 | Gasto compra/pago en fechas distintas | Un costo, dos fechas. |
| P05 | Gasto gasolina/servicio | Disponible como gasto de compra, no requiere SKU de pieza. |
| P06 | Reparto manual de comisión | Suma la parte asignada una vez y conserva referencia del total. |
| P07 | Precio "No" o null en comparador | No gana como oferta más barata. |
| P08 | Precio de venta faltante | Utilidad no se inventa ni se trata como venta a cero. |
| P09 | Media de mercado | Excluye desconocidos, expone criterios y cantidad, manual editable. |

## Correcciones de interfaz y automatización (ronda 2026-10-20)
| ID | Escenario | Resultado esperado |
|---|---|---|
| A01 | Año ≤ 2010 y 2011 o posterior | ≤ 2010: impuesto L10,000 y gastos locales L11,000. 2011+: impuesto vacío y gastos locales L13,557 editable. No se valida cilindrada. |
| A02 | Perfil IAA Standard Volume con puja 2000, 3500, 3750, 4000 | Fees 795, 965, 965, 1000 automáticos; "Carro + Fees" = Puja + Fees efectivos; un fee manual sustituye y "Volver a automático" restaura. |
| A03 | VIN ya guardado en otra cotización del mismo propietario | Aviso "Este vehículo ya tiene una cotización guardada.", abrir existente como acción principal, crear nueva como secundaria; no bloquea ni sobrescribe el formulario abierto. |
| A04 | Honda CR-V 2007, IAA, puja 2000, grúa 500, barco 825, papelería 15, TC 27.0281, reparación L20,000, venta L190,000 | Partidas USD 4135; importado L132,761.19; inversión L152,761.19; utilidad L37,238.81. |
| A05 | Sede "Nashville (TN)" con IAA o COPART | US$500 aplicado (confirmación del usuario 2026-10-21; ver RV02). Sin subasta definida, queda pendiente. No bloquea la cotización. |

## Ronda 2026-10-21: tarifas PDF, Nashville, VIN, listado y archivado
| ID | Escenario | Resultado esperado |
|---|---|---|
| RV01 | Nueve tarifas de grúa del PDF | Las nueve filas muestran el importe nuevo y conservan el anterior; la migración solo cambia importes anteriores, es idempotente y no toca cotizaciones. |
| RV02 | Nashville (TN) con IAA o COPART | US$500, zona FLORIDA, sin pendiente. |
| RV03 | Nashville sin subasta, con TX o KY, o sin estado | Pendiente o sin coincidencia; no aplica tarifa. |
| RV04 | VIN `JHLRE38797C009075` (17 caracteres) | Válido. El VIN de 16 caracteres `JHLRE38797C00907` se marca incompleto y no se completa solo. |
| RV05 | Corregir el VIN de un vehículo guardado | Cambia el VIN; la cotización y sus compras se conservan. |
| RV06 | VIN ya guardado en otra subasta | Aviso con fecha de subasta y estado vendido; no bloquea. |
| RV07 | Orden del listado | Fecha de subasta ascendente; sin fecha al final; fechas en America/Tegucigalpa sin desfase UTC. |
| RV08 | Filtros al entrar y "Mostrar todas" | Hoy en adelante, Vendido "Todos", pasadas vendidas ocultas; "Mostrar todas" limpia; nada se archiva. |
| RV09 | Marcar "Vendido" en la lista | Guardado inmediato y persistente; editable en el formulario; no bloquea VIN duplicado ni nuevas subastas. |
| RV10 | Eliminar con confirmación | Archivado lógico; compras, gastos y revisiones se conservan; borrador sin datos con texto especial; doble clic protegido. |
| RV11 | Otro usuario archiva o ve una cotización ajena | Denegado por RLS y por la función (`owner_id`). |
| RV12 | Borrado físico de `quotes` como usuario autenticado | Denegado. |
| RV13 | Restaurar una cotización archivada | La función la devuelve al listado. La interfaz no tiene botón todavía. |


## Datos y producción
| ID | Escenario | Resultado esperado |
|---|---|---|
| D01 | Primer seed | Catálogos si; cero compras, gastos o cotizaciones históricas. |
| D02 | Repetir seed | Sin duplicados ni sobrescribir ajustes propios. |
| D03 | Contenido de fuentes | No Bank Statement, originales ni claves en bundle o logs. |
| S01 | Usuario A intenta leer/editar datos B | Denegado por BD/servidor, también mediante IDs relacionados. |
| S02 | Cliente cambia totales/owner_id | Servidor rechaza acceso indebido y recalcula sus propios totales. |
| S03 | Revisión confirmada manipulada | Inmutable; nueva revisión en lugar de overwrite. |
| S04 | Registro público / endpoints de bootstrap | Deshabilitado o cerrado por autorización de administrador. |
| R01 | Pipeline | Tests antes de cambios de producción; esquema/funciones/frontend compatibles. |
| R02 | Error de despliegue parcial | No siguiente etapa; ruta de recuperación documentada sin reset de datos. |
| R03 | Producción alojada | Un proyecto Supabase y una Pages; pruebas BD efímeras en CI. |
| R04 | Recuperación | Respaldo y restauración ensayada en instancia efímera, no sobre datos reales. |

Los tests que dependen de tablas oficiales usan fixtures versionados de esas tablas; los del
caso 104 usan los fees manuales históricos. No ajustar el fixture al precio actual para hacer
pasar un test. En cada entrega informar que se ejecuto y que no, sin simular resultados.
