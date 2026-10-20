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
