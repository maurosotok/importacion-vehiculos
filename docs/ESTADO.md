# Estado de implementación

## Entrega 1 (implementada en el repositorio; no desplegada)
Vehículos (cotizaciones con datos parciales y pendientes), Repuestos (catálogo de proveedores),
Configuración (perfil de fees, proveedor, pago único manual, rango de gastos locales).
Motor de cálculo puro con Decimal. Migraciones 1–4. Workflow de publicación escrito, no ejecutado.
No hay commit creado. No hay despliegue ni URL pública comprobada.

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
- Documentación: `docs/ARRANQUE_IMPLEMENTADO.md`, `templates/VARIABLES_DESPLIEGUE.md`

## Comandos ejecutados y resultados
Ronda de la entrega 2 (2026-10-19):
| Comando | Resultado |
|---|---|
| `npx tsc -b` | Exit 0 |
| `npx vitest run` | 7 archivos, 76 pruebas superadas |
| `npx eslint src scripts eslint.config.js vite.config.ts` | Exit 0 |

Entrega 1 (sin repetir en esta ronda): `npm run test:bd` 14 superadas; `npm run db:verificar-migraciones` 4 migraciones válidas; `npm run build` exit 0 con aviso de tamaño de chunk (510 kB). Estos resultados corresponden al código anterior a la entrega 2; no deben darse como verificados para el estado actual sin volver a ejecutarlos.

`npm run lint` (`eslint .`) falla solo por la carpeta sin rastrear `Python/` en la raíz, que no es código del proyecto. Eliminarla o moverla fuera del repositorio es decisión del usuario.

Durante la conciliación de grúas se intentó instalar Python 3.15 mediante `pymanager` fuera del repositorio. Esa instalación no se revirtió; no afecta al proyecto, pero queda registrada aquí.

## Tarifas IAA y Copart
- Estado: no cargadas. `data/catalogos/perfiles_fees.json` marca `fee_table_status: not_bundled` para los perfiles IAA y Copart.
- Decisión del usuario: no acceder a iaai.com por ahora. Las tablas se capturarán a mano en `data/catalogos/tablas_fees_manual.json` desde fuentes oficiales, con fuente y fecha por versión.
- Dato no verificado, no es tarifa: una consulta anterior sugirió cargos desde el 1 de octubre de 2026 (cuota de servicio USD 105, manejo de título USD 20, imágenes premium USD 10). Requiere verificación del usuario antes de usarse.

## No ejecutado o no verificado
- Interfaz de la entrega 2 en navegador: no probada; la pantalla aún no usa el motor nuevo.
- `supabase db push` / Supabase CLI: no ejecutado; no hay proyecto ni credenciales.
- Despliegue de la función `version` y de Pages: no ejecutado.
- Llamadas reales a vPIC: no ejecutadas; solo pruebas con respuestas simuladas.
- Publicación: no autorizada ni ejecutada.

## Pendiente de datos y decisiones
- Tablas IAA/Copart: sin cargar; captura manual pendiente.
- Grúas: 282 filas, comparación fila por fila contra el PDF pendiente; discrepancias listadas en `docs/RECONCILIACION_TARIFAS.md`, incluida la fila 29 (PDF muestra USD 350 y el catálogo no tiene importe).
- Embarques: 30 tarifas conciliadas con el PDF; ninguna confirmada por la naviera vigente.
- Revisiones inmutables: función servidor de confirmación no implementada.
- Tipos generados de Supabase: no generados; el acceso a datos usa casts en las pantallas.

## Siguientes acciones mínimas
1. Conectar `EditorCotizacion.tsx` al motor nuevo: perfil de fees, modos, tipo de vehículo, comparador de envíos y campos opcionales.
2. Escribir migraciones para los campos nuevos y probarlas con `npm run db:verificar-migraciones` y `npm run test:bd`.
3. Conectar vPIC con `ControladorVin` en el formulario de vehículo; no bloquear por VIN.
4. Confirmar visualmente las discrepancias de grúas (fila 29, filas 30–32, filas 3–6) contra el PDF.
5. Capturar a mano las tablas IAA/Copart en `tablas_fees_manual.json` cuando el usuario las aporte.
6. Implementar la función servidor de revisiones inmutables.

## Reglas de actualización
Registrar solo comandos realmente ejecutados y sus resultados. No marcar una entrega como completa por scripts no ejecutados. No incluir claves ni cadenas de conexión.
