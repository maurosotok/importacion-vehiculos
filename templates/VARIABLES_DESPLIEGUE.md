# Contrato de variables que Claude debe implementar

Estos nombres son la convencion del proyecto, no nombres que todos los proveedores exijan.
El workflow generado por el Prompt 1 debe consumirlos exactamente o documentar el cambio.
No pegar valores secretos en Claude/chat ni almacenarlos en Git. La configuración privada local
se escribe en archivos ignorados y se carga en las consolas de secretos correspondientes.

## Frontend: configuración pública en .env.local y GitHub Actions Variables
| Nombre | Contenido |
|---|---|
| VITE_SUPABASE_URL | URL del proyecto Supabase. |
| VITE_SUPABASE_PUBLISHABLE_KEY | Clave publicable, nunca secret ni service_role. |

La clave publicable llega al navegador por diseño; no reemplaza RLS. Si el proyecto usa una
anon key legacy, documentar su uso compatible en vez de mezclar tipos de claves. El backend
debe autenticar la sesión JWT del usuario correctamente para la configuración elegida.

## GitHub Actions: secretos de publicación
| Nombre | Contenido |
|---|---|
| SUPABASE_ACCESS_TOKEN | Token personal con permisos limitados al proyecto y acciones requeridas. |
| SUPABASE_DB_PASSWORD | Clave de la base para desplegar migraciones, no para el navegador. |
| CLOUDFLARE_API_TOKEN | Token limitado a la cuenta y permisos de Pages necesarios. |

## GitHub Actions: variables de identificación
| Nombre | Contenido |
|---|---|
| SUPABASE_PROJECT_ID | Referencia del proyecto. |
| CLOUDFLARE_ACCOUNT_ID | ID de la cuenta. |
| CLOUDFLARE_PAGES_PROJECT | Nombre del proyecto Pages; sugerencia cotizador-honduras. |
| APP_OWNER_USER_ID | UUID del usuario administrador creado por un canal autorizado. |
| PUBLIC_APP_URL | URL pública de Pages usada por el smoke de producción (p. ej. https://cotizador-honduras.pages.dev). |

`BUILD_SHA` no se configura: el workflow lo toma de `github.sha` y lo escribe en
`dist/version.json` y en la función `version`.

El alta del propietario/rol usa migración o comando administrativo documentado por Claude,
no una URL pública ni un parámetro del navegador. No existe un correo/UUID real en este paquete.
`GITHUB_TOKEN` es suministrado por Actions; no poner un token personal inventado.

## Servidor Supabase
Utilizar los mecanismos y secretos del runtime de Supabase. Las claves privilegiadas que el
backend necesite permanecen alli, nunca en VITE_, fixtures ni logs. Preferir cliente con sesión
del usuario para que RLS aplique; cualquier operación privilegiada válida identidad y rol antes.
Las funciones deben verificar autenticación del usuario incluso si una configuración moderna
requiere manejar el JWT en código. Nunca confundir apikey pública con autorización de usuario.

## Recursos a crear una vez
Repositorio GitHub privado; proyecto Supabase; usuario de Auth autorizado; proyecto Pages
Direct Upload. Una URL pages.dev es suficiente. Configurar URL de sitio/redirecciones de Auth
y origen permitido de las funciones conforme a la URL final y al flujo elegido.
