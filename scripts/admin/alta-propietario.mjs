import pg from 'pg';

const URL_BD = process.env.DATABASE_URL;
const propietarioId = process.env.APP_OWNER_USER_ID;
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!URL_BD || !propietarioId) {
  console.error('Defina DATABASE_URL (conexión de servidor) y APP_OWNER_USER_ID.');
  process.exit(1);
}
if (!PATRON_UUID.test(propietarioId)) {
  console.error('APP_OWNER_USER_ID no es un UUID válido.');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: URL_BD });
await cliente.connect();
try {
  const usuario = await cliente.query('select 1 from auth.users where id = $1', [propietarioId]);
  if (usuario.rowCount !== 1) {
    throw new Error('El usuario indicado no existe en Auth. Créelo primero desde el panel de Supabase con el registro público desactivado.');
  }

  const existentes = await cliente.query('select user_id from public.app_owner');
  if (existentes.rowCount > 0) {
    if (existentes.rows[0].user_id === propietarioId) {
      console.log('El propietario ya estaba registrado. No se hizo ningún cambio.');
    } else {
      throw new Error('Ya existe un propietario distinto. Este comando no cambia ni agrega propietarios.');
    }
  } else {
    await cliente.query('insert into public.app_owner (user_id) values ($1)', [propietarioId]);
    console.log('Propietario registrado.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Error desconocido.');
  process.exitCode = 1;
} finally {
  await cliente.end();
}
