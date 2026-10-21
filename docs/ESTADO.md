# Estado de implementación

## Ronda 2026-10-20 (correcciones de interfaz y automatización): estado

Sin commit, sin publicación y sin cambios en la base remota. Cotizaciones históricas no modificadas.

### Implementado (código)
- Año ≤ 2010: impuesto L10,000 y gastos locales L11,000. 2011+: impuesto vacío y gastos locales L13,557 editable. Nunca sobrescribe importes capturados; no se valida cilindrada (`src/motor/predeterminados.ts`).
- Botón "Usar pago único (L10,000)" retirado del editor.
- Fees automáticos desde el perfil seleccionado; "Carro + Fees" = Puja + Fees efectivos; "Volver a automático" limpia el fee manual.
- Retirados del formulario principal: "Modo de fees", "Modalidad de puja" y texto técnico de fees. Los datos internos se conservan.
- Aviso de VIN ya guardado (`src/motor/duplicados.ts`, `EditorCotizacion.tsx`): normaliza, excluye la cotización abierta, respuestas viejas ignoradas, no bloquea. Abrir existente es la acción principal.
- Sede "Nashville (TN)": la fila "Nashville Copart - IAA" (US$500) queda como sugerencia pendiente (`resolverGrua` → `pendiente`), no como tarifa aplicada.
- Migración local `supabase/migrations/20261020000100_fees_desglose_y_defaults.sql`: solo local; el estado en el proyecto remoto no se conoce.

### Comandos ejecutados en esta ronda (exit code)
| Comando | Resultado |
|---|---|
| `npm run typecheck` (`tsc -b`) | exit 0 |
| `npm run lint` (`eslint .`) | exit 0, tras excluir `Python/` en `eslint.config.js` |
| `npm test` (`vitest run`) | exit 0: 18 archivos, 206 pruebas superadas |
| `npm run test:bd` | exit 0: 25 pruebas superadas (PostgreSQL 17 embebido, no Supabase) |
| `npm run build` | exit 0; `dist/` generado |

Errores encontrados y corregidos en esta ronda: dos pruebas de duplicados usaban un VIN de 16 caracteres (inválido para la búsqueda, por lo que devolvía vacío); se cambió el fixture a un VIN sintético de 17 caracteres. Un error de lint en `EditorCotizacion.tsx` (`String` sobre `unknown`) se corrigió con `aTextoONulo`.

### Probado unitariamente
- `predeterminados.test.ts`, `fees-sustitucion.test.ts`, `duplicados.test.ts`, `regresion-honda-cr-v-2007.test.ts` (nuevos) pasan.
- Regresión Honda CR-V 2007 (IAA, puja 2000): partidas USD 4135, importado L132,761.19, inversión L152,761.19, utilidad L37,238.81. Se prueba a nivel motor, no en pantalla.

### Probado con BD
- `V01` (nueva): el propietario ve cotizaciones por VIN; otro usuario autenticado no ve ninguna. Usa autenticación real del harness, sin evadir RLS.

### No ejecutado
- Pruebas en navegador de esta ronda: no se ejecutaron. Se decidió no repetir Playwright en esta ejecución.
- Verificación del esquema y catálogos en el Supabase remoto: no se hizo.
- Publicación, workflow de GitHub Actions y commit: no se hicieron.

### Datos pendientes y decisiones del usuario
- VIN de la regresión: `JHLRE38797C00907` tiene 16 caracteres y no pasa la validación de 17. No se completó el dígito faltante.
- L10,000 por año: `CLAUDE.md` indica que L10000 no es una regla por año. Se aplicó la instrucción expresa más reciente del usuario (≤ 2010). Confirmar si debe seguir así.
- Nashville: confirmar si la fila "Nashville Copart - IAA" (FLORIDA, US$500) corresponde a IAA Nashville; mientras tanto queda pendiente.
- Discrepancias Excel vs PDF en grúas (pendientes de decisión): Tampa North IAA 225 vs 265; Orlando - Copart - IAA 200 vs 225; Orlando North y South 200 vs 210; Orlando IAA - Sublot Boggy Greek 225 vs 350; Central New Jersey - IAA 165 vs 275; Richmond - Copart - IAA 270 vs 325; Richmond Doswell - IAA 350 vs 500; Tampa US41 IAA 250 vs 200; Tampa IAA 220 vs 225.
- Denver y Webster (Colorado) tienen origen ARIZONA en el catálogo; las búsquedas de CO no las encuentran.
- `Python/` está rastreado en git (2399 archivos, intérprete Python embebido en el repositorio). Decidir si debe quedar fuera del control de versiones. No se borró nada.
- `Configuracion.tsx` aún muestra el ajuste `pago_unico_hnl`.

### Siguientes acciones mínimas
1. Probar en navegador el editor (año, fees, VIN duplicado, Nashville) con la autenticación real de Supabase.
2. Decidir las discrepancias de grúas y la etiqueta de Nashville.
3. Autorizar, si aplica, la revisión del esquema remoto para la migración `20261020000100`.

## Ronda 2026-10-20 (autocompletado del editor): cambios y verificación

Implementado en código. No probado en navegador ni contra Supabase remoto.
- Título del editor: se calcula en vivo desde marca, modelo y año. Antes usaba la fila inicial y mostraba "Vehículo sin datos".
- Sede o ubicación: si la sede coincide con una sola zona de salida en el catálogo de grúas, y la zona está vacía o aún es la sugerida anterior, se fija la zona (`zonaSugerida` y pruebas en `src/motor/gruas.ts` y `src/motor/gruas.test.ts`).
- Subasta IAA: si la cotización no tiene perfil, se selecciona `iaa_standard_volume`.
- Cotización nueva: si no hay fila en `user_settings`, gastos locales (L13,557) y papelería (US$15) usan los predeterminados de la regla. Si existe la fila, prevalece su valor.
- Sin coincidencia: el editor muestra "Grúa no encontrada para esta sede y zona" o "Barco no encontrado para este tipo y zona", con captura manual.
- Etiqueta de grúa: se quitan las partes duplicadas. El texto fuente sigue duplicado (ver limitaciones).
- Pruebas nuevas: `src/motor/gruas.test.ts` (5 pruebas) con `data/catalogos/gruas_desde_excel.json`: Tampa North en FLORIDA resuelve a US$225 único; sugiere FLORIDA; Nashville resuelve una sola fila (FLORIDA, US$500.00); sin coincidencia no sugiere zona ni tarifa; una sede en varias zonas no sugiere zona.

Verificado por lectura de código (no en ejecución):
- `cargarEditor` consulta `fee_profiles`, `vehicle_type_mappings`, `shipping_rates` (USD), `towing_rates`, `user_settings` y `fee_schedule_versions`. Los nombres de columna coinciden con `supabase/migrations/20261019000200_catalogos_y_preferencias.sql`.
- RLS está aplicada a todas las tablas de catálogo (`aplicar_politica_propietario` en la migración 20261019000200).
- Los códigos de tipo, zona, perfil y categoría de `data/catalogos/*.json` coinciden con las opciones del formulario.
- La puja recalcula los fees en vivo, sin depender de zona ni tipo (`resolverFees`).

Comandos ejecutados en esta ronda (exit code):
| Comando | Resultado |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npx eslint src scripts eslint.config.js vite.config.ts` | Exit 0 |
| `npx vitest run` | Exit 0: 14 archivos, 173 pruebas superadas |
| `npm run build` | Exit 0 |
| `npm run db:verificar-migraciones` | Exit 0 |
| `npm run test:bd` | Exit 0: 24 pruebas superadas (PostgreSQL 17 embebido, no Supabase) |

No ejecutado o no verificado:
- Navegador: no se completó ninguna prueba. Un intento de abrir la app con `openBrowserPage` quedó bloqueado por tiempo de espera y se canceló. Tampoco se simuló autenticación: la verificación en navegador requiere una sesión real de Supabase.
- Supabase remoto: no verificado. El entorno no tiene `DATABASE_URL`, `APP_OWNER_USER_ID` ni sesión, y RLS impide leer catálogos sin sesión. No se sabe si los catálogos existen en el proyecto real.
- `npm run lint` en la raíz: no ejecutado en esta ronda; en la anterior falló por 477 errores dentro de `Python/`.
- Fixtures de simulación de navegador: se generaron en la carpeta temporal del sistema, fuera del repositorio, y no se usaron. No reemplazan catálogos ni configuración.

Conteos esperados en Supabase tras `catalogos:importar` (desde el repositorio, no verificados en remoto): `fee_profiles` 10, `towing_rates` 282, `shipping_rates` 30 (USD), `vehicle_type_mappings` 24, `fee_schedule_versions` 1, `logistics_providers` 4, `suppliers` 45, `user_settings` 1.

Resultado del caso Nashville (catálogo, no remoto):
- Sede "Nashville" resuelve a una sola fila: "Nashville Copart - IAA", zona FLORIDA, US$500.00. TN no es zona de salida del formulario.
- La fila dice "Copart" aunque la subasta sea IAA, y su zona viene del archivo fuente. Confirmar antes de usarla.

Limitaciones:
- Tipo de cambio predeterminado: no hay valor en el repositorio; la cotización nueva lo deja vacío.
- Texto de origen de grúas duplicado (p. ej. "Tampa North IAATampa North IAA $225.00$225.00"). El importador lo carga tal cual en `towing_rates.etiqueta_origen` y `etiqueta`; la limpieza requiere cambiar el importador o los datos.
- Grúa y barco se calculan al cambiar sede, zona o tipo. Una cotización guardada no se recalcula al abrirla.
- Fallback de solo lectura desde JSON en el navegador: no implementado. Incluir las tarifas en el bundle las publicaría antes del inicio de sesión, lo que contradice la regla de fuentes privadas.

Para que el autocompletado funcione con el usuario real:
1. Aplicar `supabase/migrations/20261020000100_fees_desglose_y_defaults.sql` en el proyecto Supabase real (autorización requerida).
2. Ejecutar `npm run catalogos:importar` con `DATABASE_URL` y `APP_OWNER_USER_ID` del propietario ya registrado (autorización requerida). Tablas afectadas: `fee_profiles`, `towing_rates`, `shipping_rates`, `vehicle_type_mappings`, `logistics_providers`, `suppliers`, `user_settings` (una fila) y `fee_schedule_versions`.
3. Iniciar sesión en la app con su usuario, crear una cotización y probar: sede Tampa North, zona FLORIDA, tipo SUV, puja 2000. Esperado: grúa 225, barco 825, fees 795, carro + fees 2795, papelería 15, gastos locales 13557. Luego repetir con 3500, 3750 y 4000, y con Nashville. Guardar, recargar y reabrir.

## Ronda 2026-10-20 (corrección definitiva): estado verificado

Etiquetas: implementado · probado unitariamente · probado con BD · probado en navegador · pendiente de autorización · no implementado.

### Probado unitariamente (Vitest: 13 archivos, 168 pruebas superadas)
- Tabla IAA Standard Volume en `data/catalogos/tablas_fees_manual.json`: versión `standard_volume_vigente_2024-11-04`, `fechaFuente` 2024-11-04 (vigencia), `fechaArchivo` 2024-10-23 (solo el nombre del archivo). 40 tramos `[desde, hasta)`, `estado: captura_manual`, única modalidad `internet_live`.
- Cargos: Internet Bid Fee 110 en [2000, 4000) y 125 en [4000, 4001) (`caso_real`); Service Fee 105, Environmental Fee 25 y Title Handling Fee 20 en [2000, 4001). No se extrapolan a otros rangos. La puja 4000 usa 125 y no 110.
- Ejemplos de fees (puja → fees total · carro+fees): 2000 → 795 · 2795; 3500 → 965 · 4465; 3750 → 965 · 4715; 4000 → 1000 · 5000. Puja 2500 → 870 (tramo 610 + 110 + 105 + 25 + 20).
- Puja 4500, fuera del rango de cargos: `cargo_sin_cobertura`, sin total parcial (`src/motor/caso107.test.ts`).
- Caso 107 (`data/fixtures/caso_107.json`): efectivo USD 3,860.00; importado L166,874.48; inversión L186,874.48; utilidad L33,125.52; equivalente USD 6,174.11 (`src/motor/caso107.test.ts`).
- Editor, lógica pura (`src/lib/formulario.test.ts`, 8 pruebas nuevas): calcula 795 con la modalidad única documentada; no toca el campo manual de fees; sin tabla o con puja vacía no produce total; guarda versión y desglose solo en modo tabla.

### Probado con BD (PostgreSQL 17 embebido; no es el proyecto Supabase)
- Migración local `supabase/migrations/20261020000100_fees_desglose_y_defaults.sql`: `modalidad_puja`, `fees_version`, `fees_desglose` en `quotes`; `fee_schedule_versions.contenido` con índice único por propietario, perfil y etiqueta; en `user_settings`, gastos locales predeterminados 13,557 HNL, papelería 15 USD y tipo de cambio predeterminado (opcional). Aplicada en el PostgreSQL embebido por `test:bd` y `db:ensayar-restauracion`. **Pendiente de autorización** en Supabase remoto.

### Implementado, no probado en navegador
- `EditorCotizacion`: tabla automática de fees por perfil; selector de modalidad de puja; "Volver a tarifa automática" en fees; al guardar en modo tabla, se guardan versión y desglose de fees. Grúa y barco se sugieren al cambiar ubicación, zona o tipo (`tarifaGruaAutomatica` y `tarifaBarcoAutomatica` son privadas y no tienen prueba propia). "Puja máxima manual" se quitó de la pantalla; la columna se conserva.
- `Vehiculos.nueva()`: copia a la cotización nueva el perfil, los gastos locales, la papelería y el tipo de cambio predeterminados.
- `Configuracion`: gastos locales, papelería general y tipo de cambio predeterminados, validados antes de guardar.

### Limitaciones de esta ronda
- Impuestos: solo manuales. Los gastos locales de 13,557 son un valor predeterminado editable que se copia a cada cotización nueva; no hay regla por año.
- Papelería por naviera: no implementada. Solo existe la papelería general predeterminada.
- Precio de venta sugerido desde Mercado: no conectado al editor de cotización. `src/paginas/Mercado.tsx` muestra la sugerencia desde la media, sin prueba en navegador.

### No implementado
- S02: `marcar_comprado` confía en el snapshot del cliente; no hay recálculo en servidor.
- S03: no hay función servidor que confirme revisiones inmutables.
- Tabla Copart: no cargada.

### Comandos ejecutados en esta ronda (exit code)
| Comando | Resultado |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npx vitest run` | Exit 0: 13 archivos, 168 pruebas superadas |
| `npx eslint src scripts eslint.config.js vite.config.ts` | Exit 0 |
| `npm run build` | Exit 0; aviso de tamaño de chunk |
| `npm run db:verificar-migraciones` | Exit 0: 6 migraciones válidas |
| `npm run test:bd` | Exit 0: 24 pruebas superadas |
| `npm run db:ensayar-restauracion` | Exit 0: origen y destino coinciden; la reimportación no duplica catálogos |

### No ejecutado o no verificado
- `npm run lint` en la raíz: no ejecutado en esta ronda. En la anterior falló por 477 errores dentro de `Python/`.
- Navegador (escritorio y 390 px): no ejecutado. Requiere credenciales de un proyecto de prueba.
- Remoto: migración 20261020000100 no aplicada; `catalogos:importar` no ejecutado; `disable_signup` y variables de GitHub no verificados. Requiere autorización.
- Workflow, Supabase CLI y publicación: no ejecutados. El workflow ejecuta `supabase db push` en producción, así que publicar requiere autorización explícita.
- Concurrencia de `marcar_comprado` y llamadas reales a vPIC: no probadas.
- Commit: ninguno. El árbol tiene cambios sin commit de esta y de rondas anteriores.

## Ronda 2026-10-20: EditorCotizacion conectado al motor
Implementado en código (no probado en navegador):
- `EditorCotizacion` carga perfiles de fees (solo `seleccionable`), tarifas de grúa, mapeos de tipo, tarifas de barco USD y ajustes (pago único, perfil favorito).
- Perfil inicial: en cotizaciones nuevas, favorito guardado o predeterminado seleccionable (`Vehiculos.nueva()`). El editor muestra el perfil guardado, incluido "Sin perfil" si el usuario lo eligió; no aplica un valor por defecto al cargar.
- Configuración: el selector muestra el favorito guardado o, si no hay, el predeterminado seleccionable (IAA Standard Volume). No hay opción "Sin perfil" separada; sin favorito guardado, el valor mostrado es el predeterminado y solo se persiste al guardar. Perfiles sin tabla cargada se marcan como tales; el total de fees se captura a mano.
- Grúa: sugerencia por ubicación con "Usar tarifa" / "Volver a tarifa", opciones si hay tarifas distintas, aviso si hay coincidencias sin importe, procedencia visible.
- Barco: "Usar referencia" / "Volver a tarifa", procedencia visible.
- VIN: consulta vPIC al completar 17 caracteres; solo rellena marca, modelo y año vacíos; no bloquea el guardado.
- Campos opcionales: vendedor, fecha de subasta (formato AAAA-MM-DD validado), puja máxima manual, verificación Bid.cars.
- Tipo "Van / minivan"; "Puerto de salida (zona)"; "Sede o ubicación".
- `Vehiculos.nueva()` guarda el perfil favorito o el predeterminado en la cotización nueva.
- Adaptador `src/lib/formulario.ts` con pruebas en `src/lib/formulario.test.ts` (9 pruebas).

Ejecutado en esta ronda, sobre el árbol actual:
| Comando | Resultado |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npx eslint src scripts eslint.config.js vite.config.ts` | Exit 0 |
| `npm test` | 12 archivos, 139 pruebas superadas |
| `npm run build` | Exit 0 (aviso de tamaño de chunk; JS 568.03 kB, gzip 165.55 kB) |
| `npm run test:bd` | 24 pruebas superadas (PostgreSQL 17 embebido local, no el proyecto Supabase) |

No reejecutados en esta ronda (sin cambios en migraciones ni scripts desde la ronda anterior): `npm run db:verificar-migraciones`, `npm run db:ensayar-restauracion`.

Remoto (proyecto Supabase real): no verificado en esta ronda. No hay `DATABASE_URL` ni lectura de conteos disponible en este entorno, y no se ejecutó `npm run catalogos:importar`. Los conteos de catálogos en la base remota siguen pendientes.

Navegador: solo una lectura de la pantalla de acceso en `http://127.0.0.1:5173/` (árbol de accesibilidad: campos Correo y Clave y botón Entrar). No se inició sesión, no se probó el editor, el autoguardado, el conflicto, Ctrl+S, vPIC en vivo, Compra, Repuestos ni Mercado, ni la vista móvil. El servidor de desarrollo se detuvo al final de la ronda.

Autorización del propietario (revisada por lectura de migraciones y código):
- Todas las tablas privadas tienen RLS con `owner_id = auth.uid()` y `es_propietario()`; `quote_revisions` solo permite lectura.
- `App.tsx` exige una fila en `app_owner` antes de mostrar la aplicación; `app_owner` tiene un índice único y no admite inserciones de clientes.
- `marcar_comprado` verifica `es_propietario()` y que la cotización sea del usuario.
- Pendiente en vivo: que el proyecto Supabase real tenga el registro público desactivado (en la ronda anterior, `GET /auth/v1/settings` devolvió `disable_signup: false`; el cambio no se aplicó).

Pendiente para usar la aplicación de punta a punta:
- Estado de la cotización (borrador, comprada, no ganada) y motivo de pérdida: no hay controles en el editor.
- Comparador de navieras (`logistics_offers`): no conectado al editor.
- El perfil favorito se guarda en Configuración; no se puede fijar desde el editor.
- Catálogos en la base remota (grúas, perfiles, tarifas, usuario propietario): no verificados; la carga inicial no se ha ejecutado contra producción.
- Tablas IAA y Copart: sin cargar; captura manual pendiente.
- Recálculo en servidor en `marcar_comprado` (S02) y función servidor de revisiones confirmadas (S03): no implementados.
- Variables de GitHub (`vars` del entorno `produccion`): no verificadas (`gh` no instalado).
- `Python/` rastreado: causa todos los errores de `npm run lint` en la raíz; la decisión de quitarlo es del usuario.

Pasos para probar la aplicación (requieren credenciales de un proyecto de prueba, no de producción):
1. Crear el usuario propietario en Authentication > Users del proyecto de prueba y registrarlo con `npm run admin:alta-propietario` (variables de servidor, fuera del repositorio).
2. Cargar catálogos con `npm run catalogos:importar` contra el mismo proyecto de prueba.
3. `npm run dev`, abrir `http://localhost:5173`, iniciar sesión y probar: crear cotización desde Vehículos, escribir un VIN completo, capturar puja y fees, usar la tarifa de grúa, cambiar el tipo de cambio, guardar, recargar la página y reabrir la cotización.
4. Repetir el paso 3 en una ventana de ancho móvil (390 px).

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
- IAA Standard Volume: capturada a mano en `data/catalogos/tablas_fees_manual.json` (`captura_manual`), vigencia 2024-11-04. Pendiente confirmar la transcripción contra la fuente oficial. Sin importar en Supabase.
- Copart: no cargada. Los otros perfiles de `data/catalogos/perfiles_fees.json` tienen `fee_table_status: not_bundled`.
- Decisión del usuario: no acceder a iaai.com. No se vuelve a consultar ese sitio.
- Dato no verificado, no se usa: una consulta anterior sugirió cargos con vigencia desde el 1 de octubre de 2026 (cuota de servicio USD 105, manejo de título USD 20, imágenes premium USD 10). La tabla capturada usa vigencia 2024-11-04.

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
- Tabla IAA Standard Volume: capturada, confirmación contra la fuente pendiente. Copart: sin cargar.
- Grúas: 282 filas, comparación fila por fila contra el PDF pendiente; discrepancias listadas en `docs/RECONCILIACION_TARIFAS.md`, incluida la fila 29 (PDF muestra USD 350 y el catálogo no tiene importe).
- Embarques: 30 tarifas conciliadas con el PDF; ninguna confirmada por la naviera vigente.
- Revisiones inmutables: función servidor de confirmación no implementada.
- Tipos generados de Supabase: no generados; el acceso a datos usa casts en las pantallas.

## Siguientes acciones mínimas
1. Probar en navegador (escritorio y 390 px) el flujo: crear cotización, VIN, puja 2000 → fees 795, grúa y barco automáticas, guardar, recargar y reabrir. Requiere credenciales de un proyecto Supabase de prueba.
2. Decidir la forma de S02/S03: port a SQL o Edge Function que use el motor TS compartido. Decisión de diseño del usuario.
3. Probar `tarifaGruaAutomatica` y `tarifaBarcoAutomatica`: moverlas a un módulo puro y cubrirlas con pruebas.
4. Conectar la sugerencia de precio de venta desde Mercado al editor de cotización.
5. Papelería por naviera: decidir el vínculo entre `logistics_providers` y `shipping_rates.proveedor`.
6. Con autorización: aplicar `20261020000100` e importar catálogos en un proyecto de prueba antes de producción; después, producción con confirmación explícita.
7. Confirmar la transcripción de la tabla IAA contra la fuente oficial (sin acceder a iaai.com).
8. Decidir si `Python/` (rastreado, 2399 archivos) sale del repositorio; con eso `npm run lint` pasa.
9. Verificar en Supabase real: registro público desactivado y variables `VITE_*` en el entorno `produccion`.
10. Commit de los cambios locales: solo si el usuario lo pide.

## Reglas de actualización
Registrar solo comandos realmente ejecutados y sus resultados. No marcar una entrega como completa por scripts no ejecutados. No incluir claves ni cadenas de conexión.
