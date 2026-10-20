# Sustituir el paquete anterior

Si todavía no hay código: descomprimir este ZIP en una carpeta nueva y utilizar solo v2.
No necesita ejecutar los prompts del paquete anterior primero.

Si ya comenzaste con Claude: conservar src, migraciones y cambios existentes. Sustituir el
contexto CLAUDE.md, las especificaciones/prompts y catálogos con v2, revisar diff y pedir que
aplique las decisiones nuevas antes de continuar. No borrar datos ni tablas de producción.
Retirar del plan activo los scripts y documentos fiscales de v1 y cualquier flag de confirmación
obligatoria de dimensiones/tarifas. No ejecutarlos por estar presentes en una carpeta antigua.

`data/catalogos/embarques_referencia_2025.json` mantiene los importes originales pero cambia
expresamente la política a referencia utilizable sin bloqueo. Los campos de longitud son
metadatos de fuente, no validaciones obligatorias. Mantener el historial de Git del cambio.

No fusionar a ciegas dos CLAUDE.md o dos prompts con decisiones incompatibles. Las decisiones
v2 tienen prioridad. Un primer commit de actualizacion de requisitos es preferible a iniciar
otra aplicación si la existente ya tiene una base funcional.
