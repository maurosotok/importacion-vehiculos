# Arranque de la entrega 1

Este documento lista lo que ya existe en el repositorio y los pasos manuales que quedan.
No hay despliegue realizado. Ningún comando de esta página se ejecutó contra producción.

Estado por etiqueta (detalle y comandos con exit code en `docs/ESTADO.md`):
- Implementado: motor de fees IAA Standard Volume, grúa y barco automáticas, impuestos manuales,
  gastos locales predeterminados, editor conectado a la tabla de fees.
- Probado unitariamente: motor, fees, caso 107, lógica del editor (`npm test`).
- Probado con BD: esquema y RLS en PostgreSQL 17 embebido (`npm run test:bd`, `npm run db:ensayar-restauracion`).
- Probado en navegador: no. Pendiente de credenciales de un proyecto de prueba.
- Pendiente de autorización: aplicar la migración `20261020000100` y cualquier cambio remoto; publicar.
- No implementado: recálculo en servidor (S02), confirmación de revisiones en servidor (S03), papelería por naviera, sugerencia de precio desde Mercado en el editor.

## Comandos locales

Requisitos: Node 24 (`.nvmrc`). No se requiere Docker ni WSL.

```
npm ci
npm run dev                   # aplicación local con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local
npm run typecheck
npm run lint
npm test                      # motores y pruebas de interfaz pura
npm run test:bd               # PostgreSQL 17 embebido, sin Docker; usa DATABASE_URL + PRUEBAS_BD_EFIMERAS=si en CI
npm run db:verificar-migraciones
npm run build                 # genera dist/ y dist/version.json
```

## Pasos manuales (una vez)

1. Repositorio GitHub privado. Subir el código; `fuentes_privadas/`, `.env*` y `backups/` están excluidos por `.gitignore`.
2. Proyecto Supabase nuevo. En Authentication, desactivar el registro público (`enable_signup = false`, también en `supabase/config.toml`).
3. Crear el usuario propietario en Authentication > Users (correo y clave). Copiar su UUID.
4. Registrar al propietario, una sola vez, desde un equipo propio con la cadena de conexión de servidor del proyecto (nunca en chat ni en Git):
   ```
   DATABASE_URL=<cadena de conexión de servidor> APP_OWNER_USER_ID=<uuid> npm run admin:alta-propietario
   ```
   El comando se niega a crear un segundo propietario.
5. Cargar catálogos estándar (grúas, embarques, proveedores, navieras, perfiles de fees y preferencias). No cargan cotizaciones, compras, gastos ni precios históricos. El caso 104 nunca se importa a producción.
   ```
   DATABASE_URL=<cadena de servidor> APP_OWNER_USER_ID=<uuid> npm run catalogos:importar
   ```
6. Cloudflare Pages: crear un proyecto con Direct Upload. No conectar integración Git de Pages; el workflow publica con `wrangler pages deploy`.
7. GitHub, Settings > Environments: crear el entorno `produccion` con revisión manual recomendada.
8. GitHub, secretos del entorno: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`.
9. GitHub, variables del entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`, `PUBLIC_APP_URL`. Detalle en `templates/VARIABLES_DESPLIEGUE.md`.
10. En Supabase Auth, configurar la URL del sitio y las redirecciones con la URL de Pages.

## Publicación

Solo con autorización explícita: Actions > "Publicar producción" > escribir `PUBLICAR`.
El workflow ejecuta en orden: calidad, pruebas de BD en PostgreSQL 17 efímero, compilación,
`supabase db push` (sin reset), despliegue de la función `version`, despliegue de Pages y smoke.

Revertir el frontend en Pages no restaura la base de datos. Las migraciones deben ser compatibles hacia atrás.

## Pendiente de esta entrega

- Migración `20261020000100_fees_desglose_y_defaults.sql`: solo en local. Se aplica en producción
  con `supabase db push` al publicar, o a mano antes, con autorización explícita.
- Catálogo IAA Standard Volume (`tablas_fees_manual.json`): no importado en ningún proyecto. Copart sin cargar.
- Función de servidor que recalcula y persiste revisiones inmutables (`quote_revisions`). El frontend no crea revisiones todavía.
- Papelería por naviera y sugerencia de precio desde Mercado en el editor: no implementadas.
- Validación con Supabase CLI de migraciones y `config.toml`; versión de CLI fijada en el workflow sin verificar localmente.
- Validación sintáctica del YAML del workflow.
- Primer despliegue real y smoke contra la URL pública.
