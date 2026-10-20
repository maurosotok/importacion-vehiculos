# Cambios aprobados y límites de esta versión

Fuente principal: último mensaje del usuario y `Carros.xlsx`. Fecha de preparación: 19-10-2026.
Estas decisiones reemplazan los requisitos incompatibles de la versión anterior.

| Tema | Decisión vigente |
|---|---|
| Clasificación | Selección simple del tipo de vehículo. Sin medidas obligatorias ni aprobaciones. |
| Tarifas de referencia | Utilizables inmediatamente. La antigüedad se muestra en detalle; no bloquea. |
| Importes manuales | Disponibles en grúa, barco, papelería, fees, impuestos, reparación y venta. |
| IAA | Perfil inicial Standard Volume Buyer Fees. |
| Otros perfiles | Selector con familias IAA/Copart y parámetros propios; opción personalizada/manual. |
| Impuestos | Solo captura manual. Investigación fiscal y API de SARAH totalmente en standby. |
| Gastos locales | Matrícula, IP, agente aduanero y votainer diferenciados del impuesto cuando haya desglose. |
| Pago único | Botón manual de L10000, sin deducir elegibilidad por año, motor u origen. |
| L20-21 mil | Referencia del usuario para gastos locales; no total obligatorio ni tasa oficial. |
| Históricos | Se quedan en Excel. Los casos de prueba tampoco se cargan como operaciones en producción. |
| Módulos | Vehículos y Repuestos; Configuración secundaria. |
| Despliegue | Una producción privada; cambios revisados y publicados sobre la misma URL. |

## Impuestos sin duplicar
El usuario escribe: "Los 20-21 son por matrícula, IP, agente aduanero, votainer. + 10000 de
impuestos del pago único". No extrapolar esta explicación a todas las filas antiguas. La
aplicación permite registrar esas partidas por separado. Si introduce L21000 de gastos locales
y L10000 de impuesto, suma L31000. Si introduce un total combinado que ya contiene todo,
ese total es el único que se suma. Ninguno de estos importes se aplica automáticamente al crear
una cotización. No hay una elección fiscal que bloquee desarrollar la aplicación.

En el caso 104, L50297.89 permanece como total manual de salida heredado de la columna U.
No se deriva su desglose, no se agrega encima L10000 ni L20000, y no se reutiliza para otro VIN.

## Propuestas de implementación, no datos aportados por el usuario
Las asociaciones iniciales de pickup/minivan con una categoría de referencia, el modelo de
base de datos y los nombres internos de campos son decisiones de diseño propuestas. Se
identifican como tales. Son editables y no representan una certificación del proveedor.

La corrección de los totales monetarios del nuevo sistema está explicada con celdas y valores
en `MAPA_EXCEL_Y_FORMULAS.md`. Se conserva el ejemplo original para compararlo; no se edita ni
se reescribe el historial del Excel.

## Eliminar del plan v1
No mantener tareas de investigar SARAH, reproducir un algoritmo fiscal ni activar tasas.
No mantener flags que obliguen a confirmar medidas o vigencia antes de cotizar. No usar como
criterio de aceptación que los fees estén siempre disponibles: la ausencia de una tabla debe
permitir total manual. Que el perfil este visible no significa que sus importes ya se verificaron.
