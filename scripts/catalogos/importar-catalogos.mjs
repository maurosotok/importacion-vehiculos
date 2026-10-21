import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARPETA_CATALOGOS = path.join(RAIZ, 'data', 'catalogos');

const SUBASTA_POR_ORIGEN = { IAA: 'IAA', COPART: 'COPART', CUSTOM: 'OTRA' };
const ESTADO_TABLA_POR_ORIGEN = { not_bundled: 'no_incluida', manual: 'no_incluida' };

async function leerCatalogo(nombre) {
  return JSON.parse(await readFile(path.join(CARPETA_CATALOGOS, nombre), 'utf8'));
}

const aJson = (valor) => JSON.stringify(valor ?? null);

function construirFilas(catalogos) {
  const { perfiles, gruas, embarques, navieras, proveedores, tipos, preferencias } = catalogos;

  const filasPerfiles = perfiles.profiles.map((p) => ({
    clave: p.id,
    etiqueta: p.label,
    subasta: SUBASTA_POR_ORIGEN[p.auction],
    segmento: p.segment,
    nivel_precio: p.pricing_tier,
    tipo_licencia: p.license_type,
    es_predeterminado: p.is_default,
    seleccionable: p.selectable,
    permite_total_manual: p.allow_manual_total,
    url_fuente: p.source_url,
    estado_tabla: ESTADO_TABLA_POR_ORIGEN[p.fee_table_status] ?? 'no_incluida',
    parametros: aJson({ parameter_options: p.parameter_options }),
  }));

  const filasGruas = gruas.rates.map((r) => ({
    clave: r.id,
    proveedor: r.provider,
    zona_salida: r.departure_zone,
    estado_origen: r.origin_state_raw,
    etiqueta_origen: r.location_label_raw,
    etiqueta: r.display_label,
    monto_usd: r.amount_usd,
    precio_crudo: r.raw_price,
    nota_nieve: r.raw_snow_note,
    estado: r.status,
    notas: aJson(r.nonblocking_notes),
    permite_ajuste_manual: r.allow_manual_override,
    fuente_archivo: r.source_file,
    fuente_hoja: r.source_sheet,
    fuente_fila: r.source_row,
    alias_sedes: aJson(r.alias_sedes ?? []),
    monto_usd_anterior: r.amount_usd_excel_anterior ?? null,
    fuente_tarifa: r.fuente_tarifa ?? null,
    pdf_pagina: r.pdf_pagina ?? null,
    version_tarifa: r.version_tarifa ?? null,
  }));

  const filasEmbarques = embarques.rates.map((r) => ({
    clave: r.id,
    proveedor: r.provider,
    servicio: r.service,
    zona_salida: r.departure_zone,
    pais_destino: r.destination_country,
    puerto_destino: r.destination_port,
    categoria: r.category_code,
    categoria_origen_texto: r.source_category_label,
    largo_max_pulgadas: r.length_max_inches_inclusive,
    monto: r.amount,
    moneda: r.currency,
    documento_fuente: r.source_document,
    pagina: r.source_page,
    vigente_desde: r.source_stated_effective_from,
    vigente_hasta: r.effective_to,
    estado_activacion: r.activation_status,
    condiciones_fuente: r.conditions_source,
    version_documento: r.source_document_version,
    permite_ajuste_manual: r.allow_manual_override,
  }));

  const filasTipos = tipos.vehicle_types.flatMap((tipo) =>
    Object.entries(tipo.source_category_by_zone).map(([zona, categoria]) => ({
      clave: `${tipo.code}:${zona}`,
      tipo_codigo: tipo.code,
      zona_salida: zona,
      categoria_origen: categoria,
      base_asociacion: tipo.mapping_basis,
    })),
  );

  const filasNavieras = navieras.providers.map((n) => ({
    clave: n.id,
    nombre: n.name,
    papeleria_predeterminada_usd: n.paperwork_default_usd,
    papeleria_referencias: aJson(n.paperwork_reference_values),
    notas: n.note,
  }));

  const filasProveedores = proveedores.suppliers.map((s) => ({
    clave: s.id,
    nombre: s.display_name,
    nombre_original: s.header_original,
    telefono_proporcionado: s.phone_as_provided,
    telefono_verificado: s.phone_verified,
    clasificacion: s.supplier_type,
    pais: s.country_code,
  }));

  const ajustes = {
    perfil_fees_clave: preferencias.default_fee_profile_id,
    proveedor_clave: preferencias.default_provider,
    pago_unico_hnl: preferencias.one_time_tax_quickfill_hnl,
    gastos_locales_referencia_min_hnl: preferencias.local_expense_reference_range_hnl[0],
    gastos_locales_referencia_max_hnl: preferencias.local_expense_reference_range_hnl[1],
  };

  return [
    { tabla: 'fee_profiles', filas: filasPerfiles },
    { tabla: 'towing_rates', filas: filasGruas },
    { tabla: 'shipping_rates', filas: filasEmbarques },
    { tabla: 'vehicle_type_mappings', filas: filasTipos },
    { tabla: 'logistics_providers', filas: filasNavieras },
    { tabla: 'suppliers', filas: filasProveedores },
    { tabla: 'user_settings', filas: [ajustes], sinClave: true },
  ];
}

function sentenciaInsercion(tabla, columnas, sinClave) {
  const lista = ['owner_id', ...columnas].join(', ');
  const marcadores = ['$1', ...columnas.map((_, i) => `$${i + 2}`)].join(', ');
  const conflicto = sinClave ? '(owner_id)' : '(owner_id, clave)';
  return `insert into public.${tabla} (${lista}) values (${marcadores}) on conflict ${conflicto} do nothing returning 1`;
}

export async function importarCatalogos(cliente, propietarioId, catalogos) {
  const datos = catalogos ?? (await cargarCatalogosDesdeDisco());
  const resumen = {};
  await cliente.query('begin');
  try {
    const propietario = await cliente.query('select 1 from public.app_owner where user_id = $1', [propietarioId]);
    if (propietario.rowCount !== 1) {
      throw new Error('El usuario indicado no está registrado en app_owner. Ejecute primero el alta del propietario.');
    }
    for (const { tabla, filas, sinClave } of construirFilas(datos)) {
      resumen[tabla] = { insertados: 0, ya_existian: 0 };
      for (const fila of filas) {
        const columnas = Object.keys(fila);
        const valores = Object.values(fila);
        const insertado = await cliente.query(sentenciaInsercion(tabla, columnas, sinClave), [propietarioId, ...valores]);
        if (insertado.rowCount === 1) resumen[tabla].insertados += 1;
        else resumen[tabla].ya_existian += 1;
      }
    }
    resumen.fee_schedule_versions = await importarVersionesFees(cliente, propietarioId, datos.tablasFees);
    await cliente.query('commit');
  } catch (error) {
    await cliente.query('rollback');
    throw error;
  }
  return resumen;
}

async function importarVersionesFees(cliente, propietarioId, catalogoTablas) {
  const resumen = { insertados: 0, ya_existian: 0 };
  for (const version of catalogoTablas.versiones) {
    const insertado = await cliente.query(
      `insert into public.fee_schedule_versions
         (owner_id, fee_profile_clave, etiqueta_version, vigente_desde, es_activa, estado_verificacion, notas, contenido)
       values ($1, $2, $3, $4,
         not exists (select 1 from public.fee_schedule_versions
                     where owner_id = $1 and fee_profile_clave = $2 and es_activa),
         'pendiente', $5, $6)
       on conflict (owner_id, fee_profile_clave, etiqueta_version) do nothing
       returning 1`,
      [propietarioId, version.perfilId, version.version, version.fechaFuente, version.fuente, JSON.stringify(version)],
    );
    if (insertado.rowCount === 1) resumen.insertados += 1;
    else resumen.ya_existian += 1;
  }
  return resumen;
}

async function cargarCatalogosDesdeDisco() {
  const [perfiles, gruas, embarques, navieras, proveedores, tipos, preferencias, tablasFees] = await Promise.all([
    leerCatalogo('perfiles_fees.json'),
    leerCatalogo('gruas_desde_excel.json'),
    leerCatalogo('embarques_referencia_2025.json'),
    leerCatalogo('navieras.json'),
    leerCatalogo('proveedores_repuestos.json'),
    leerCatalogo('tipos_vehiculo.json'),
    leerCatalogo('preferencias_iniciales.json'),
    leerCatalogo('tablas_fees_manual.json'),
  ]);
  return { perfiles, gruas, embarques, navieras, proveedores, tipos, preferencias, tablasFees };
}

async function principal() {
  const urlBase = process.env.DATABASE_URL;
  const propietarioId = process.env.APP_OWNER_USER_ID;
  if (!urlBase || !propietarioId) {
    throw new Error('Defina DATABASE_URL (conexión de servidor) y APP_OWNER_USER_ID antes de importar.');
  }
  const cliente = new pg.Client({ connectionString: urlBase });
  await cliente.connect();
  try {
    const resumen = await importarCatalogos(cliente, propietarioId);
    console.table(resumen);
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
