# Prompt 1 - Base real, datos y producción privada

Trabaja dentro de este repositorio. Lee `CLAUDE.md`, `docs/DECISIONES_V2.md`,
`docs/ESPECIFICACION.md`, `docs/MAPA_EXCEL_Y_FORMULAS.md` y `docs/PRUEBAS_ACEPTACION.md`.
Implementa la primera entrega; no te límites a devolver un plan ni una interfaz de demostración.
Estas son las decisiones v2, posteriores al video y al paquete anterior.

Objetivo: aplicación personal de cotización USA-Honduras, con dos módulos: Vehículos y Repuestos.
Configuración secundaria. Stack: React, Vite, TypeScript estricto, Supabase PostgreSQL/Auth/Edge
Functions, Cloudflare Pages y GitHub Actions. Un repositorio privado, un proyecto alojado
Supabase y un proyecto Pages. No necesito una base de staging permanente, Docker local ni WSL
para empezar. Las pruebas de BD/RLS pueden correr en servicios efímeros del runner de CI.

Primero inspecciona lo existente sin destruir trabajo. Genera una estructura simple, scripts
reales en package.json, dependencias compatibles y lockfile. Implementa autenticación con un
único propietario inicial autorizado y sin registro público. RLS en todas las tablas privadas,
owner_id seguro y comprobación de pertenencia de relaciones. No endpoints abiertos para
crear administradores. Usa `.env.example` sin secretos; nunca incluyas service_role/secret
keys en VITE_ ni pidas claves en el chat.

Crea el esquema inicial de cotizaciones/vehículos y prepara migraciones para los demas
conceptos de la especificación, sin sobreingenieria. Construye un flujo real de crear, guardar,
reabrir y editar borradores. Debe funcionar con datos parciales: sin VIN, medidas, impuesto,
ruta o precio completo. Mostrar lo pendiente y subtotal conocido; no poner ceros ficticios.
Seguridad y tipos válidos siguen siendo obligatorios; los requisitos comerciales incompletos
no deshabilitan guardar el borrador.

La UI debe estar en español, USD/HNL, fecha America/Tegucigalpa, navegación con teclado y
formulario compacto. Tipo de vehículo simple, sin clasificación dimensional obligatoria.
Predetermina el perfil IAA Standard Volume Buyer Fees desde las preferencias. Impuestos solo
manuales: no existe una fase fiscal automática en este plan.

Prepara importacion idempotente de los JSON de `data/catalogos/`, con claves estables y
sin sobrescribir modificaciones del usuario. No ejecutes una importacion automática del Excel
completo. No sembrar compras/cotizaciones/mercado/repuestos históricos ni el fixture 104.
`fuentes_privadas/` es fuente local solamente: preserva .gitignore, no lo publiques ni lo copies
a public/dist. No desarrollar Bank Statement.

Prepara un workflow único coordinado: instalar -> lint/typecheck/unit tests -> pruebas BD/RLS
efímeras -> build -> migraciones compatibles -> funciones -> Pages Direct Upload -> smoke checks.
Usa secretos/variables exactamente como `templates/VARIABLES_DESPLIEGUE.md`, o documenta una
modificación necesaria. No activar integracion Git de Pages que publique fuera de este flujo.
Incluye concurrency para producción, versión de build por SHA, migraciones no destructivas y
un plan de recuperación ante publicación parcial. No utilices db reset contra la base alojada.

Crea `docs/ESTADO.md` y completa `docs/ARRANQUE_IMPLEMENTADO.md` con comandos exactos que ya
existan, nombres de recursos, variables y las acciones que debo hacer en las consolas. Tu
lista manual debe ser mínima: crear cuentas/recursos, usuario autorizado, secretos y primer
push. No contrates planes ni publiques sin autorización. Si no tienes credenciales o acceso,
deja todo listo para conectar; no afirmes haber desplegado.

Ejecuta las pruebas que puedas. Entrega: archivos cambiados, flujo realmente funcional,
pruebas con resultado, pendientes no simulados y las siguientes acciones manuales necesarias.
No bloquees esta entrega porque los tramos de fees o los impuestos no estan automatizados.
