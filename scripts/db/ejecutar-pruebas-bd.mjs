import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { importarCatalogos } from '../catalogos/importar-catalogos.mjs';
import { CARPETA_MIGRACIONES, listarMigraciones } from './verificar-migraciones.mjs';

const PUERTO_LOCAL = 54329;
const CLAVE_LOCAL = 'prueba-local-no-productiva';

const ESPERADOS_CATALOGO = {
  fee_profiles: 10,
  towing_rates: 282,
  shipping_rates: 30,
  vehicle_type_mappings: 24,
  logistics_providers: 4,
  suppliers: 45,
  user_settings: 1,
};

const STUB_AUTH = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''),
    ''
  )::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
`;

async function iniciarBaseDeDatos() {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (process.env.PRUEBAS_BD_EFIMERAS !== 'si') {
      throw new Error('DATABASE_URL solo se acepta con PRUEBAS_BD_EFIMERAS=si (base efímera de CI).');
    }
    const cliente = new pg.Client({ connectionString: url });
    await cliente.connect();
    return { cliente, detener: () => cliente.end() };
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'cotizador-pg-'));
  const servidor = new EmbeddedPostgres({
    databaseDir: path.join(dir, 'datos'),
    user: 'postgres',
    password: CLAVE_LOCAL,
    port: PUERTO_LOCAL,
    persistent: false,
  });
  await servidor.initialise();
  await servidor.start();
  await servidor.createDatabase('cotizador_prueba');
  const cliente = new pg.Client({
    host: 'localhost',
    port: PUERTO_LOCAL,
    user: 'postgres',
    password: CLAVE_LOCAL,
    database: 'cotizador_prueba',
  });
  await cliente.connect();
  return {
    cliente,
    detener: async () => {
      await cliente.end();
      await servidor.stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

async function aplicarMigraciones(cliente) {
  await cliente.query(STUB_AUTH);
  const { nombres, problemas } = await listarMigraciones();
  if (problemas.length > 0) throw new Error(problemas.join('\n'));
  for (const nombre of nombres) {
    await cliente.query(await readFile(path.join(CARPETA_MIGRACIONES, nombre), 'utf8'));
  }
  return nombres;
}

async function intentar(cliente, sql, params = []) {
  await cliente.query('savepoint intento');
  try {
    const resultado = await cliente.query(sql, params);
    await cliente.query('release savepoint intento');
    return { ok: true, filas: resultado.rows, cantidad: resultado.rowCount };
  } catch (error) {
    await cliente.query('rollback to savepoint intento');
    await cliente.query('release savepoint intento');
    return { ok: false, codigo: error.code, mensaje: error.message };
  }
}

async function comoRol(cliente, rol, sub, prueba) {
  await cliente.query('savepoint rol');
  try {
    await cliente.query(`set local role ${rol}`);
    if (sub) {
      await cliente.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub, role: rol }),
      ]);
    }
    return await prueba();
  } finally {
    await cliente.query('rollback to savepoint rol');
    await cliente.query('release savepoint rol');
  }
}

async function comprobarSinHistoricos(cliente) {
  for (const tabla of ['purchases', 'purchase_expenses', 'market_observations', 'part_quote_items', 'part_supplier_offers', 'sale_price_targets']) {
    const { rows } = await cliente.query(`select count(*)::int as n from public.${tabla}`);
    assert.equal(rows[0].n, 0, `${tabla} debe estar vacía tras importar catálogos`);
  }
}

async function crearDatos(cliente, usuarios) {
  const { propietario, ajeno } = usuarios;
  const [vehiculoPropio] = (await cliente.query(
    `insert into public.vehicles (owner_id, marca, modelo, anio) values ($1, 'Toyota', 'Corolla', 2019) returning id`,
    [propietario],
  )).rows;
  const [vehiculoAjeno] = (await cliente.query(
    `insert into public.vehicles (owner_id, marca, modelo, anio) values ($1, 'Honda', 'Civic', 2018) returning id`,
    [ajeno],
  )).rows;
  const [cotizacion] = (await cliente.query(
    `insert into public.quotes (owner_id, vehicle_id) values ($1, $2) returning id`,
    [propietario, vehiculoPropio.id],
  )).rows;
  const [revision] = (await cliente.query(
    `insert into public.quote_revisions (owner_id, quote_id, numero, motor_version, snapshot)
     values ($1, $2, 1, 'prueba', '{}'::jsonb) returning id`,
    [propietario, cotizacion.id],
  )).rows;
  const [compra] = (await cliente.query(
    `insert into public.purchases (owner_id, quote_id, revision_id) values ($1, $2, $3) returning id`,
    [propietario, cotizacion.id, revision.id],
  )).rows;
  const [proveedor] = (await cliente.query(
    `select id from public.suppliers where owner_id = $1 order by clave limit 1`,
    [propietario],
  )).rows;
  const [pieza] = (await cliente.query(
    `insert into public.part_quote_items (owner_id, pieza) values ($1, 'Faro') returning id`,
    [propietario],
  )).rows;
  const [oferta] = (await cliente.query(
    `insert into public.part_supplier_offers (owner_id, item_id, supplier_id, estado, precio)
     values ($1, $2, $3, 'cotizado', 10) returning id`,
    [propietario, pieza.id, proveedor.id],
  )).rows;
  const [gasto] = (await cliente.query(
    `insert into public.purchase_expenses (owner_id, purchase_id, concepto, monto, moneda, oferta_repuesto_id)
     values ($1, $2, 'repuesto', 10, 'USD', $3) returning id`,
    [propietario, compra.id, oferta.id],
  )).rows;
  const [perfilAjeno] = (await cliente.query(
    `insert into public.fee_profiles (owner_id, clave, etiqueta, subasta) values ($1, 'perfil_ajeno', 'Ajeno', 'IAA') returning clave`,
    [ajeno],
  )).rows;
  return {
    vehiculoPropio: vehiculoPropio.id,
    vehiculoAjeno: vehiculoAjeno.id,
    cotizacion: cotizacion.id,
    revision: revision.id,
    compra: compra.id,
    oferta: oferta.id,
    gasto: gasto.id,
    perfilAjeno: perfilAjeno.clave,
  };
}

const PRUEBAS = [
  {
    id: 'S01a',
    nombre: 'El propietario no lee registros de otro owner_id',
    async ejecutar({ cliente, usuarios, datos }) {
      const { rows } = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        cliente.query('select id from public.vehicles where id = $1', [datos.vehiculoAjeno]),
      );
      assert.equal(rows.length, 0);
    },
  },
  {
    id: 'S01b',
    nombre: 'Una cotización propia no puede referenciar un vehículo ajeno',
    async ejecutar({ cliente, usuarios, datos }) {
      const resultado = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'insert into public.quotes (vehicle_id) values ($1)', [datos.vehiculoAjeno]),
      );
      assert.equal(resultado.ok, false);
      assert.ok(['23503', '42501'].includes(resultado.codigo), resultado.mensaje);
    },
  },
  {
    id: 'S01c',
    nombre: 'Una cotización propia no puede usar un perfil de fees ajeno',
    async ejecutar({ cliente, usuarios, datos }) {
      const resultado = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'update public.user_settings set perfil_fees_clave = $1', [datos.perfilAjeno]),
      );
      assert.equal(resultado.ok, false);
      assert.equal(resultado.codigo, '23503');
    },
  },
  {
    id: 'S02',
    nombre: 'Suplantar owner_id al insertar queda bloqueado por RLS',
    async ejecutar({ cliente, usuarios }) {
      const resultado = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'insert into public.vehicles (owner_id, marca) values ($1, $2)', [usuarios.ajeno, 'Suplantación']),
      );
      assert.equal(resultado.ok, false);
      assert.equal(resultado.codigo, '42501');
    },
  },
  {
    id: 'S03a',
    nombre: 'Una revisión confirmada no se puede modificar ni borrar',
    async ejecutar({ cliente, datos }) {
      const actualizar = await intentar(cliente, 'update public.quote_revisions set motor_version = $1 where id = $2', ['alterada', datos.revision]);
      assert.equal(actualizar.codigo, 'P0001', actualizar.mensaje);
      const borrar = await intentar(cliente, 'delete from public.quote_revisions where id = $1', [datos.revision]);
      assert.equal(borrar.codigo, 'P0001', borrar.mensaje);
    },
  },
  {
    id: 'S03b',
    nombre: 'El navegador no puede insertar ni modificar revisiones',
    async ejecutar({ cliente, usuarios, datos }) {
      const insertar = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, `insert into public.quote_revisions (owner_id, quote_id, numero, motor_version, snapshot)
          values ($1, $2, 2, 'manual', '{}'::jsonb)`, [usuarios.propietario, datos.cotizacion]),
      );
      assert.equal(insertar.codigo, '42501');
      const actualizar = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'update public.quote_revisions set motor_version = $1', ['x']),
      );
      assert.equal(actualizar.codigo, '42501');
    },
  },
  {
    id: 'S04a',
    nombre: 'Anónimo no puede leer datos privados',
    async ejecutar({ cliente }) {
      const resultado = await comoRol(cliente, 'anon', null, () => intentar(cliente, 'select id from public.vehicles'));
      assert.equal(resultado.codigo, '42501');
    },
  },
  {
    id: 'S04b',
    nombre: 'Un usuario autenticado que no es propietario no ve ni escribe datos',
    async ejecutar({ cliente, usuarios }) {
      const lectura = await comoRol(cliente, 'authenticated', usuarios.externo, () =>
        cliente.query('select id from public.vehicles'),
      );
      assert.equal(lectura.rows.length, 0);
      const escritura = await comoRol(cliente, 'authenticated', usuarios.externo, () =>
        intentar(cliente, 'insert into public.vehicles (owner_id, marca) values ($1, $2)', [usuarios.externo, 'Intruso']),
      );
      assert.equal(escritura.codigo, '42501');
    },
  },
  {
    id: 'S04c',
    nombre: 'Ningún usuario del navegador puede darse de alta como propietario',
    async ejecutar({ cliente, usuarios }) {
      const resultado = await comoRol(cliente, 'authenticated', usuarios.externo, () =>
        intentar(cliente, 'insert into public.app_owner (user_id) values ($1)', [usuarios.externo]),
      );
      assert.equal(resultado.codigo, '42501');
    },
  },
  {
    id: 'S04d',
    nombre: 'Solo puede existir un propietario',
    async ejecutar({ cliente, usuarios }) {
      const resultado = await intentar(cliente, 'insert into public.app_owner (user_id) values ($1)', [usuarios.externo]);
      assert.equal(resultado.codigo, '23505');
    },
  },
  {
    id: 'S05',
    nombre: 'Solo una versión de fees activa por perfil',
    async ejecutar({ cliente, usuarios }) {
      const primera = await intentar(cliente, `insert into public.fee_schedule_versions (owner_id, fee_profile_clave, etiqueta_version, es_activa)
        values ($1, 'iaa_standard_volume', 'v1', true)`, [usuarios.propietario]);
      assert.equal(primera.ok, true, primera.mensaje);
      const segunda = await intentar(cliente, `insert into public.fee_schedule_versions (owner_id, fee_profile_clave, etiqueta_version, es_activa)
        values ($1, 'iaa_standard_volume', 'v2', true)`, [usuarios.propietario]);
      assert.equal(segunda.codigo, '23505');
    },
  },
  {
    id: 'S06',
    nombre: 'Una compra solo puede existir una vez por revisión',
    async ejecutar({ cliente, usuarios, datos }) {
      const resultado = await intentar(cliente, `insert into public.purchases (owner_id, quote_id, revision_id) values ($1, $2, $3)`,
        [usuarios.propietario, datos.cotizacion, datos.revision]);
      assert.equal(resultado.codigo, '23505');
    },
  },
  {
    id: 'S07',
    nombre: 'Un gasto de repuesto se registra una sola vez por oferta',
    async ejecutar({ cliente, usuarios, datos }) {
      const resultado = await intentar(cliente, `insert into public.purchase_expenses (owner_id, purchase_id, concepto, monto, moneda, oferta_repuesto_id)
        values ($1, $2, 'repuesto', 10, 'USD', $3)`, [usuarios.propietario, datos.compra, datos.oferta]);
      assert.equal(resultado.codigo, '23505');
    },
  },
  {
    id: 'R01',
    nombre: 'Versión de fila obsoleta no sobrescribe cambios',
    async ejecutar({ cliente, usuarios, datos }) {
      await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        const primera = await cliente.query(
          'update public.vehicles set marca = $1 where id = $2 and row_version = 1 returning row_version',
          ['Toyota (A)', datos.vehiculoPropio],
        );
        assert.equal(primera.rowCount, 1);
        assert.equal(primera.rows[0].row_version, 2);
        const segunda = await cliente.query(
          'update public.vehicles set marca = $1 where id = $2 and row_version = 1',
          ['Toyota (B)', datos.vehiculoPropio],
        );
        assert.equal(segunda.rowCount, 0);
      });
    },
  },
];

async function principal() {
  const { cliente, detener } = await iniciarBaseDeDatos();
  let fallos = 0;
  try {
    const migraciones = await aplicarMigraciones(cliente);
    console.log(`Migraciones aplicadas: ${migraciones.length}`);

    const usuarios = { propietario: randomUUID(), ajeno: randomUUID(), externo: randomUUID() };
    for (const id of Object.values(usuarios)) {
      await cliente.query('insert into auth.users (id) values ($1)', [id]);
    }
    await cliente.query('insert into public.app_owner (user_id) values ($1)', [usuarios.propietario]);

    const primera = await importarCatalogos(cliente, usuarios.propietario);
    for (const [tabla, esperado] of Object.entries(ESPERADOS_CATALOGO)) {
      assert.equal(primera[tabla].insertados, esperado, `${tabla}: filas insertadas`);
    }
    console.log('Importación 1: ok', JSON.stringify(primera));

    const segunda = await importarCatalogos(cliente, usuarios.propietario);
    for (const [tabla, esperado] of Object.entries(ESPERADOS_CATALOGO)) {
      assert.equal(segunda[tabla].insertados, 0, `${tabla}: segunda importación no debe insertar`);
      assert.equal(segunda[tabla].ya_existian, esperado, `${tabla}: filas existentes`);
    }
    console.log('Importación 2 (idempotente): ok');

    await cliente.query(`update public.towing_rates set etiqueta = 'EDITADO POR USUARIO' where owner_id = $1 and clave = (select clave from public.towing_rates where owner_id = $1 order by clave limit 1)`, [usuarios.propietario]);
    await importarCatalogos(cliente, usuarios.propietario);
    const { rows: editado } = await cliente.query(`select count(*)::int as n from public.towing_rates where owner_id = $1 and etiqueta = 'EDITADO POR USUARIO'`, [usuarios.propietario]);
    assert.equal(editado[0].n, 1, 'La importación no debe sobrescribir ediciones del usuario');
    console.log('Importación 3 (no sobrescribe ediciones): ok');

    try {
      await comprobarSinHistoricos(cliente);
      console.log('PASS D01 Sin cotizaciones, compras, precios ni ofertas históricas');
    } catch (error) {
      fallos += 1;
      console.log(`FAIL D01 Sin cotizaciones, compras, precios ni ofertas históricas\n     ${error.message}`);
    }

    const datos = await crearDatos(cliente, usuarios);
    const contexto = { cliente, usuarios, datos };

    for (const prueba of PRUEBAS) {
      await cliente.query('begin');
      try {
        await prueba.ejecutar(contexto);
        console.log(`PASS ${prueba.id} ${prueba.nombre}`);
      } catch (error) {
        fallos += 1;
        console.log(`FAIL ${prueba.id} ${prueba.nombre}\n     ${error.message}`);
      } finally {
        await cliente.query('rollback');
      }
    }
  } finally {
    await detener();
  }
  console.log(fallos === 0 ? `Pruebas de BD: ${PRUEBAS.length} superadas` : `Pruebas de BD: ${fallos} fallo(s)`);
  if (fallos > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
