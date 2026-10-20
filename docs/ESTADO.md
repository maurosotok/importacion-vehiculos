# Estado de implementación

## Entrega 1 (implementada en el repositorio; no desplegada)
Vehículos (cotizaciones con datos parciales y pendientes), Repuestos (catálogo de proveedores),
Configuración (perfil de fees, proveedor, pago único manual, rango de gastos locales).
Motor de cálculo puro con Decimal. Migraciones 1–4. Workflow de publicación escrito, no ejecutado.
No hay commit creado. No hay despliegue ni URL pública comprobada.

## Entrega 3 (en curso; compras, repuestos y mercado implementados en código, sin probar en navegador)
Hecho:
- Migración `20261019000500_compras_y_marcado_idempotente.sql`: cantidad y condición en ofertas; lugar y notas en gastos; concepto `pintura`; reglas de reparto (con motivo, sin exceder el total); presupuesto, contingencia, redondeo a L5000 y tipo de cambio de origen en compras; índice único `compra_unica_por_cotizacion`; función `marcar_comprado` (SECURITY DEFINER, bloqueo `for update`, devuelve la compra existente si ya hay una).
- Motores puros: `src/motor/compra.ts` (resumen, utilidad estimada vs realizada, presupuesto con contingencia y redondeo, conversión oferta→gasto), `repuestos.ts` (matriz pieza×proveedor; "No" y precio cero no ganan; el más barato se resalta sin forzar selección), `mercado.ts` (promedio con criterios visibles, precios desconocidos excluidos, versiones agrupadas o aisladas), `busqueda.ts`, `csv.ts` (protección contra fórmulas), `src/lib/navegacion.ts` (teclas de flecha en la matriz).
- Interfaz: `src/paginas/Compra.tsx` (marcado con guardia contra doble clic, datos de compra, gastos con reparto, CSV, impresión sin estados bancarios ni notas), `src/paginas/Repuestos.tsx` (matriz de escritorio y lista móvil sobre los mismos datos, editor de ofertas, conversión a gasto una sola vez), `src/paginas/Mercado.tsx` (captura, criterios, promedio, precio objetivo editable con sugerencia desde la media). Subnavegación de Vehículos en `src/App.tsx`; estilos en `src/styles.css`.
- Rutas `vehiculos/mercado` y `vehiculos/<id>/compra` con pruebas en `src/lib/ruta.test.ts`.

Limitaciones conocidas:
- `marcar_comprado` recibe el snapshot desde el cliente y no recalcula en servidor. Hasta implementar el recálculo, el servidor confía en el snapshot del cliente.
- Una compra por cotización; "otro" cuenta como no reparación; redondeo del presupuesto a L5000 hacia arriba. Son decisiones provisionales.
- `motor_version` = `calculo-1` es provisional.
- La concurrencia de `marcar_comprado` no se simula con el harness de un solo cliente.
- La interfaz de compras, repuestos y mercado no se ha probado en navegador: no hay credenciales de Supabase ni `.env` en este entorno.

## Entrega 2 (en curso; motor y pruebas avanzados, interfaz no conectada)
Hecho en el motor puro (`src/motor/`):
- Fees: validación de tramos con convención de límite configurable (`fees.ts`), cálculo por tramo y cargos por modalidad, precedencia manual > carro+fees > tabla > pendiente (`calculo.ts`).
- Impuestos: combinado XOR desglose sin sumar ambos; L10000 solo como relleno explícito; rango 20.000–21.000 solo informativo (`impuestos.ts`).
- Comparador de envíos: solo ofertas completas y de la misma moneda; empates devuelven varias ganadoras (`envio.ts`).
- Grúas: búsqueda normalizada y resolución que no colapsa sublotes con importes distintos (`gruas.ts`).
- VIN: estado ausente/incompleto/completo, interpretación de respuesta vPIC, duplicados no bloqueantes, caché y descarte de respuestas viejas (`vin.ts`). No conectado a la interfaz ni al flujo de guardado.
- Revisión congelada: importes como texto y objeto profundamente inmutable (`revision.ts`). No hay función servidor que la persista.
- Caso 104 leído desde `data/fixtures/caso_104.json` (`caso104.test.ts`).

Pendiente de conexión:
- `src/paginas/EditorCotizacion.tsx`: selector de perfil de fees, modos de fees e impuestos, tipo de vehículo, comparador de envíos, campos opcionales de cotización (vendedor, día de subasta, notas Bid.cars, motivo de pérdida, puja máxima manual). Sin esto, la entrega no es utilizable por el usuario.
- `src/lib/formulario.ts`: `feeTablaUsd` se pasa como `null`; no hay columna en base de datos ni carga de tablas.
- Migraciones nuevas para perfil, modo de fees, columnas de tarifa, envío y campos opcionales: no escritas.
- Persistencia de revisiones congeladas: no escrita.

## Archivos principales
- Motor: `src/motor/{calculo,fees,impuestos,envio,gruas,vin,revision,referencias}.ts` y pruebas `*.test.ts`
- Interfaz: `src/App.tsx`, `src/paginas/{Acceso,Vehiculos,EditorCotizacion,Repuestos,Configuracion}.tsx`, `src/lib/*`, `src/styles.css`
- Base: `supabase/migrations/2026101900{0100,0200,0300,0400}_*.sql`, `supabase/config.toml`
- Función: `supabase/functions/version/{index,build}.ts`
- Scripts: `scripts/generar-version.mjs`, `scripts/admin/alta-propietario.mjs`, `scripts/smoke-produccion.mjs`, `scripts/catalogos/importar-catalogos.mjs`, `scripts/db/*`
- Catálogos: `data/catalogos/*.json` (incluye `tablas_fees_manual.json`, plantilla vacía de tarifas IAA/Copart)
- Conciliación: `docs/RECONCILIACION_TARIFAS.md` (embarques conciliados; grúas parcial)
- Publicación: `.github/workflows/publicar.yml`
- Documentación: `docs/ARRANQUE_IMPLEMENTADO.md`, `docs/OPERACION.md`, `docs/CHECKLIST_ACEPTACION.md`, `templates/VARIABLES_DESPLIEGUE.md`

## Cierre de producción (Prompt 4, 2026-10-20)
Ejecutado en esta ronda, con exit code registrado:
| Comando | Resultado |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npm test` | 11 archivos, 130 pruebas superadas |
| `npx eslint src scripts eslint.config.js vite.config.ts` | Exit 0 |
| `npm run lint` (raíz) | Exit 1: 477 errores, todos dentro de `Python/` |
| `npm run db:verificar-migraciones` | 5 migraciones válidas |
| `npm run test:bd` | 24 pruebas superadas (PostgreSQL 17 embebido, transacciones con rollback) |
| `npm run db:ensayar-restauracion` | Exit 0: origen y destino coinciden en filas, RLS (20 tablas), políticas y funciones; la reimportación inserta 0 filas |
| `npm run build` | Exit 0; JS 561.08 kB (gzip 163.32 kB); aviso de tamaño de chunk; `dist/version.json` con sha `local` |
| Escaneo de `dist/` por patrones de clave | Una coincidencia: el prefijo `sb_secret_` dentro del guard de supabase-js que rechaza claves secretas. No es una clave |

Medido: `calcularCotizacion` (motor puro) tarda unos 0.004 ms por llamada. No incluye interfaz, red ni base de datos. La latencia de la vista previa en pantalla no se ha medido.

Revisado por lectura de código, sin ejecutar en navegador: la impresión de Compra no incluye notas ni datos bancarios (sí imprime la descripción de cada gasto); el CSV neutraliza fórmulas; `supabase/config.toml` tiene `enable_signup = false`; no hay `signUp` en `src/`; `scripts/verificar_paquete.py` solo comprueba que no hay algoritmo fiscal previo empaquetado.

Corregido en esta ronda: `docs/ARRANQUE_IMPLEMENTADO.md` decía "16 pruebas"; `docs/OPERACION.md` tenía dos errores de redacción y una afirmación falsa sobre `Python/`.

Checklist de aceptación por ID: `docs/CHECKLIST_ACEPTACION.md`.

Hallazgo: `Python/` (2399 archivos) está rastreado en el commit inicial. Antes se describió como sin rastrear; eso era incorrecto. Es la causa de todos los errores de `npm run lint`. Quitarlo del repositorio (`git rm -r --cached` y `.gitignore`, o moverlo fuera) es decisión del usuario.

Pruebas de BD de la entrega 3: M01–M10 (aislamiento de `marcar_comprado`, cotización ajena, versión de revisión inválida, idempotencia, presupuesto sin gastos, oferta no disponible con precio, reparto sin motivo y sobre el total, concepto `pintura`, observaciones de mercado no visibles entre propietarios). Los nombres de las pruebas de BD (`S01a`…`R01`) son internos y no siempre coinciden con los IDs de aceptación. Las pruebas de concurrencia no se ejecutan.


Entrega 2 (2026-10-19):
| Comando | Resultado |
|---|---|
| `npx tsc -b` | Exit 0 |
| `npx vitest run` | 7 archivos, 76 pruebas superadas |
| `npx eslint src scripts eslint.config.js vite.config.ts` | Exit 0 |

Entrega 1 (sin repetir en esta ronda): `npm run test:bd` 14 superadas; `npm run db:verificar-migraciones` 4 migraciones válidas; `npm run build` exit 0 con aviso de tamaño de chunk (510 kB). Estos resultados corresponden al código anterior a la entrega 2; no deben darse como verificados para el estado actual sin volver a ejecutarlos.

`npm run lint` (`eslint .`) falla solo por las 477 incidencias dentro de `Python/` (rastreado en el commit inicial). El código del proyecto no tiene errores de lint. Quitar `Python/` del repositorio es decisión del usuario.

Durante la conciliación de grúas se intentó instalar Python 3.15 mediante `pymanager` fuera del repositorio. Esa instalación no se revirtió; no afecta al proyecto, pero queda registrada aquí.

## Tarifas IAA y Copart
- Estado: no cargadas. `data/catalogos/perfiles_fees.json` marca `fee_table_status: not_bundled` para los perfiles IAA y Copart.
- Decisión del usuario: no acceder a iaai.com por ahora. Las tablas se capturarán a mano en `data/catalogos/tablas_fees_manual.json` desde fuentes oficiales, con fuente y fecha por versión.
- Dato no verificado, no es tarifa: una consulta anterior sugirió cargos desde el 1 de octubre de 2026 (cuota de servicio USD 105, manejo de título USD 20, imágenes premium USD 10). Requiere verificación del usuario antes de usarse.

## No ejecutado o no verificado
- Navegador: ninguna pantalla se ha probado (Vehículos, EditorCotizacion, Compra, Repuestos, Mercado, Configuración). No hay credenciales de Supabase ni `.env` en este entorno.
- Latencia de la interfaz: no medida. Solo se midió el motor puro.
- Restauración con `pg_dump`/`pg_restore`: no ejecutada; el paquete embebido no los incluye. El ensayo usa respaldo lógico JSON.
- `supabase db push` / Supabase CLI: no ejecutado; no hay proyecto ni credenciales.
- Workflow `publicar.yml` en GitHub: no ejecutado. Despliegue de la función `version` y de Pages: no ejecutado.
- Llamadas reales a vPIC: no ejecutadas; solo pruebas con respuestas simuladas.
- Concurrencia de `marcar_comprado`: no probada.
- Publicación: no autorizada ni ejecutada. No hay URL pública verificada.


## Pendiente de datos y decisiones
- Tablas IAA/Copart: sin cargar; captura manual pendiente.
- Grúas: 282 filas, comparación fila por fila contra el PDF pendiente; discrepancias listadas en `docs/RECONCILIACION_TARIFAS.md`, incluida la fila 29 (PDF muestra USD 350 y el catálogo no tiene importe).
- Embarques: 30 tarifas conciliadas con el PDF; ninguna confirmada por la naviera vigente.
- Revisiones inmutables: función servidor de confirmación no implementada.
- Tipos generados de Supabase: no generados; el acceso a datos usa casts en las pantallas.

## Siguientes acciones mínimas
0. Probar en navegador Compra, Repuestos y Mercado con credenciales de un proyecto Supabase de prueba (teclado incluido).
0b. Implementar el recálculo de la revisión en servidor antes de confiar en el snapshot de `marcar_comprado`.
0c. Decidir si `Python/` (rastreado, 2399 archivos) sale del repositorio; con eso `npm run lint` pasa.
1. Conectar `EditorCotizacion.tsx` al motor nuevo: perfil de fees, modos, tipo de vehículo, comparador de envíos y campos opcionales.
2. Escribir migraciones para los campos nuevos y probarlas con `npm run db:verificar-migraciones` y `npm run test:bd`.
3. Conectar vPIC con `ControladorVin` en el formulario de vehículo; no bloquear por VIN.
4. Confirmar visualmente las discrepancias de grúas (fila 29, filas 30–32, filas 3–6) contra el PDF.
5. Capturar a mano las tablas IAA/Copart en `tablas_fees_manual.json` cuando el usuario las aporte.
6. Implementar la función servidor de revisiones inmutables.

## Reglas de actualización
Registrar solo comandos realmente ejecutados y sus resultados. No marcar una entrega como completa por scripts no ejecutados. No incluir claves ni cadenas de conexión.
