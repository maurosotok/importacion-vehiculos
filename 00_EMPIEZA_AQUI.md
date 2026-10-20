# Empezar el proyecto - cuatro entregas con Claude Code

## Qué recibís
Un paquete de especificación e insumos; todavía no es una app desarrollada. Incluye cuatro
prompts completos, decisiones v2, mapa del Excel, catálogos estructurados, el original privado
y pruebas del caso 104. Los impuestos quedan manuales en las cuatro entregas.

El flujo es **preparar carpeta -> Prompt 1 -> conectar servicios -> Prompt 2 -> Prompt 3 ->
Prompt 4**. Pueden hacer falta ajustes dentro de una entrega. No hace falta repartir el mismo
contexto en decenas de conversaciones: CLAUDE.md y docs/ESTADO.md lo conservan en el repositorio.

## Paso 1. Preparar las herramientas
Usar Windows nativo. Verificar Git, Node.js/npm y Claude Code:
```powershell
git --version
node --version
npm --version
claude --version
```
Instalar una versión LTS de Node compatible con las dependencias elegidas por Claude. Instalar
Git for Windows si aun no está disponible. No configurar WSL/Docker para este arranque.
Para instalar Claude Code con WinGet, el comando documentado es:
```powershell
winget install Anthropic.ClaudeCode
```
Abrir otra terminal y ejecutar `claude --version`. Ejecutar `claude` y completar su inicio de
sesión. Tu cuenta necesita acceso autorizado a Claude Code; no se incluyen claves ni una
suscripción en el paquete. No hace falta una API de IA dentro de la aplicación.
Referencia: https://code.claude.com/docs/en/setup

## Paso 2. Descomprimir en una carpeta nueva
Ejemplo si guardaste el ZIP en Downloads:
```powershell
Expand-Archive -Path "$HOME\Downloads\Cotizador_Honduras_Claude_v2.zip" -DestinationPath "$HOME\Documents"
Set-Location "$HOME\Documents\Cotizador_Honduras_Claude_v2"
git init -b main
```
La carpeta debe contener CLAUDE.md, 00_EMPIEZA_AQUI.md, prompts, docs, data, fuentes_privadas,
templates, scripts y .gitignore. No usar `git add -f` para fuentes_privadas. No abrir como raíz
una carpeta superior que contenga proyectos ajenos. Para un proyecto v1 ya iniciado, leer
`docs/MIGRAR_DESDE_V1.md` antes de copiar archivos.

## Paso 3. Ejecutar el Prompt 1
Abrir VS Code en esta carpeta, o trabajar desde su terminal:
```powershell
claude
```
Dentro de Claude escribir:
```text
Lee CLAUDE.md y ejecuta el prompt completo de prompts/01_BASE_Y_PRODUCCION.md.
Implementa la entrega y actualiza docs/ESTADO.md con lo realmente probado.
```
No pegar otra vez todos los archivos. Claude los tiene en la carpeta. Revisar sus permisos
y cambios; no deshabilitar controles de permisos globalmente. Puede avanzar código y tests
sin tener todavía los secretos de despliegue. No ejecutar npm ci o npm run dev hasta que el
Prompt 1 haya creado package.json y el lockfile correspondientes.

Al finalizar, revisar `docs/ARRANQUE_IMPLEMENTADO.md`, que Claude debe crear con los comandos
exactos del proyecto. Los scripts mínimos solicitados son dev, build, lint, typecheck, test
y verify. Los pendientes de tablas de fees no impiden tener la base lista.

## Paso 4. Crear y conectar los servicios una vez
### GitHub
Crear un repositorio PRIVADO llamado, por ejemplo, cotizador-honduras, vacío, sin otro README
que provoque conflictos con el repositorio local. Copiar su URL HTTPS para configurar origin.
No subir el archivo Carros.xlsx ni el estado bancario, aunque el repositorio sea privado.

### Supabase
Crear un proyecto para producción. Guardar la clave de la BD en el gestor de secretos. Copiar
URL, clave publicable e identificador de proyecto. Crear el usuario propio desde un canal de
administracion de Auth, deshabilitar alta pública y anotar su UUID. Aplicar el procedimiento
de propietario/rol que Claude documente; no inventar una tabla o endpoint de bootstrap.

Crear .env.local a partir del .env.example que genere Claude. Solo URL y clave publicable van
al frontend. La contraseña de BD, tokens personales y claves privilegiadas no van alli.
Completar GitHub Actions Secrets/Variables según `templates/VARIABLES_DESPLIEGUE.md`.
Referencia: https://supabase.com/docs/guides/functions/deploy
Referencia: https://supabase.com/docs/guides/deployment/managing-environments

### Cloudflare Pages
Crear un proyecto **Direct Upload**, por ejemplo cotizador-honduras. Guardar Account ID,
nombre de proyecto y un token de API con permisos limitados para publicar Pages. No activar
un segundo despliegue por Git integration: el workflow coordinado será el único publicador.
Usar inicialmente la URL pages.dev. Una vez conocida, completar Site URL/redirecciones de Auth
y origen permitido de funciones según la implementación de Claude.
Referencia: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/

No crear otra producción para pruebas. Un runner de CI puede levantar una base temporal y
borrarla al terminar. No es necesario instalarla en tu Windows ni pagar staging para este plan.
No autorizar cambios de plan de pago por código; revisar manualmente límites y necesidades.

## Paso 5. Verificar y publicar la primera entrega
Una vez generados los scripts y configurado .env.local:
```powershell
npm ci
npm run verify
npm run dev
```
`verify` debe ejecutar verificaciones reales y terminar con error si alguna falla. Los tests
BD/RLS que requieran servicios efímeros corren en CI; no ejecutarlos sobre producción localmente.
Revisar el flujo de login y borrador. Conectar origin usando la URL real del repo (reemplazar
el marcador, no copiarlo literalmente):
```powershell
git remote add origin https://github.com/TU_USUARIO/cotizador-honduras.git
git status --short --ignored
git add .
git diff --cached --stat
git commit -m "feat: initialize private vehicle quoting app"
git push -u origin main
```
Antes de commit, comprobar que .env.local y fuentes_privadas aparecen como ignorados y no en
el diff staged. No publicar si aparecen. Configurar todos los secretos antes del primer push
que active el workflow. Revisar GitHub Actions y su salida; la URL solo está lista cuando el
despliegue y los health checks terminan correctamente.

Validación personal mínima: entrar con tu usuario, guardar/reabrir un borrador, comprobar que
sin login no se leen datos y ver la versión desplegada. Aceptar una vista vacia con datos
pendientes reales, no filas históricas copiadas para que parezca terminada.

## Paso 6. Ejecutar el Prompt 2
En el mismo proyecto/sesión, o una sesión nueva leyendo estado:
```text
Lee CLAUDE.md y docs/ESTADO.md. Ejecuta prompts/02_COTIZADOR_Y_PERFILES.md.
No reintroduzcas bloqueos por dimensiones ni investigacion fiscal.
```
Claude carga catálogos y trabaja las tablas oficiales de fees. Si una tabla no se deja leer,
deberá pedir una captura/exportación concreta; el perfil permanece utilizable con importe
manual. Tu configuración cotidiana será IAA Standard Volume, tipo, ruta, papelería y cambio.
El caso 104 sirve para probar el motor, no se carga como cotización real.

Confirmar especialmente: elegir SUV sin medidas, Richmond -> Delaware -> referencia de barco
1020 y grúa 270 donde coincida la sede; cambiar puja; guardar impuesto manual; obtener costos;
cambiar a Copart o fees manuales; volver a abrir sin que los valores se alteren solos.

## Paso 7. Ejecutar los Prompts 3 y 4, en orden
```text
Lee CLAUDE.md y docs/ESTADO.md. Ejecuta prompts/03_COMPRAS_REPUESTOS_MERCADO.md.
```
Revisar compra, gastos y repuestos; luego:
```text
Lee CLAUDE.md y docs/ESTADO.md. Ejecuta prompts/04_CIERRE_Y_PUBLICACION.md.
Los impuestos permanecen manuales. No hay una entrega de algoritmo fiscal.
```
Claude termina pruebas, seguridad, rendimiento y guia de operación. Cada entrega se pública
por el mismo workflow después de revisar diff y resultados. No necesita otra base permanente.

## Paso 8. Trabajo habitual después del arranque
Pedir a Claude un cambio concreto y ejecutar las verificaciones del repositorio. Revisar diff,
commit y push a main. El workflow prueba, pública migraciones/funciones/frontend y deja la
misma URL con una nueva versión. Recargar para verla. No es edición instantanea al guardar un
archivo local ni un despliegue exitoso si Actions fallo.

Antes de cambios de datos/esquema: respaldo. Si falla la publicación, revisar la etapa que fallo;
no resetear la base. Revertir frontend no restaura una BD. Seguir docs/OPERACION.md generado en
Prompt 4. Los datos históricos del Excel permanecen en el archivo original fuera de producción.

## Comprobación independiente del paquete (opcional)
Requiere Python 3, no instala paquetes ni se conecta a internet:
```powershell
python scripts/verificar_paquete.py
```
Comprueba catálogos y aritmetica del ejemplo. No sustituye los tests ni demuestra que la app
esta desarrollada. El reporte entregado corresponde a esta comprobación del paquete.
