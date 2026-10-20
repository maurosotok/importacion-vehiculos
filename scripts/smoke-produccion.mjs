const URL_APP = process.env.PUBLIC_APP_URL;
const URL_SUPABASE = process.env.SUPABASE_URL;
const shaEsperado = process.env.BUILD_SHA;

if (!URL_APP || !URL_SUPABASE) {
  console.error('Defina PUBLIC_APP_URL y SUPABASE_URL.');
  process.exit(1);
}

const fallos = [];

function comprobar(condicion, descripcion) {
  console.log(`${condicion ? 'OK  ' : 'FALLO'} ${descripcion}`);
  if (!condicion) fallos.push(descripcion);
}

const base = URL_APP.replace(/\/$/, '');

const respuestaApp = await fetch(base).catch(() => null);
const html = respuestaApp?.ok ? await respuestaApp.text() : '';
comprobar(respuestaApp?.status === 200 && html.includes('id="root"'), 'La aplicación responde 200 con el contenedor de React');

const respuestaVersion = await fetch(`${base}/version.json`).catch(() => null);
const version = respuestaVersion?.ok ? await respuestaVersion.json().catch(() => null) : null;
comprobar(typeof version?.sha === 'string', 'version.json publicado con sha');
if (shaEsperado) {
  comprobar(version?.sha === shaEsperado, 'El sha publicado coincide con el commit desplegado');
}

const respuestaFuncion = await fetch(`${URL_SUPABASE.replace(/\/$/, '')}/functions/v1/version`).catch(() => null);
comprobar(
  respuestaFuncion !== null && [401, 403].includes(respuestaFuncion.status),
  'La función version rechaza una petición sin sesión (401 o 403)',
);

if (fallos.length > 0) {
  console.error(`Smoke de producción con ${fallos.length} fallo(s).`);
  process.exitCode = 1;
} else {
  console.log('Smoke de producción superado.');
}
