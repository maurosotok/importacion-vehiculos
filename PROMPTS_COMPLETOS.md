# Cuatro prompts completos para Claude Code - v2

Ejecutar en orden. Los impuestos permanecen manuales en las cuatro entregas.

# Prompt 1 - Base real, datos y producción privada

Trabaja dentro de este repositorio. Lee `CLAUDE.md`, `docs/DECISIONES_V2.md`,
`docs/ESPECIFICACION.md`, `docs/MAPA_EXCEL_Y_FORMULAS.md` y `docs/PRUEBAS_ACEPTACION.md`.
Implementa la primera entrega; no te límites a devolver un plan ni una interfaz de demostración.
Estas son las decisiones v2, posteriores al video y al paquete anterior.

Objetivo: aplicación personal de cotización USA-Honduras, con dos módulos: Vehículos y Repuestos.
Configuración secundaria. Stack: React, Vite, TypeScript estricto, Supabase PostgreSQL/Auth/Edge
Functions, Cloudflare Pages y GitHub Actions. Un repositorio privado, un proyecto alojado
Supabase y un proyecto Pages. No necesito una base de staging permanente, Docker local ni WSL
para empezar. Las pruebas de BD/RLS pueden correr en servicios efímeros del runner de CI.

Primero inspecciona lo existente sin destruir trabajo. Genera una estructura simple, scripts
reales en package.json, dependencias compatibles y lockfile. Implementa autenticación con un
único propietario inicial autorizado y sin registro público. RLS en todas las tablas privadas,
owner_id seguro y comprobación de pertenencia de relaciones. No endpoints abiertos para
crear administradores. Usa `.env.example` sin secretos; nunca incluyas service_role/secret
keys en VITE_ ni pidas claves en el chat.

Crea el esquema inicial de cotizaciones/vehículos y prepara migraciones para los demas
conceptos de la especificación, sin sobreingenieria. Construye un flujo real de crear, guardar,
reabrir y editar borradores. Debe funcionar con datos parciales: sin VIN, medidas, impuesto,
ruta o precio completo. Mostrar lo pendiente y subtotal conocido; no poner ceros ficticios.
Seguridad y tipos válidos siguen siendo obligatorios; los requisitos comerciales incompletos
no deshabilitan guardar el borrador.

La UI debe estar en español, USD/HNL, fecha America/Tegucigalpa, navegación con teclado y
formulario compacto. Tipo de vehículo simple, sin clasificación dimensional obligatoria.
Predetermina el perfil IAA Standard Volume Buyer Fees desde las preferencias. Impuestos solo
manuales: no existe una fase fiscal automática en este plan.

Prepara importacion idempotente de los JSON de `data/catalogos/`, con claves estables y
sin sobrescribir modificaciones del usuario. No ejecutes una importacion automática del Excel
completo. No sembrar compras/cotizaciones/mercado/repuestos históricos ni el fixture 104.
`fuentes_privadas/` es fuente local solamente: preserva .gitignore, no lo publiques ni lo copies
a public/dist. No desarrollar Bank Statement.

Prepara un workflow único coordinado: instalar -> lint/typecheck/unit tests -> pruebas BD/RLS
efímeras -> build -> migraciones compatibles -> funciones -> Pages Direct Upload -> smoke checks.
Usa secretos/variables exactamente como `templates/VARIABLES_DESPLIEGUE.md`, o documenta una
modificación necesaria. No activar integracion Git de Pages que publique fuera de este flujo.
Incluye concurrency para producción, versión de build por SHA, migraciones no destructivas y
un plan de recuperación ante publicación parcial. No utilices db reset contra la base alojada.

Crea `docs/ESTADO.md` y completa `docs/ARRANQUE_IMPLEMENTADO.md` con comandos exactos que ya
existan, nombres de recursos, variables y las acciones que debo hacer en las consolas. Tu
lista manual debe ser mínima: crear cuentas/recursos, usuario autorizado, secretos y primer
push. No contrates planes ni publiques sin autorización. Si no tienes credenciales o acceso,
deja todo listo para conectar; no afirmes haber desplegado.

Ejecuta las pruebas que puedas. Entrega: archivos cambiados, flujo realmente funcional,
pruebas con resultado, pendientes no simulados y las siguientes acciones manuales necesarias.
No bloquees esta entrega porque los tramos de fees o los impuestos no estan automatizados.

---

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

---

# Prompt 3 - Compras, repuestos y mercado conectados

Continua el sistema existente. Lee las decisiones v2, la especificación, el mapa completo del
Excel y `docs/ESTADO.md`. No agregues nuevos módulos principales: Vehículos y Repuestos, con
subsecciones y Configuración secundaria.

Implementa conversión idempotente de una cotización a compra: un doble clic/reintento no
crea dos compras. Conservar revisión origen, presupuesto, cambio y notas. Los costos reales
no sobrescriben la cotización histórica. Crear la compra no convierte todos los importes
presupuestados en gastos pagados. Permitir completar importes reales paulatinamente.

Reproduce lo útil de Purchases: grúa, barco, papelería, carro, fees, BAC/BP, PayPal y banco
receptor, impuesto/salida manual, reparación real, total sin/con reparación, fecha recibido,
precio vendido y fecha de venta. En este Excel "Vendido a" es un importe de venta. Distingue
utilidad estimada y realizada. Incluye otros gastos con categoría y moneda/cambio por gasto.
Algunos valores de Excel estan repartidos; ofrece importe/cuota imputada opcional con total y
motivo, sin asumir 50% global ni un socio. No construyas ni importes el estado bancario.

Repuestos: dos vistas de los mismos datos, cotizaciones y gastos. Comparador en matriz
pieza-proveedor para escritorio y lista para movil. No una columna de BD por proveedor.
Usa los 45 proveedores del catálogo inicial sin importar sus precios viejos. Nombres/contactos
son los aportados, no verificados. Categoría china/yonker/otro editable; no inventar tipo.

Por oferta: pieza, vehículo/referencia, proveedor, precio, moneda, cantidad, estado de
disponibilidad, fecha y notas. "No" = sin disponibilidad; vacío = sin consultar/desconocido.
No deben ganar como precios cero. Comparar solo ofertas compatibles y resaltar la menor,
sin forzar su selección. Dejar cotizar una pieza antes de tener una compra.

Por gasto: vincular a una compra propia; conservar pieza/servicio, proveedor/lugar, fecha
compra, fecha pago, monto, moneda/cambio y notas. Gasolina, aceite, pintura y mano de obra
son gastos válidos. Registrar la fecha de pago no suma un segundo costo. Convertir oferta a
gasto una sola vez, editable en la compra, sin modificar la oferta original.

Búsqueda rápida por pieza, marca/modelo/año y lugar para conocer donde se compro/cotizo antes.
Presupuesto de reparación separado de gasto real y desviación visible. Contingencia o redondeo
de presupuesto al siguiente L5000 como opción del usuario, nunca modificando gastos reales.

En Vehículos/Mercado, captura manual con los campos del Excel: marca/modelo/año, precio,
motor, tracción, millas, fecha, enlace, recién ingreso. Ubicación/versión opcionales. No
deducir ventas realizadas a partir de anuncios. Media de comparables con criterios visibles,
número de muestras y fecha; excluir valores desconocidos. Permitir agrupar versiones comunes
o separar especiales por elección del usuario. Final Prices es objetivo editable y puede
usar la media como sugerencia; no importar precios antiguos ni hacer scraping.

Agregar exportación CSV protegida de los datos propios y formato de impresion del resumen
sin estado bancario, secretos o datos de terceros. La experiencia de cotización sigue sin
bloqueos de dimensiones, vigencia, impuestos manuales o datos desconocidos.

Pruebas: aislamiento por propietario en cada relación, idempotencia, conversión de oferta a
gasto, costos y monedas, no duplicar pago, presupuesto vs real, ventas y media, y navegación
por teclado. Ejecuta pruebas reales y actualiza `docs/ESTADO.md` con lo terminado y lo pendiente.
No tocar algoritmo fiscal, automatizar compras externas ni agregar suscripciones de SaaS.

---

# Prompt 4 - Pruebas finales, rapidez y cierre de producción

Audita y termina el sistema implementado contra `docs/ESPECIFICACION.md`, el mapa del Excel y
todos los casos de `docs/PRUEBAS_ACEPTACION.md`. Este Prompt 4 REEMPLAZA el anterior Prompt 4
fiscal: NO investigar impuestos, API de SARAH, algoritmos, seguros imputados, tasas ni normas.
Impuestos siguen manuales y no bloqueantes. No agregar funciones ajenas al alcance.

Revisa primero el flujo del usuario: abrir cotización, elegir tipo sin medidas, seleccionar
sede, modificar puja varias veces, editar grúa/barco/fees, escribir impuesto manual, ver
inversión/utilidad y guardar. No modales obligatorios por tipo o antigüedad. Comprueba que
la puja cambia sin tener que volver a ingresar impuesto. Un faltante debe producir un subtotal
con etiqueta, no una cotización prohibida ni un cero silencioso.

Comprueba persistencia de perfil IAA Standard Volume predeterminado, cambios IAA/Copart y
override manual. Documenta exactamente que tablas de fees quedaron completas/versionadas y
cuales requieren importe manual. No ocultar un perfil ni simular costos para cerrar una tarea.
Preserva las fuentes y permite actualizacion de catálogos desde Configuración.

Ejecuta los tests del caso 104 y comprueba que los resultados nuevos estan identificados como
la corrección documentada de dos fórmulas del Excel. No modifiques el fixture para esconder
una diferencia ni recalcules el impuesto manual. La versión original permanece como evidencia.

Prueba el recorrido completo cotización -> compra -> gasto de repuesto/servicio -> venta;
comparador de navieras; matriz de piezas; Mercado/Final Prices; CSV y reapertura. Prueba
idempotencia de doble clic y reintentos, autoguardado concurrente, snapshots inmutables y tipos
de cambio por gasto. No usar transacciones de demostración en la BD de producción.

Seguridad real: usuario anonimo sin datos, usuario A sin acceso a B por IDs, relaciones o
exportaciones, cambios de owner_id rechazados, endpoints autenticados, ningun administrador
creable desde un cliente público. Verifica RLS/privilegios y no solo botones ocultos.
Busca secretos, XLSX originales, estado bancario o JSON privados empaquetados en public/dist.
VITE_ contiene solo configuración pública. No loguear VINs/contactos innecesarios ni claves.

Mide el tiempo de preview con catálogos cargados y corrige requests/redibujos innecesarios.
Deja carga cacheada, búsqueda rápida, cancelacion de consultas VIN y feedback claro al guardar.
No afirmes una latencia que no mediste. Prueba navegador de escritorio y viewport movil.

Verifica pipeline coordinado, migraciones compatibles, salud backend/frontend y SHA de build.
Documenta primer despliegue, actualizacion habitual y recuperación ante fallo parcial. Ensaya
restauración de un respaldo en instancia efímera, no resetees producción. Mantener solo una
producción alojada y sin requisito de Docker/WSL local.

Completa `docs/OPERACION.md` con: ingreso, tarifas, perfiles, impuestos manuales, copia de
seguridad, exportación, publicación y limitaciones reales. Actualiza `docs/ESTADO.md` y entrega
un checklist de aceptación con pruebas ejecutadas, resultados y pendientes. Si falta acceso
para publicar, da comandos exactos pendientes; no afirmar que está en vivo. Publicar solo con
la autorización y credenciales ya configuradas, sin compras/planes externos automáticos.
