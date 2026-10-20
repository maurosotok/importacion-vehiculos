# Cotizador Honduras - paquete v2

Empezar en **00_EMPIEZA_AQUI.md**. Cuatro prompts completos en **PROMPTS_COMPLETOS.md** y separados
en prompts/. La especificación vigente es docs/ESPECIFICACION.md y las correcciones del Excel
estan en docs/MAPA_EXCEL_Y_FORMULAS.md.

Cambios centrales: tipo de vehículo sin medidas ni bloqueos; IAA Standard Volume por defecto y
selector IAA/Copart; impuestos solo manuales; una producción privada; no migración histórica.

Incluye catálogos de referencia: 282 filas de grúa del Excel, 30 tarifas maritimas, 45 proveedores,
4 navieras y 10 opciones de perfil (familias verificadas, tablas monetarias no incluidas).
La app, servicios alojados y el CI se implementan con los prompts; no estan desplegados.

El archivo Carros.xlsx queda en fuentes_privadas, ignorado por Git. No subir estados bancarios,
originales, claves ni respaldos a Git/public/dist. No reutilizar el Prompt 4 fiscal de v1.
