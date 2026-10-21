# Checklist de aceptación - estado real a 2026-10-21

Fuente de los IDs: `docs/PRUEBAS_ACEPTACION.md`. Nada de esta lista se da por verificado sin
ejecución registrada. Los IDs de las pruebas de BD (`S01a`, `M01`…`R01`) son nombres internos de
`scripts/db/ejecutar-pruebas-bd.mjs`; no siempre corresponden al mismo caso de aceptación.

Estados:
- **Pasa (motor)**: prueba Vitest en `src/**/*.test.ts` que pasa en la última ejecución.
- **Pasa (BD)**: prueba en PostgreSQL 17 embebido (`npm run test:bd`) que pasa.
- **Parcial**: hay prueba de motor o de BD, pero falta el resto del escenario (casi siempre la pantalla).
- **Pendiente UI**: depende de `EditorCotizacion` u otra pantalla que no está conectada o no se probó en navegador.
- **No cumplida**: falta implementación.
- **Pendiente en vivo**: depende de un proyecto Supabase, GitHub Actions o Cloudflare que no se ejecutó.

## Experiencia sin bloqueos
| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| UX01 | Parcial | Pasa (motor) `calculo.test.ts`: SUV con Delaware usa US$1020 sin medidas | Pantalla de vehículo |
| UX02 | Parcial | Pasa (motor) `calculo.test.ts`: tipo sin categoría queda sin tarifa | Selector y aviso en pantalla |
| UX03 | Pendiente UI | Sin prueba | Guardar con tarifa 2025 sin confirmación en pantalla |
| UX04 | Parcial | Pasa (motor) `calculo.test.ts`: partida pendiente no cuenta cero | Fila "Se cotiza" en pantalla |
| UX05 | Parcial | Pasa (motor) `vin.test.ts`: ausente/incompleto no bloquea | vPIC no conectado al formulario |
| UX06 | Parcial | Pasa (motor) `duplicados.test.ts`: normaliza VIN, excluye la cotización abierta, ordena de más reciente; no busca VIN incompleto. Pasa (BD) `V01`: otro usuario no ve cotizaciones ajenas por VIN | Aviso y botones en pantalla; no probado en navegador |
| UX07 | Pendiente UI | Sin prueba | Cálculo y guardado sin sede |
| UX08 | Pendiente UI | Sin prueba | Marcado de campo inválido sin perder texto |
| UX09 | Parcial | Pasa (motor) `vin.test.ts`: respuesta vieja descartada | Sin prueba de no sobrescribir edición manual |
| UX10 | Parcial | Pasa (motor) `calculo.test.ts`: grúa manual no se reemplaza; "Volver a tarifa" sí | Botón en pantalla |

## Fees y fiscal manual
| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| F01 | Pendiente UI | `data/catalogos/perfiles_fees.json` tiene IAA como predeterminado | Selección por usuario nuevo en pantalla |
| F02 | Pendiente UI | Sin prueba | Recordar perfil Copart en pantalla |
| F03 | Parcial | Pasa (motor) `fees.test.ts`: sin tabla devuelve `sin_tabla`, nunca cero | Perfil seleccionable con total manual en pantalla |
| F04 | Parcial | Pasa (motor) `fees.test.ts` y `caso107.test.ts`: cortes exactos, justo debajo, redondeo del porcentaje; tabla IAA Standard Volume con vigencia 2024-11-04 (`captura_manual`; 2024-10-23 solo es el nombre del archivo) | Confirmar la transcripción con la fuente oficial; procedencia en pantalla |
| F05 | No verificado | Sin prueba explícita | Confirmar que no se duplican componentes ni se confunde papelería |
| F06 | Pasa (motor) | `calculo.test.ts`: carro+fees 2995 con puja 2200 da fee 795 | — |
| F07 | Parcial | Pasa (motor) `fees.test.ts` y `fees-sustitucion.test.ts`: fee manual 800 sustituye la tabla 795; al borrarlo vuelve a 795 | Procedencia visible en pantalla; tabla oficial no cargada; no probado en navegador |
| F08 | Pasa (motor) | `calculo.test.ts`: puja mayor no deriva fee negativo y avisa | — |
| F10 | Pasa (motor) | `caso107.test.ts`: puja 2000 reproduce fees 795 (535+110+105+25+20), carro+fees 2795, efectivo 3860, importado 166874.48, utilidad 33125.52 | Mismos valores en el editor, en navegador |
| F11 | Pasa (motor) | `caso107.test.ts`: puja 4500, fuera de la cobertura de los cargos, devuelve `cargo_sin_cobertura`, no un total parcial. La puja 2500 sí está cubierta: tramo 610 + 110 + 105 + 25 + 20 = 870 | Fees pendientes con entrada manual en pantalla |
| T01 | Pasa (inspección) | Búsqueda en `src/`, `supabase/` y `scripts/`: no hay llamadas a SARAH ni cálculo fiscal por año, motor u origen | Sin prueba automatizada; `scripts/verificar_paquete.py` solo comprueba que no hay algoritmo previo empaquetado y no se ejecutó en esta ronda |
| T02 | Pasa (motor) | `calculo.test.ts`: cambiar puja conserva impuesto manual con avisos | Nota en pantalla |
| T03 | Pasa (motor) | `calculo.test.ts`: total combinado 50297.89 se suma una vez | — |
| T04 | Pasa (motor) | `calculo.test.ts`: 10000 + 21000 da 31000 | — |
| T05 | Parcial | Código: el botón "Usar pago único (L10,000)" se retiró del editor; los importes por año los fija `predeterminados.test.ts` (2007 → 10000/11000; 2011 → vacío/13557) | Ajuste `pago_unico_hnl` aún visible en `Configuracion.tsx`; sin prueba en navegador |
| T06 | Pasa (motor) | `reglas.test.ts`: cambiar a desglose guarda el total como referencia; no se mezclan modos | Interfaz de los dos modos |
| T07 | Pasa (motor) | `calculo.test.ts`: impuesto no ingresado queda pendiente, nunca cero | Estado parcial en pantalla |

## Dinero y ciclo de compra
| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| M01 | Pasa (motor) | `caso104.test.ts`: importado, inversión y utilidad de la corrección explícita | — |
| M02 | Pasa (motor) | `caso104.test.ts`: diferencia con el Excel original es solo W101 y V101 | — |
| M03 | Pasa (motor) | `calculo.test.ts`: tipo de cambio ausente o cero no produce NaN ni conversión falsa | Borrador guardable en pantalla |
| M04 | Parcial | Pasa (motor) `revision.test.ts`: cambios posteriores no alteran la revisión; versión de fees guardada | Prueba con versión de tarifa posterior en BD |
| M05 | Parcial | Pasa (BD) `R01`: versión de fila obsoleta no sobrescribe cambios | Autoguardado y dos pestañas en navegador |
| P01 | Parcial | Pasa (BD) `M04`, `M05`: marcar dos veces devuelve la misma compra | Guardia de doble clic en navegador (no probada) |
| P02 | Pasa (motor) | `compra.test.ts`: reparación se separa de costos; presupuesto no es gasto real | — |
| P03 | Pasa (motor + BD) | `repuestos.test.ts`: ofertas con gasto no se cuentan dos veces; Pasa (BD) `S07` | — |
| P04 | No verificado | Sin prueba | Gasto con fecha de compra y de pago distintas |
| P05 | No verificado | Sin prueba explícita | Gasto de gasolina o servicio sin SKU |
| P06 | Parcial | Pasa (BD) `M07`, `M08`: reparto sin motivo y sobre el total se rechazan | Suma de la parte asignada una vez en pantalla |
| P07 | Parcial | Pasa (motor) `repuestos.test.ts`: precio cero no gana; sin consulta vacío | Caso textual "No" sin prueba propia |
| P08 | Pasa (motor) | `compra.test.ts`: sin precio de venta no inventa utilidad | — |
| P09 | Parcial | Pasa (motor) `utilidades.test.ts`: promedio solo de precios conocidos, criterios visibles | Edición manual del precio objetivo en pantalla; no hay `mercado.test.ts` propio |

## Correcciones de interfaz y automatización (ronda 2026-10-20)
| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| A01 | Pasa (motor) | `predeterminados.test.ts`: 2007 y 2010 → 10000/11000; 2011 → vacío/13557; importes capturados no se consideran automáticos | Aplicación en pantalla no probada en navegador |
| A02 | Pasa (motor) | `caso107.test.ts` y `fees-sustitucion.test.ts`: 795 automático, manual 800 sustituye, borrar vuelve a 795 | Pantalla "Carro + Fees" y "Volver a automático" no probadas en navegador; 3500/3750/4000 cubiertos en `caso107.test.ts` |
| A03 | Pasa (motor + BD) | `duplicados.test.ts` (normalización, exclusión, orden); `V01`: RLS impide ver cotizaciones ajenas por VIN | Aviso y botones en navegador no probados |
| A04 | Pasa (motor) | `regresion-honda-cr-v-2007.test.ts`: 4135 / 132761.19 / 152761.19 / 37238.81 | Mismos valores en el editor, en navegador. La cotización guardada conserva el VIN de 16 caracteres; corregirla desde el editor requiere autorización del usuario |
| A05 | Parcial | `gruas.test.ts`: Nashville con IAA o COPART da US$500 (confirmación del usuario 2026-10-21); sin subasta, otro estado o sin estado queda pendiente | Pantalla no probada; revisión visual de la página 9 del PDF |

## Datos y producción
| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| D01 | Pasa (BD) | `D01`: sin cotizaciones, compras, precios ni ofertas históricas; ensayo de restauración comprueba tablas históricas vacías | — |
| D02 | Parcial | Ensayo de restauración: la reimportación insertó 0 filas | No se comprueba que no sobrescriba ajustes del usuario |
| D03 | Parcial | Escaneo de `dist/` sin claves ni XLSX ni estados bancarios; `.gitignore` cubre `fuentes_privadas/`, `.env`, `backups/` | Bundle no inspeccionado en producción; `Python/` rastreado (ver ESTADO) |
| S01 | Pasa (BD) | `S01a`, `S01b`, `S01c`, `S04b`: otro owner no lee ni escribe, ni por IDs relacionados | — |
| S02 | Parcial | Pasa (BD) `S02`: suplantar owner_id queda bloqueado por RLS | **No cumplida**: el servidor no recalcula totales; `marcar_comprado` confía en el snapshot del cliente |
| S03 | Parcial | Pasa (BD) `S03a`, `S03b`: revisión confirmada inmutable | **No cumplida**: función servidor de confirmación de nueva revisión |
| S04 | Pasa (BD) | `S04a`–`S04d`: anónimo sin acceso; ningún alta de propietario desde el navegador; un solo propietario | Registro público desactivado en el proyecto Supabase real: pendiente en vivo |
| R01 | Pendiente en vivo | Workflow ordena calidad, pruebas de BD y luego publicación | No ejecutado en GitHub |
| R02 | Parcial | Workflow se detiene en el primer fallo; recuperación documentada en `docs/OPERACION.md` §4 | No ejecutado |
| R03 | Pendiente en vivo | Un workflow, una Pages, un proyecto Supabase en configuración | No hay URL ni proyecto verificados |
| R04 | Pasa (ensayo local) | `npm run db:ensayar-restauracion`: origen y destino coinciden en filas, RLS, políticas y funciones | Respaldo lógico JSON, no `pg_dump`; copia previa a migraciones sigue manual |

## Ronda 2026-10-21: tarifas PDF, Nashville, VIN, listado y archivado
| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| RV01 | Pasa (BD) | `C07`: corrección de las nueve tarifas aplicada dos veces, idempotente, respeta ediciones y cotizaciones; motor en `gruas.test.ts` | Migración `20261021000100` no aplicada en remoto; sin revisión visual de los importes en la pantalla |
| RV02 | Pasa (motor) | `gruas.test.ts`: Nashville con IAA o COPART da US$500, zona FLORIDA | Confirmación en pantalla no probada |
| RV03 | Pasa (motor) | `gruas.test.ts`: sin subasta, con TX o KY, o sin estado no aplica tarifa | Mensaje en pantalla no probado |
| RV04 | Pasa (motor) | `historial-subastas.test.ts`: VIN de 17 caracteres válido; `JHLRE38797C00907` marcado incompleto | Editor en navegador no probado |
| RV05 | Pasa (BD) | `C08`: la corrección de VIN conserva la cotización y la compra | Corrección real del VIN guardado requiere autorización |
| RV06 | Pasa (motor + BD) | `historial-subastas.test.ts` y `C06`: VIN repetido no bloquea | Aviso en navegador no probado |
| RV07 | Pasa (motor) | `listadoVehiculos.test.ts`: orden ascendente, nulos al final, sin desfase UTC | Listado en navegador no probado; requiere `20261021000200` en remoto |
| RV08 | Pasa (motor) | `listadoVehiculos.test.ts`: filtros por defecto y "Mostrar todas" | Listado en navegador no probado |
| RV09 | Parcial | `C01`: vendido por cotización con RLS | Sin prueba del botón en la lista ni del campo en el formulario |
| RV10 | Parcial | `C02` y `C05`: archivado conserva compras, gastos y revisiones | Sin prueba en navegador de confirmación, doble clic ni texto de borrador |
| RV11 | Pasa (BD) | `C03`: otro usuario no archiva | — |
| RV12 | Pasa (BD) | `C04`: DELETE físico denegado a `authenticated` | — |
| RV13 | Pasa (BD) | `C05`: restaurar devuelve la cotización | Sin botón de restauración en la interfaz |

## Resumen
- Motor y BD: los casos de dinero, fees, impuestos manuales, compras y seguridad de datos tienen pruebas que pasan.
- Regresión Honda CR-V 2007 (IAA, puja 2000, grúa 500, barco 825): `regresion-honda-cr-v-2007.test.ts` pasa con partidas 4135, importado L132,761.19, inversión L152,761.19, utilidad L37,238.81. El VIN completo confirmado por el usuario es `JHLRE38797C009075` (17 caracteres). La cotización guardada tiene `JHLRE38797C00907` (16 caracteres); corregirla requiere autorización.
- `EditorCotizacion` ya usa la tabla de fees y el motor nuevo (sin prueba en navegador). Faltan las pruebas en pantalla de UX, perfiles, impuestos, grúa y barco.
- No cumplidos: recálculo de servidor en `marcar_comprado` (S02) y confirmación servidor de revisiones (S03).
- Pendiente en vivo: publicación, registro público en Supabase real, URL de Pages, pruebas en navegador.
