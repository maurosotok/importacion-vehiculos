import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { importarCatalogos } from '../catalogos/importar-catalogos.mjs';
import { aplicarMigraciones } from './esquema-local.mjs';

const PUERTO = 54330;
const CLAVE = 'ensayo-local-no-productivo';
const TABLAS_HISTORICAS = ['quotes', 'quote_revisions', 'purchases', 'purchase_expenses'];

function conectar(base) {
  return new pg.Client({ host: 'localhost', port: PUERTO, user: 'postgres', password: CLAVE, database: base });
}

async function tablasPublicas(cliente) {
  const r = await cliente.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
  );
  return r.rows.map((fila) => String(fila.table_name));
}

async function respaldarLogico(origen) {
  const respaldo = {};
  for (const tabla of [...(await tablasPublicas(origen)), 'users']) {
    const esquema = tabla === 'users' ? 'auth' : 'public';
    const r = await origen.query(`select coalesce(json_agg(t), '[]'::json) as filas from ${esquema}."${tabla}" t`);
    respaldo[`${esquema}.${tabla}`] = r.rows[0].filas;
  }
  return respaldo;
}

async function restaurarLogico(destino, respaldo) {
  await destino.query("set session_replication_role = 'replica'");
  try {
    for (const [clave, filas] of Object.entries(respaldo)) {
      const [esquema, tabla] = clave.split('.');
      await destino.query(
        `insert into ${esquema}."${tabla}" select * from json_populate_recordset(null::${esquema}."${tabla}", $1::json)`,
        [JSON.stringify(filas)],
      );
    }
  } finally {
    await destino.query("set session_replication_role = 'origin'");
  }
}

async function instantanea(cliente) {
  const filas = {};
  for (const tabla of await tablasPublicas(cliente)) {
    const r = await cliente.query(`select count(*)::int as n from public."${tabla}"`);
    filas[tabla] = r.rows[0].n;
  }
  const rls = await cliente.query(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  );
  const politicas = await cliente.query(
    'select tablename, policyname, cmd from pg_policies where schemaname = $1 order by 1, 2',
    ['public'],
  );
  const funciones = await cliente.query(
    `select p.proname, p.prosecdef from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1`,
  );
  return {
    filas,
    rls: rls.rows.map((r) => `${String(r.relname)}=${String(r.relrowsecurity)}`),
    politicas: politicas.rows.map((r) => `${String(r.tablename)}.${String(r.policyname)}.${String(r.cmd)}`),
    funciones: funciones.rows.map((r) => `${String(r.proname)}:${String(r.prosecdef)}`),
  };
}

export async function ensayarRestauracion() {
  const dir = await mkdtemp(path.join(tmpdir(), 'cotizador-restauracion-'));
  const servidor = new EmbeddedPostgres({
    databaseDir: path.join(dir, 'datos'),
    user: 'postgres',
    password: CLAVE,
    port: PUERTO,
    persistent: false,
  });
  const clientes = [];
  const diferencias = [];
  const resultado = {};
  try {
    await servidor.initialise();
    await servidor.start();
    await servidor.createDatabase('origen');
    await servidor.createDatabase('destino');

    const origen = conectar('origen');
    clientes.push(origen);
    await origen.connect();
    await aplicarMigraciones(origen);
    const propietario = randomUUID();
    await origen.query('insert into auth.users (id) values ($1)', [propietario]);
    await origen.query('insert into public.app_owner (user_id) values ($1)', [propietario]);
    resultado.cargaInicial = await importarCatalogos(origen, propietario);
    const instantaneaOrigen = await instantanea(origen);

    const archivo = path.join(dir, 'respaldo-logico.json');
    const respaldo = await respaldarLogico(origen);
    await writeFile(archivo, JSON.stringify(respaldo));

    const destino = conectar('destino');
    clientes.push(destino);
    await destino.connect();
    await aplicarMigraciones(destino);
    await restaurarLogico(destino, JSON.parse(await readFile(archivo, 'utf8')));
    const instantaneaDestino = await instantanea(destino);

    for (const clave of ['filas', 'rls', 'politicas', 'funciones']) {
      const a = JSON.stringify(instantaneaOrigen[clave]);
      const b = JSON.stringify(instantaneaDestino[clave]);
      if (a !== b) diferencias.push(`${clave}: origen=${a} destino=${b}`);
    }

    resultado.reimportacion = await importarCatalogos(destino, propietario);
    for (const [tabla, conteo] of Object.entries(resultado.reimportacion)) {
      if (conteo.insertados !== 0) diferencias.push(`la reimportación insertó filas en ${tabla}: ${conteo.insertados}`);
    }
    for (const tabla of TABLAS_HISTORICAS) {
      if (instantaneaDestino.filas[tabla] !== 0) diferencias.push(`${tabla} no está vacía tras restaurar`);
    }

    resultado.filasDestino = instantaneaDestino.filas;
    resultado.tablasConRls = instantaneaDestino.rls.filter((r) => r.endsWith('=true')).length;
    resultado.politicas = instantaneaDestino.politicas.length;
    resultado.funciones = instantaneaDestino.funciones;
  } finally {
    for (const cliente of clientes) await cliente.end().catch(() => undefined);
    await servidor.stop().catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  }
  return { ...resultado, diferencias };
}

async function principal() {
  const r = await ensayarRestauracion();
  console.log('Carga inicial en origen:');
  console.table(r.cargaInicial);
  console.log('Filas en destino tras restaurar:');
  console.table(r.filasDestino);
  console.log(`RLS activo en ${r.tablasConRls} tablas; ${r.politicas} políticas; funciones: ${r.funciones.join(', ')}`);
  if (r.diferencias.length > 0) {
    console.error(`Ensayo de restauración con ${r.diferencias.length} diferencia(s):`);
    for (const d of r.diferencias) console.error(` - ${d}`);
    process.exitCode = 1;
    return;
  }
  console.log('Ensayo de restauración superado: origen y destino coinciden y la reimportación no duplica catálogos.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
