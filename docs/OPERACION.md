# Operación del Cotizador Honduras

Estado: el sistema no está publicado por esta entrega. Ningún comando de este documento se ejecutó
contra producción. Los resultados verificados en el repositorio están en `docs/ESTADO.md`.

## 1. Ingreso y usuarios
- Acceso solo por correo y clave (`supabase.auth.signInWithPassword`). No hay registro público:
  `supabase/config.toml` tiene `enable_signup = false`, y en el proyecto Supabase debe estar
  desactivado el registro público (Authentication > Sign In / Providers).
- El propietario se crea una vez, a mano, en Authentication > Users. Después se registra en la
  tabla `app_owner` con `npm run admin:alta-propietario` usando la cadena de conexión de servidor
  (`DATABASE_URL`) y `APP_OWNER_USER_ID`. El script se niega a crear un segundo propietario
  (índice único sobre `app_owner`). Ningún cliente puede insertar en `app_owner`.
- Las tablas con datos privados tienen RLS con `owner_id = auth.uid()` en lectura y escritura;
  un usuario que no es el propietario registrado no ve ni escribe nada.

## 2. Catálogos, tarifas y perfiles
- Carga inicial: `DATABASE_URL=<servidor> APP_OWNER_USER_ID=<uuid> npm run catalogos:importar`.
  Carga 282 grúas, 30 tarifas de embarque, 4 navieras, 45 proveedores de repuestos, 24 mapeos de
  tipo de vehículo, 10 perfiles de fees y las preferencias iniciales. No carga cotizaciones,
  compras, gastos, ofertas de navieras ni precios históricos. El caso 104 nunca se importa.
- La carga es idempotente por clave estable: repetirla no duplica filas ni sobrescribe ajustes del
  usuario (verificado en el ensayo de restauración: la segunda carga insertó 0 filas).
- Perfiles de fees (`data/catalogos/perfiles_fees.json`):
  - `iaa_standard_volume` (IAA Standard Volume Buyer Fees) es el predeterminado.
  - 9 perfiles tienen `fee_table_status: not_bundled`: sin tabla de tramos cargada. Son
    seleccionables y el usuario captura el total manual; no se muestran importes inventados.
  - 1 perfil está marcado `manual`.
- Las tablas oficiales IAA y Copart no están cargadas. Para cargarlas se capturan a mano en
  `data/catalogos/tablas_fees_manual.json`, con fuente y fecha por versión, y luego se importan.
  No se accede a sitios de subasta para esto.
- Las grúas tienen 282 filas. La comparación fila por fila contra el PDF sigue pendiente; la fila 29
  (USD 350 en el PDF, sin importe en el catálogo) está listada en `docs/RECONCILIACION_TARIFAS.md`.
- Las tarifas de referencia se usan sin advertencia y sin bloquear; su antigüedad se muestra en el
  detalle.

## 3. Impuestos y gastos de salida (solo manual)
- No hay cálculo fiscal ni llamadas a SARAH. El impuesto se captura a mano en uno de dos modos
  excluyentes:
  1. Total combinado en HNL: una sola cifra que incluye impuestos y gastos locales.
  2. Desglose: impuestos + gastos locales (matrícula, IP, agente aduanero, votainer, otros).
- Nunca se suman ambos modos. L10000 es un acceso rápido que el usuario pulsa a propósito; no se
  aplica por año, motor ni origen. Los rangos de referencia L20000–21000 son solo informativos.
- Cambiar la puja, el flete o el tipo de cambio conserva el impuesto manual y muestra un aviso
  informativo; no exige recalcular ni confirmar.
- Un impuesto no ingresado deja la cotización en estado pendiente. No se trata como cero.

## 4. Copia de seguridad y restauración
- Ensayo de restauración (sin tocar producción): `npm run db:ensayar-restauracion`.
  Levanta PostgreSQL 17 embebido en una carpeta temporal, aplica las migraciones del repo, carga
  catálogos, exporta todas las tablas a JSON, restaura en una base nueva aplicando las mismas
  migraciones, y compara conteos, RLS, políticas y funciones. Después comprueba que una
  reimportación de catálogos no duplica filas. El script ignora `DATABASE_URL`.
- Limitación: el paquete `embedded-postgres` no incluye `pg_dump` ni `pg_restore`, así que el
  ensayo usa un respaldo lógico en JSON, no el formato binario de `pg_dump`. Las copias reales de
  producción deben hacerse con las copias de respaldo del proyecto Supabase (según el plan
  contratado) o con `pg_dump` desde un equipo con cliente PostgreSQL 17, y guardarse fuera del
  repositorio (`backups/` está en `.gitignore`).
- El workflow de publicación no hace copia automática antes de migrar. Esto está pendiente: la
  copia previa debe hacerse a mano antes de cada publicación que incluya migraciones.
- Recuperación: revertir el frontend en Cloudflare Pages no restaura la base de datos. Si una
  migración falla, no se resetea nada: se corrige con una migración compatible hacia adelante o se
  restaura la copia en una base nueva y se repunta la aplicación solo tras comprobarla.

## 5. Exportación
- Compras: exportación CSV con protección contra fórmulas (texto que empieza por `=`, `+`, `-`,
  `@`, tabulador o retorno se escribe con un apóstrofo delante). Impresión de la compra sin notas
  ni datos bancarios: la sección de impresión solo muestra referencia, importes, utilidad y
  gastos con concepto, descripción y monto.
- Ningún dato se publica en Pages ni en `dist/`. El bundle solo contiene la URL de Supabase y la
  clave pública (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

## 6. Publicación
- Requisitos previos (una vez): ver los pasos manuales de `docs/ARRANQUE_IMPLEMENTADO.md` y las
  variables de `templates/VARIABLES_DESPLIEGUE.md`. El entorno de GitHub `produccion` debe tener
  revisión manual.
- Publicar solo con autorización explícita: GitHub > Actions > "Publicar producción" > escribir
  `PUBLICAR`. Sin esa palabra el workflow se detiene en el primer paso.
- Orden del workflow: confirmación, calidad (`lint`, `typecheck`, `test`, verificación de
  migraciones), pruebas de BD en PostgreSQL 17 efímero, compilación con el SHA del commit,
  `supabase db push` sin reset, despliegue de la función `version`, despliegue de Pages con
  `wrangler` fijado en 4.151.2, y smoke de producción (`npm run smoke:produccion`).
- Si falla una etapa, las siguientes no se ejecutan. Frontend y backend deben seguir siendo
  compatibles entre sí durante la transición (las migraciones son aditivas).
- Comprobación de versión: `https://<url>/version.json` debe mostrar el SHA del commit desplegado.
  La función `version` responde 401 o 403 sin sesión.

## 7. Limitaciones reales (a fecha de esta entrega)
- La pantalla de cotización (`EditorCotizacion`) todavía usa el flujo anterior. No está conectada
  al motor nuevo: no tiene selector de perfil de fees, modos de fees e impuestos, tipo de vehículo
  sin medidas, comparador de navieras ni campos opcionales. Esta es la principal pieza pendiente
  para usar el sistema de punta a punta.
- `marcar_comprado` recibe el snapshot desde el cliente y no lo recalcula en el servidor.
- Las revisiones inmutables no tienen todavía una función de servidor que las confirme.
- La interfaz de Compra, Repuestos y Mercado no se ha probado en navegador: no hay credenciales
  de Supabase ni `.env` en este entorno.
- La concurrencia de `marcar_comprado` no está probada (el harness usa un solo cliente).
- vPIC no está conectado al formulario. Un VIN incompleto o una respuesta fallida no bloquean.
- Supabase CLI no se ha ejecutado contra un proyecto; el workflow no se ha ejecutado en GitHub.
- No se ha desplegado ni publicado nada. No hay URL pública verificada.
- La carpeta `Python/` (distribución de Python 3.15, 2399 archivos) está rastreada en el commit
  inicial. Todos los 477 errores de `npm run lint` (raíz) vienen de ahí; el código del proyecto no
  tiene errores de lint. Quitarla del repositorio (`git rm -r --cached` y `.gitignore`, o moverla
  fuera) es decisión del usuario.
