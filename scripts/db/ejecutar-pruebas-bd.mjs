import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { importarCatalogos } from '../catalogos/importar-catalogos.mjs';
import { aplicarMigraciones } from './esquema-local.mjs';

const PUERTO_LOCAL = 54329;
const CLAVE_LOCAL = 'prueba-local-no-productiva';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRACION_TARIFAS = path.join(RAIZ, 'supabase', 'migrations', '20261021000100_correccion_tarifas_grua_pdf.sql');

const ESPERADOS_CATALOGO = {
  fee_profiles: 10,
  towing_rates: 282,
  shipping_rates: 30,
  vehicle_type_mappings: 24,
  logistics_providers: 4,
  suppliers: 45,
  user_settings: 1,
  fee_schedule_versions: 1,
};

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

const SNAPSHOT_VALIDO = JSON.stringify({
  version: '1',
  entradas: { tipoCambioHnlPorUsd: '25', reparacionHnl: '5000' },
  resultado: { importadoHnl: '100', importadoUsdEquivalente: '4', utilidadHnl: null },
});

async function cotizacionNueva(cliente, owner, vehiculo) {
  const { rows } = await cliente.query(
    'insert into public.quotes (owner_id, vehicle_id) values ($1, $2) returning id',
    [owner, vehiculo],
  );
  return rows[0].id;
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
      const activas = await cliente.query(
        `select count(*)::int as n from public.fee_schedule_versions
         where owner_id = $1 and fee_profile_clave = 'iaa_standard_volume' and es_activa`,
        [usuarios.propietario],
      );
      assert.equal(activas.rows[0].n, 1, 'la importación deja exactamente una versión activa');
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
    id: 'M01',
    nombre: 'Un usuario que no es propietario no puede marcar cotizaciones como compradas',
    async ejecutar({ cliente, usuarios, datos }) {
      const cotizacion = await cotizacionNueva(cliente, usuarios.propietario, datos.vehiculoPropio);
      const resultado = await comoRol(cliente, 'authenticated', usuarios.externo, () =>
        intentar(cliente, 'select public.marcar_comprado($1, $2, $3::jsonb)', [cotizacion, 'calculo-1', SNAPSHOT_VALIDO]),
      );
      assert.equal(resultado.codigo, '42501', resultado.mensaje);
    },
  },
  {
    id: 'M02',
    nombre: 'Marcar una cotización ajena no crea compra',
    async ejecutar({ cliente, usuarios, datos }) {
      const ajena = await cotizacionNueva(cliente, usuarios.ajeno, datos.vehiculoAjeno);
      const resultado = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'select public.marcar_comprado($1, $2, $3::jsonb)', [ajena, 'calculo-1', SNAPSHOT_VALIDO]),
      );
      assert.equal(resultado.codigo, 'P0002', resultado.mensaje);
      const { rows } = await cliente.query('select count(*)::int as n from public.purchases where quote_id = $1', [ajena]);
      assert.equal(rows[0].n, 0);
    },
  },
  {
    id: 'M03',
    nombre: 'Una revisión con versión desconocida se rechaza antes de crear compra',
    async ejecutar({ cliente, usuarios, datos }) {
      const cotizacion = await cotizacionNueva(cliente, usuarios.propietario, datos.vehiculoPropio);
      const snapshot = JSON.stringify({ ...JSON.parse(SNAPSHOT_VALIDO), version: '2' });
      const resultado = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'select public.marcar_comprado($1, $2, $3::jsonb)', [cotizacion, 'calculo-1', snapshot]),
      );
      assert.equal(resultado.codigo, '22023', resultado.mensaje);
    },
  },
  {
    id: 'M04',
    nombre: 'Marcar dos veces devuelve la misma compra, sin revisiones ni gastos duplicados',
    async ejecutar({ cliente, usuarios, datos }) {
      const cotizacion = await cotizacionNueva(cliente, usuarios.propietario, datos.vehiculoPropio);
      await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        const primera = await cliente.query('select public.marcar_comprado($1, $2, $3::jsonb) as id', [cotizacion, 'calculo-1', SNAPSHOT_VALIDO]);
        const segunda = await cliente.query('select public.marcar_comprado($1, $2, $3::jsonb) as id', [cotizacion, 'calculo-1', SNAPSHOT_VALIDO]);
        assert.equal(segunda.rows[0].id, primera.rows[0].id);
        const compras = await cliente.query('select count(*)::int as n from public.purchases where quote_id = $1', [cotizacion]);
        assert.equal(compras.rows[0].n, 1);
        const revisiones = await cliente.query('select count(*)::int as n from public.quote_revisions where quote_id = $1', [cotizacion]);
        assert.equal(revisiones.rows[0].n, 1);
        const compra = await cliente.query(
          'select presupuesto_reparacion_hnl::text as presupuesto, tipo_cambio_origen_hnl_por_usd::text as tipo_cambio from public.purchases where id = $1',
          [primera.rows[0].id],
        );
        assert.equal(compra.rows[0].presupuesto, '5000.0000');
        assert.equal(compra.rows[0].tipo_cambio, '25.000000');
        const gastos = await cliente.query('select count(*)::int as n from public.purchase_expenses where purchase_id = $1', [primera.rows[0].id]);
        assert.equal(gastos.rows[0].n, 0, 'Marcar comprado no debe convertir presupuestos en gastos');
      });
    },
  },
  {
    id: 'M05',
    nombre: 'Una cotización ya comprada no crea una segunda revisión',
    async ejecutar({ cliente, usuarios, datos }) {
      await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        const { rows } = await cliente.query('select public.marcar_comprado($1, $2, $3::jsonb) as id', [datos.cotizacion, 'calculo-1', SNAPSHOT_VALIDO]);
        assert.equal(rows[0].id, datos.compra);
        const revisiones = await cliente.query('select count(*)::int as n from public.quote_revisions where quote_id = $1', [datos.cotizacion]);
        assert.equal(revisiones.rows[0].n, 1);
      });
    },
  },
  {
    id: 'M06',
    nombre: 'Una oferta no disponible no conserva precio',
    async ejecutar({ cliente, datos }) {
      const resultado = await intentar(cliente, `update public.part_supplier_offers set estado = 'no_disponible' where id = $1`, [datos.oferta]);
      assert.equal(resultado.codigo, '23514', resultado.mensaje);
    },
  },
  {
    id: 'M07',
    nombre: 'Un reparto sin motivo se rechaza',
    async ejecutar({ cliente, datos }) {
      const resultado = await intentar(cliente, 'update public.purchase_expenses set monto_total_referencia = 20 where id = $1', [datos.gasto]);
      assert.equal(resultado.codigo, '23514', resultado.mensaje);
    },
  },
  {
    id: 'M08',
    nombre: 'Un reparto no puede exceder su total de referencia',
    async ejecutar({ cliente, datos }) {
      const resultado = await intentar(
        cliente,
        `update public.purchase_expenses set monto_total_referencia = 5, motivo_reparto = 'Socio' where id = $1`,
        [datos.gasto],
      );
      assert.equal(resultado.codigo, '23514', resultado.mensaje);
    },
  },
  {
    id: 'M09',
    nombre: 'El concepto pintura se acepta y un concepto desconocido se rechaza',
    async ejecutar({ cliente, usuarios, datos }) {
      const aceptado = await intentar(cliente, `insert into public.purchase_expenses (owner_id, purchase_id, concepto, monto, moneda)
        values ($1, $2, 'pintura', 1, 'USD')`, [usuarios.propietario, datos.compra]);
      assert.equal(aceptado.ok, true, aceptado.mensaje);
      const rechazado = await intentar(cliente, `insert into public.purchase_expenses (owner_id, purchase_id, concepto, monto, moneda)
        values ($1, $2, 'desconocido', 1, 'USD')`, [usuarios.propietario, datos.compra]);
      assert.equal(rechazado.codigo, '23514', rechazado.mensaje);
    },
  },
  {
    id: 'M10',
    nombre: 'Las observaciones de mercado no son visibles para otro usuario',
    async ejecutar({ cliente, usuarios }) {
      await cliente.query(
        `insert into public.market_observations (owner_id, marca, modelo, precio_usd) values ($1, 'Toyota', 'Corolla', 9000)`,
        [usuarios.propietario],
      );
      const externo = await comoRol(cliente, 'authenticated', usuarios.externo, () =>
        cliente.query('select id from public.market_observations'),
      );
      assert.equal(externo.rows.length, 0);
      const propietario = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        cliente.query('select id from public.market_observations'),
      );
      assert.ok(propietario.rows.length >= 1);
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
  {
    id: 'V01',
    nombre: 'La búsqueda de VIN duplicado solo devuelve cotizaciones del propio usuario',
    async ejecutar({ cliente, usuarios, datos }) {
      const vin = '1HGCM82633A004352';
      await cliente.query('update public.vehicles set vin = $1 where id = $2', [vin, datos.vehiculoPropio]);
      const buscar = () =>
        cliente.query(
          'select q.id from public.quotes q join public.vehicles v on v.id = q.vehicle_id where v.vin = $1',
          [vin],
        );
      const propietario = await comoRol(cliente, 'authenticated', usuarios.propietario, buscar);
      assert.ok(propietario.rows.length >= 1);
      const externo = await comoRol(cliente, 'authenticated', usuarios.externo, buscar);
      assert.equal(externo.rows.length, 0);
    },
  },
  {
    id: 'C01',
    nombre: 'El estado vendido se guarda por cotización y otro usuario no lo cambia',
    async ejecutar({ cliente, usuarios, datos }) {
      const propio = await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        const cambio = await cliente.query(
          'update public.quotes set vendido_en_subasta = true where id = $1',
          [datos.cotizacion],
        );
        const lectura = await cliente.query('select vendido_en_subasta from public.quotes where id = $1', [datos.cotizacion]);
        assert.equal(lectura.rows[0].vendido_en_subasta, true);
        return cambio.rowCount;
      });
      assert.equal(propio, 1);
      const ajeno = await comoRol(cliente, 'authenticated', usuarios.ajeno, async () => {
        const cambio = await cliente.query('update public.quotes set vendido_en_subasta = false where id = $1', [datos.cotizacion]);
        return cambio.rowCount;
      });
      assert.equal(ajeno, 0);
    },
  },
  {
    id: 'C02',
    nombre: 'Archivar una cotización conserva compras, gastos y revisiones',
    async ejecutar({ cliente, usuarios, datos }) {
      await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        const primera = await cliente.query('select public.archivar_cotizacion($1) as ok', [datos.cotizacion]);
        assert.equal(primera.rows[0].ok, true);
        const segunda = await cliente.query('select public.archivar_cotizacion($1) as ok', [datos.cotizacion]);
        assert.equal(segunda.rows[0].ok, false, 'una cotización ya archivada no vuelve a archivarse');
        const { rows: archivada } = await cliente.query('select deleted_at from public.quotes where id = $1', [datos.cotizacion]);
        assert.notEqual(archivada[0].deleted_at, null);
        const { rows } = await cliente.query(
          `select (select count(*)::int from public.purchases where quote_id = $1) as compras,
                  (select count(*)::int from public.purchase_expenses where purchase_id = $2) as gastos,
                  (select count(*)::int from public.quote_revisions where quote_id = $1) as revisiones`,
          [datos.cotizacion, datos.compra],
        );
        assert.deepEqual(rows[0], { compras: 1, gastos: 1, revisiones: 1 });
      });
    },
  },
  {
    id: 'C03',
    nombre: 'Otro usuario no puede archivar una cotización ajena',
    async ejecutar({ cliente, usuarios, datos }) {
      await comoRol(cliente, 'authenticated', usuarios.ajeno, async () => {
        const resultado = await cliente.query('select public.archivar_cotizacion($1) as ok', [datos.cotizacion]);
        assert.equal(resultado.rows[0].ok, false);
        await cliente.query('reset role');
        const { rows } = await cliente.query('select deleted_at from public.quotes where id = $1', [datos.cotizacion]);
        assert.equal(rows[0].deleted_at, null);
      });
    },
  },
  {
    id: 'C04',
    nombre: 'Un usuario autenticado no puede borrar cotizaciones físicamente',
    async ejecutar({ cliente, usuarios, datos }) {
      const borrado = await comoRol(cliente, 'authenticated', usuarios.propietario, () =>
        intentar(cliente, 'delete from public.quotes where id = $1', [datos.cotizacion]),
      );
      assert.equal(borrado.ok, false);
      assert.equal(borrado.codigo, '42501');
    },
  },
  {
    id: 'C05',
    nombre: 'Una cotización archivada se puede restaurar',
    async ejecutar({ cliente, usuarios, datos }) {
      await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        await cliente.query('select public.archivar_cotizacion($1)', [datos.cotizacion]);
        const restaurada = await cliente.query('select public.restaurar_cotizacion($1) as ok', [datos.cotizacion]);
        assert.equal(restaurada.rows[0].ok, true);
        const { rows } = await cliente.query('select deleted_at from public.quotes where id = $1', [datos.cotizacion]);
        assert.equal(rows[0].deleted_at, null);
      });
    },
  },
  {
    id: 'C06',
    nombre: 'Un mismo VIN admite varias cotizaciones y subastas sin bloqueo',
    async ejecutar({ cliente, usuarios, datos }) {
      const vin = 'JHLRE38797C009075';
      await cliente.query('update public.vehicles set vin = $1 where id = $2', [vin, datos.vehiculoPropio]);
      const nuevaSubasta = await intentar(
        cliente,
        'insert into public.quotes (owner_id, vehicle_id, fecha_subasta, vendido_en_subasta) values ($1, $2, $3, true) returning id',
        [usuarios.propietario, datos.vehiculoPropio, '2026-11-10'],
      );
      assert.equal(nuevaSubasta.ok, true, nuevaSubasta.mensaje);
      const otroVehiculo = await intentar(
        cliente,
        'insert into public.vehicles (owner_id, vin, marca) values ($1, $2, $3) returning id',
        [usuarios.propietario, vin, 'Honda'],
      );
      assert.equal(otroVehiculo.ok, true, otroVehiculo.mensaje);
    },
  },
  {
    id: 'C07',
    nombre: 'La corrección de tarifas cambia solo importes anteriores, respeta ediciones y no toca cotizaciones',
    async ejecutar({ cliente, usuarios, datos }) {
      const sql = await readFile(MIGRACION_TARIFAS, 'utf8');
      const monto = async (clave, columna = 'monto_usd') => {
        const { rows } = await cliente.query(
          `select ${columna} as valor from public.towing_rates where owner_id = $1 and clave = $2`,
          [usuarios.propietario, clave],
        );
        return rows[0].valor === null ? null : Number(rows[0].valor);
      };
      await cliente.query(
        'update public.towing_rates set monto_usd = 225 where owner_id = $1 and clave = $2',
        [usuarios.propietario, 'NA-XLSX-GRUAS-0095'],
      );
      await cliente.query(
        'update public.towing_rates set monto_usd = 230 where owner_id = $1 and clave = $2',
        [usuarios.propietario, 'NA-XLSX-GRUAS-0089'],
      );
      await cliente.query(
        'update public.quotes set grua_usd = 225, grua_referencia_clave = $2 where id = $1',
        [datos.cotizacion, 'NA-XLSX-GRUAS-0095'],
      );

      await cliente.query(sql);
      assert.equal(await monto('NA-XLSX-GRUAS-0095'), 265);
      assert.equal(await monto('NA-XLSX-GRUAS-0095', 'monto_usd_anterior'), 225);
      assert.equal(await monto('NA-XLSX-GRUAS-0095', 'pdf_pagina'), 7);
      assert.equal(await monto('NA-XLSX-GRUAS-0089'), 230, 'una tarifa editada a mano no se sobrescribe');

      await cliente.query(sql);
      assert.equal(await monto('NA-XLSX-GRUAS-0095'), 265, 'segunda ejecución sin cambios');
      assert.equal(await monto('NA-XLSX-GRUAS-0095', 'monto_usd_anterior'), 225);

      const { rows: cotizacion } = await cliente.query(
        'select grua_usd, grua_referencia_clave from public.quotes where id = $1',
        [datos.cotizacion],
      );
      assert.equal(Number(cotizacion[0].grua_usd), 225, 'la cotización conserva el importe que guardó');
      assert.equal(cotizacion[0].grua_referencia_clave, 'NA-XLSX-GRUAS-0095');

      const { rows: nashville } = await cliente.query(
        `select alias_sedes->0->>'sede' as sede from public.towing_rates where owner_id = $1 and clave = 'NA-XLSX-GRUAS-0238'`,
        [usuarios.propietario],
      );
      assert.equal(nashville[0].sede, 'NASHVILLE');
    },
  },
  {
    id: 'C08',
    nombre: 'Corregir el VIN de un vehículo conserva la cotización y su compra',
    async ejecutar({ cliente, usuarios, datos }) {
      await comoRol(cliente, 'authenticated', usuarios.propietario, async () => {
        const incompleto = await cliente.query('update public.vehicles set vin = $1 where id = $2 returning id', [
          'JHLRE38797C00907',
          datos.vehiculoPropio,
        ]);
        assert.equal(incompleto.rowCount, 1, 'un VIN incompleto se puede guardar');
        const correccion = await cliente.query(
          'update public.vehicles set vin = $1 where id = $2 returning id',
          ['JHLRE38797C009075', datos.vehiculoPropio],
        );
        assert.equal(correccion.rowCount, 1);
        const { rows } = await cliente.query(
          `select v.vin,
                  (select count(*)::int from public.quotes q where q.vehicle_id = v.id) as cotizaciones,
                  (select count(*)::int from public.purchases p where p.quote_id = $2) as compras
           from public.vehicles v where v.id = $1`,
          [datos.vehiculoPropio, datos.cotizacion],
        );
        assert.equal(rows[0].vin, 'JHLRE38797C009075');
        assert.equal(rows[0].cotizaciones, 1);
        assert.equal(rows[0].compras, 1);
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
