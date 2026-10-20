# Especificación funcional y técnica - Cotizador Honduras v2

## 1. Resultado buscado
Una aplicación privada para cotizar importacion de vehículos USA-Honduras, decidir cuanto
apostar, comparar proveedores, registrar compras y gastos y conocer la utilidad. Sustituye
el trabajo repetitivo de las hojas, no importa su historial ni replica sus fórmulas erradas.
Dos módulos: **Vehículos** y **Repuestos**. Configuración es una opción secundaria.

El ciclo es: nueva cotización -> escenarios de puja -> comprado -> gastos -> vendido.
No se compra ni se puja automáticamente en IAA/Copart; estas acciones son estados internos.

## 2. Pantalla principal y rapidez
Vista de tabla y editor compacto con resumen de costos siempre visible. Campos iniciales:
VIN opcional, marca/modelo/año, tipo de vehículo, subasta/sede/sublote y puja USD. El perfil de
fees y proveedor habitual vienen de preferencias y pueden cambiarse en la misma pantalla.
Fecha automática. El impuesto manual, presupuesto de reparación y precio de venta esperado
se capturan en el mismo editor; no requieren navegar a otros módulos.

Seleccionar tipo por un solo control: Sedan, SUV/camioneta, Pickup, Van/minivan, Moto y Otro.
Sin dimensiones obligatorias. Las categorías originales del proveedor siguen en Configuración
y en un control avanzado opcional, no como formulario obligatorio.

Al cambiar la puja, calcular localmente sin requests por cada tecla. Objetivo de implementación:
preview menor a 100 ms para un escenario con catálogos cargados, a medir en prueba real;
no es un rendimiento ya medido. Guardado con debounce y estado visible: pendiente, guardando,
guardado, fallo/reintentar. No comunicar guardado exitoso antes de la respuesta del servidor.
Atajos de teclado, autocompletado de ubicaciones, favoritos y últimas selecciones propias.
No asistente de varios pasos para cada carro. Responsivo para teléfono.

VIN incompleto/no disponible y modelo no catalogado permiten entrada manual y guardado.
El VIN normalizado usa trim y mayusculas; las cotizaciones pueden compartir VIN. Mostrar
historial o abrir una revisión, sin impedir una segunda cotización. Usar lote opcional como
referencia externa adicional. No obtener sede/sublote a partir del VIN.

vPIC es auxiliar: consultar solo cuando el VIN sea utilizable, cachear, cancelar respuestas
obsoletas y nunca sobrescribir una corrección manual con una respuesta tardia. Un fallo de
API no deshabilita el formulario. La aplicación no necesita una API de IA en runtime.

## 3. Grúa, barco y proveedores
Carga inicial: 282 filas de `Gruas` del Excel, 30 tarifas maritimas de los PDF y cuatro navieras.
Comparar cada registro con el PDF cuando haya texto repetido, ambiguedad o conflicto. Mantener
la fuente, fila/página y valores originales. Las 282 filas no se presentan como una extracción
exhaustiva y depurada del PDF; el Prompt 2 debe reconciliar ambos y documentar faltantes.

Resolver grúa por proveedor, subasta/sede/sublote y puerto/ruta. No reducir todo un estado a
un único precio. El listado distingue ubicaciones con nombres cercanos y precios distintos.
La aplicación puede sugerir el puerto de esa ruta; el usuario siempre puede modificarlo.

Resolver barco con el tipo sencillo y el mapeo de referencia de ese proveedor/puerto. El
archivo `tipos_vehiculo.json` propone asociaciones editables; pickup y minivan son conveniencias
de cotización, NO deducciones de longitud real. El importe y la referencia aplicada son visibles.
Permitir recordar una elección para marca/modelo/año o usarla solo en esa cotización.

Precedencia de importe: ajuste manual de la cotización > oferta elegida para ese vehículo >
referencia de tipo/ruta del usuario > catálogo de referencia. Un cambio automático no debe
sobrescribir un importe editado a mano. Acción pequena "Volver a tarifa" restablece el modo automático.

Las condiciones especiales de los PDF se conservan como notas consultables. No bloquean por
Tundra, pickup, tamaño especial, modelo excluido, falta de dimensiones o tarifa antigua. Una
fila "Se cotiza" no vale cero: permite capturar un aproximado o dejarla pendiente y seguir.
Si no existe una ruta coincidente, no inventar una: permitir ruta/importes manuales o subtotal.

Comparador dentro del vehículo: naviera, grúa, barco, papelería, total, moneda, fecha y notas.
North Atlantic, Carusa, JL y Matus se obtienen del archivo. No cargar sus ofertas históricas.
Senalar menor costo entre ofertas comparables completas, sin elegir ni contactar automáticamente.
Papelería predeterminada por proveedor es editable; no tratar una observacion pasada como regla
universal. Los ceros explícitos son distintos de campos vacios.

## 4. Perfiles y fees
Predeterminado: **IAA - Standard Volume Buyer Fees**. Al cambiar a Copart se restaura el último
perfil de Copart, no se aplica una tabla IAA. Recordar configuración por usuario y permitir
modificar solo el escenario actual. Mantener visible el perfil aplicado junto al total.

Catálogo de familias iniciales:
- IAA standard licensed: Standard Volume y High Volume; IAA Non-Licensed.
- IAA Heavy: Standard Volume y High Volume; IAA Rec Rides: Standard Volume.
- Copart Non-Licensed/Standard Pricing; Licensed/Standard Pricing; Licensed/Preferred Pricing.
- Manual/personalizado/intermediario. Segmentos especiales, como CrashedToys, admiten un perfil
  propio con fuente o ingreso manual; no reutilizar la tabla standard como si fuera equivalente.

Parámetros de Copart: título Clean/Non-Clean, fondos secured/unsecured, standard/heavy y
pre-bid/live, además de los cargos opcionales que procedan. IAA usa sus propias dimensiones,
como segmento/volumen y modalidad internet/proxy. No copiar a IAA condiciones de Copart sin fuente.
No generar productos cartesianos de combinaciones que la fuente no respalda. Las dimensiones
quedan en un panel compacto de perfil, no se preguntan en cada cotización.

Reglas versionadas: tramos con límites explícitos, importe fijo o porcentaje según tabla,
cargos adicionales y condiciones. Distinguir buyer fee base y fees totales. Servicio, puerta,
puja, título y demas cargos se suman una vez. Papelería de naviera no es manejo de título de subasta.
No sumar multas/storage por defecto si no se capturan como costo aplicable. Intermediario aparte.

Fuente y vigencia por versión. El paquete incluye opciones y enlaces, no tablas monetarias
completas. Claude debe cargarlas desde las páginas oficiales en el Prompt 2, comparar las
pestañas completas y registrar cualquier ambiguedad. Prioridad al perfil IAA del usuario.
No inventar tramos para terminar rápido ni usar USD795 del caso como constante.

Si falta una tabla, el perfil sigue seleccionable y los fees aceptan total manual. Otro modo
rápido permite ingresar "Carro + fees" y derivar fees = total - puja. Los tres valores no son
sumandos independientes. Al cambiar de modo, conservar la fuente del valor elegido.
Al cambiar la puja en modo fees manuales, mantener el fee manual y senalar que es una estimación
fija; no reutilizar un total carro+fees antiguo para generar fees negativos. No bloqueo del borrador.

## 5. Impuestos y gastos de salida: solo manual
Servicio único `ManualTaxProvider`, sin cálculos fiscales ni llamadas a SARAH. Un enlace opcional
abre SARAH para que el usuario lo consulte por su cuenta; no completar ni enviar datos desde la app.
No capturar campos como cilindrada, seguro fiscal, origen o tracción como requisitos fiscales.

Dos modos mutuamente excluyentes:
1. Total combinado en HNL: una sola cifra "Impuestos y gastos de salida" que se incluye una vez.
2. Desglose manual en HNL: impuestos + gastos locales. Estos últimos pueden ser un subtotal
   manual o líneas opcionales (matrícula, IP, agente aduanero, votainer, otros), pero no ambos.

Dejar claro en pantalla que el modo total ya incluye el desglose. Cambiar de modo no suma valores
ocultos. Al pasar de total a desglose, guardar el antiguo total como referencia, no repartido
arbitrariamente entre partidas. Los incompletos se guardan como pendientes.

Presets personales opcionales: acceso rápido L10000 para impuesto de pago único, y referencia
L20000/L21000 para gastos locales conforme al último mensaje. No activarlos por año ni para
todas las cotizaciones. No inferir si una fila anterior incluye esos conceptos. El caso 104
conserva L50297.89 completo en modo total, sin agregar impuestos o gastos locales encima.

Guardar amount, mode, entered_at, source_note opcional y parámetros de la cotización al capturar.
Al variar puja/flete/cambio, conservar el importe. Indicador discreto: "Importe manual conservado".
No exigir validación, nueva consulta ni confirmación antes de calcular/guardar. No llamarlo
impuesto recalculado. La investigación del algoritmo queda fuera de TODAS las cuatro entregas.

## 6. Motor de costos, monedas y caso 104
Intercambio de dinero como strings decimales; almacenamiento PostgreSQL NUMERIC. No floats
para sumas monetarias acumulativas. Mantener precisión interna de conversión y redondear
para visualización al final (2 decimales, HALF_UP), no en cada conversión antes de sumar.
Tipo de cambio siempre significa HNL por USD; tiene fecha/fuente y se fija en la revisión.
No sembrar 27.0288 como cambio vigente: es solo el dato del caso de prueba.

Variables de una cotización sin cargos bancarios adicionales:
```
car_plus_fees_usd = bid_usd + fees_usd
cash_components_usd = bid_usd + fees_usd + towing_usd + ocean_usd + paperwork_usd
landing_hnl = manual_total OR (manual_tax + manual_local_expenses)
import_cost_hnl = cash_components_usd * fx + landing_hnl
import_cost_usd_equivalent = cash_components_usd + landing_hnl / fx
investment_with_repair_hnl = import_cost_hnl + repair_budget_hnl
expected_profit_hnl = expected_sale_hnl - investment_with_repair_hnl
```

Cargos bancarios y otros gastos se incluyen una sola vez en su moneda/cambio, cuando se usen.
El presupuesto de reparación no es un gasto efectivamente realizado. Margen sobre venta y
retorno sobre inversión son métricas distintas y opcionales, con denominadores explícitos.
No presentar utilidad final si faltan partidas: mostrar "utilidad con costos capturados".
Si el cambio falta o es cero, conservar importes en su moneda y no dividir; guardar borrador.

Caso del usuario: ID104, `Quotes!A101:AF101`. Su V101 suma un subtotal intermedio otra vez,
y W101 omite papelería. Conservar el resultado del Excel como evidencia y probar el motor
nuevo sin esa doble suma y con papelería incluida. Valores esperados nuevos: total importado
L166521.73; con reparación L186521.73; utilidad estimada L33478.27. Ver el mapa y fixture.
NO forzar nuevas tarifas IAA sobre este fixture: fees son entrada manual histórica de USD795.

## 7. Cotizaciones, compras y ventas
Cotización: borrador editable + revisiones confirmadas. Reabrir conserva los importes/versiones,
no aplica tarifas actuales silenciosamente. Una nueva comparación crea una revisión.
Mantener vendedor, dia subasta, verificación/notas Bid.cars, motivo de no ganado y Max Bid set
como campos opcionales en un area avanzada, siguiendo el Excel. Sin scraping de esos sitios.

"Marcar comprado" crea un registro vinculado a la revisión de forma idempotente. No convierte
presupuestos en facturas/gastos pagados. Permite capturar y corregir importes reales y fechas.
Campos de Purchases: grúa, barco, papelería, carro, fees, BAC/BP, PayPal, banco receptor,
impuestos/salida, fecha de recepción, precio vendido y fecha de venta. "Vendido a" contiene
importes en el archivo: se mapea a precio de venta, no a nombre de comprador.

Gastos reales admiten monedas y cambio por transacción. Total sin reparación, reparación real,
total con reparación y desviación contra presupuesto. Utilidad realizada usa venta real y costos
reales, no la media de anuncios. Un costo sin confirmar debe seguir marcado como estimado.
No reemplazar cotización histórica por costos reales posteriores.

Algunas fórmulas de compras dividen comisiones o costos entre dos. Eso no es una regla global.
Soportar ajustes/importes imputados opcionales en avanzado, conservando monto total, cuota y
motivo cuando se use un reparto. No deducir socios o porcentaje de propiedad de otras filas.
No desarrollar conciliacion bancaria ni cargar la hoja Bank Statement.

## 8. Repuestos: cotizar y registrar gastos
Vista tipo matriz como en Excel: filas de piezas y columnas de proveedores, con opción de
lista en movil. Celdas contienen oferta con precio, disponibilidad y fecha, no columnas fisicas
por proveedor en base de datos. Proveedor nuevo aparece sin migración de esquema.

Catálogo inicial de 45 nombres/contactos de encabezados. Clasificación china/yonker/otro editable;
no inferir calidad, origen ni clase por precio. Conservar teléfonos aportados como no verificados.
Estados: cotizado, no disponible, sin consultar. "No" no equivale a cero ni oferta más barata.
Comparar precios comparables (misma pieza, condición/cantidad/moneda); resaltar mínimo y permitir
elegir otro por criterio del usuario. No ordenar piezas ni contactar vendedores automáticamente.

Una oferta puede existir antes de comprar vehículo. Convertirla a gasto exige seleccionar una
compra propia, con una sola operación idempotente. Guardar fecha de compra, fecha de pago,
descripcion/pieza, lugar/proveedor, monto, moneda/cambio y notas. Fecha de pago no duplica gasto.
Incluir servicios, pintura, gasolina, aceites y mano de obra como gastos, no solo piezas fisicas.
Búsqueda por marca/modelo/año, pieza y proveedor para recuperar futuras cotizaciones/compras.

## 9. Mercado y Final Prices
Subseccion de Vehículos. Entradas manuales: marca, modelo, versión opcional, año, precio, motor,
tracción, millas, fecha consultada, enlace y recién ingreso; ubicación opcional como ampliación
solicitada en la transcripcion. No asumir que el anuncio es venta cerrada.

Media automática de referencias propias seleccionadas por criterios visibles y número de muestras.
Excluye precios desconocidos y no mezcla años/versiones arbitrariamente. Se puede agrupar versiones
comunes o aislar una especial por elección del usuario. Conservar modelo original y alias editables.
Final Prices es precio objetivo manual que puede sugerirse con la media; no hacer scraping ni
reutilizar precios de mercado históricos del Excel. Sin datos, precio queda manual, no cero.

## 10. Datos, permisos y sincronización
Modelo propuesto: user_settings, vehicles, quotes, quote_revisions, purchases, purchase_expenses,
suppliers, part_quote_items, part_supplier_offers, logistics_providers, logistics_offers,
market_observations, sale_price_targets, shipping_rates, towing_rates, vehicle_type_mappings,
fee_profiles, fee_schedule_versions y fee_rules. Agrupar tablas donde simplifique sin perder semantica.

Datos personales y catálogos del usuario tienen owner_id. RLS debe validar acceso y consistencia
entre relaciones; no permitir asociar una pieza/compra de otro usuario. Tarifas globales de lectura
solo para autenticados, cambios por rol/función autorizada. No fiarse del owner enviado por cliente.
Registro público deshabilitado; crear propietario autorizado en consola antes de abrir el uso.

Cálculo puro compartido entre navegador y servidor. Servidor válida sesión, formato e integridad;
NO vuelve obligatorio un impuesto/medida/sede ausente. Permite persistir revisiones incompletas con
estado parcial. Verificar los importes y versiones, no confiar en totales enviados por frontend.
Autoguardado del borrador con revisión/optimistic locking para no perder cambios de otra pestaña.
Las revisiones confirmadas son inmutables por permisos/servidor, no solo por un botón oculto.
Cambiar un catálogo no cambia una revisión histórica. Mantener source/versión/override en snapshot.

## 11. Publicación y operación
Una producción Supabase y una Pages; un repositorio privado. Tests efímeros en CI, sin staging
permanente ni Docker local obligatorio. La URL privada es accesible por internet pero todos
los datos requieren autenticación. No hace falta dominio comprado para la primera versión.

Workflow único: checks -> pruebas BD/RLS efímera -> build -> migraciones revisadas -> funciones ->
frontend -> health checks. No despliegue paralelo de Pages Git integration fuera de este flujo.
Conservar compatibilidad mientras frontend y backend se actualizan y comprobar versión por SHA.
Fallback ante fallo parcial: detener pipeline y usar backend compatible/rollback de frontend;
no revertir datos destructivamente para igualar versiones. Documentar incidente y recuperación.

Respaldos y exportación antes de migraciones relevantes; no reset remoto, no seed demostrativo.
Cada nueva tabla/regla con pruebas. Tarifa/proveedor importado una sola vez por clave estable,
sin sobrescribir cambios del usuario al ejecutar nuevamente la carga.
Fuentes privadas, transacciones, respaldos, claves y secretos no van a Git/public/dist/logs.
Datos de catálogo importados deben residir en BD protegida, no en un bundle público innecesario.
No sumar costos de suscripciones sin autorización; verificar límites/planes al aprovisionar.

## 12. Fuera de alcance
Algoritmo/API fiscal; inteligencia artificial de inspeccion de danos; lectura de inventario
completo de subastas; acceso privado a aseguradoras; pagos o pujas; contabilidad bancaria;
migración histórica; registro público; suscripciones/SaaS y multitenancy comercial complejo.
Tampoco un calculador automático de puja máxima con impuestos variables. Max Bid set permanece
manual hasta una fase posterior expresamente solicitada.
