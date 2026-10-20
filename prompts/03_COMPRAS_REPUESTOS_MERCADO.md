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
