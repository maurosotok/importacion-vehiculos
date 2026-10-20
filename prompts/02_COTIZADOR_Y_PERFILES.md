# Prompt 2 - Cotizador rápido, tarifas y perfiles de fees

Continua sobre el repositorio existente. Lee `CLAUDE.md`, `docs/ESTADO.md` y la especificación
v2. Implementa el cotizador de punta a punta, sin alterar el alcance ni reintroducir las
restricciones de dimensiones y confirmación de tarifas del plan anterior.

Flujo: pegar VIN opcional -> completar marca/modelo/año -> tipo sencillo -> subasta/sede/sublote
-> puja. vPIC solo ayuda a completar datos; cachea y permite captura manual ante error. No
pidas longitud. Si el usuario elige SUV/camioneta utiliza su mapeo de trabajo; las asociaciones
pickup/minivan del JSON son referencias editables, no medidas reales. No impongas verificación
por modelo especial ni una ventana para aceptar tarifas antiguas. Cuando se cambia un importe
manualmente, ese override gana sobre futuras sugerencias hasta "Volver a tarifa".

Carga las 30 tarifas maritimas y las 282 filas de grúas del Excel estructuradas. Revisa el PDF
original para reconciliar textos duplicados, sublotes, filas faltantes y conflictos; genera
`docs/RECONCILIACION_TARIFAS.md` con procedencia y estado. No presentes el Excel como una
extracción limpia de todo el PDF. No inventes geografia ni descartes filas silenciosamente.
"Se cotiza"/cero no confirmado significa importe desconocido, no gratis. Permite importe
manual o partida pendiente sin bloquear guardar. Conserva todas las categorías originales
como opciones avanzadas y no pierdas diferencias entre sublotes. Mostrar referencia aplicada.

Implementa selector completo de familias en `perfiles_fees.json`: IAA Standard Volume por
defecto; IAA High Volume, Non-Licensed, Heavy Standard/High y Rec Rides Standard; Copart
Non-Licensed Standard, Licensed Standard y Licensed Preferred; manual/intermediario. Las
opciones de título/fondos/segmento/modalidad son propias de cada familia y persistidas por
usuario. No forzar el mismo esquema de Copart sobre IAA ni inferir elegibilidad del comprador.

Investiga SOLO las tarifas de subasta desde las fuentes oficiales indicadas. Prioriza IAA
Standard Volume y carga sus tramos y cargos con fecha/fuente. Identifica todas las pestañas y
condiciones antes de importar Copart. No utilices tablas canadienses ni calculadoras de terceros
como fuente oficial. Si no puedes leer una tabla, genera una solicitud concreta de captura o
exportación y continua con importe manual: el perfil sigue seleccionable y la cotización
sigue funcionando. No afirmes tener todas las tablas completas si no las cargaste/verificaste.
No usar USD795 del caso 104 como tarifa general ni agregar cargos ya incluidos en un total manual.

Motor de fees con tramos/porcentajes/condiciones versionadas. Mostrar el total y un desglose
expandible. Modo alterno carro+fees: derivar fees del total y la puja una sola vez. Manual
prevalece; cambiar puja conserva el fee manual con nota, no genera cargos negativos.

Impuestos EXCLUSIVAMENTE manuales. Implementa total combinado HNL o desglose manual impuestos
+ locales, mutuamente excluyentes. Matrícula, IP, agente aduanero y votainer pueden quedar como
un subtotal local o líneas opcionales. El botón L10000 es un relleno manual de pago único, no
regla por año. L20-21 mil es referencia local configurable, no monto que se agrega a cada caso.
Al cambiar puja/flete/cambio, mantener el impuesto manual con nota discreta; nada de reconsultar,
invalidar el guardado o pedir confirmación. No inspecciones API/algoritmo/leyes de SARAH.

Motor de costos puro compartido, decimales exactos, preview local rápido, validación y recálculo
seguro en servidor. Borradores parciales son permitidos y etiquetados. Revisiones confirmadas
congelan entradas, precios, overrides, fuente y versión. No cambian por actualizar un catálogo.
Utilidad usa precio de venta y reparación manuales o sugeridos, con pendientes visibles.

Integra el comparador de navieras dentro del vehículo (grúa/barco/papelería/total). No copies
las ofertas de viajes antiguos. Conserva datos opcionales de Quotes: Seller, dia subasta,
Bid.cars/notas, motivo no ganado y Max Bid set manual. No agregues una calculadora de puja máxima.

Convierte `data/fixtures/caso_104.json` en tests: conserva valores originales por separado y
verifica el motor nuevo con L166521.73 importado, L186521.73 con reparación y L33478.27 utilidad.
Son diferencias documentadas frente al Excel, por doble suma del subtotal y papelería omitida.
U101 L50297.89 se ingresa como total combinado sin descomponer ni sumarle otros importes fiscales.

Prueba límites de tramos, perfiles, modos manuales, cambio de puja sin bloqueos, diferencias de
sublote, VIN repetido, valores pendientes, doble conteo, precisión y snapshots. Actualiza estado,
reporte de fuentes y pruebas realmente ejecutadas. Pública solo mediante el flujo autorizado.
