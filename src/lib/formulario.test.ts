import { describe, expect, it } from 'vitest';
import tablasTexto from '../../data/catalogos/tablas_fees_manual.json?raw';
import type { VersionFees } from '../motor/fees';
import {
  aEntradas,
  aFormulario,
  construirParches,
  resolverFees,
  snapshotFees,
  type Campos,
  type CotizacionFila,
  type VehiculoFila,
  type VersionFeesActiva,
} from './formulario';

const vehiculo: VehiculoFila = {
  id: 'v1',
  vin: null,
  marca: null,
  modelo: null,
  version: null,
  anio: null,
  row_version: 1,
};

const cotizacion: CotizacionFila = {
  id: 'c1',
  vehicle_id: 'v1',
  estado: 'borrador',
  referencia: null,
  fecha_negocio: '2026-10-20',
  subasta: 'IAA',
  ubicacion: null,
  zona_salida: null,
  tipo_vehiculo: null,
  perfil_fees_clave: null,
  modo_fees: 'total_fees',
  modalidad_puja: null,
  puja_usd: null,
  fees_usd: null,
  carro_mas_fees_usd: null,
  grua_usd: null,
  barco_usd: null,
  papeleria_usd: null,
  tipo_cambio_hnl_por_usd: null,
  modo_impuestos: 'pendiente',
  total_combinado_hnl: null,
  impuesto_hnl: null,
  gastos_locales_hnl: null,
  reparacion_hnl: null,
  precio_venta_hnl: null,
  notas: null,
  grua_fuente: null,
  grua_referencia_clave: null,
  barco_fuente: null,
  barco_referencia_clave: null,
  vendedor: null,
  fecha_subasta: null,
  max_bid_manual_usd: null,
  verificacion_bidcars: null,
  row_version: 1,
};

function campos(parcial: Partial<Campos>): Campos {
  return { ...aFormulario(vehiculo, cotizacion), ...parcial };
}

describe('aFormulario', () => {
  it('convierte filas ausentes en texto vacío y conserva la procedencia', () => {
    const datos = aFormulario(vehiculo, { ...cotizacion, grua_fuente: 'referencia', grua_referencia_clave: 'g-1' });
    expect(datos.gruaFuente).toBe('referencia');
    expect(datos.gruaReferenciaClave).toBe('g-1');
    expect(datos.fechaSubasta).toBe('');
    expect(datos.maxBidManualUsd).toBe('');
  });
});

describe('construirParches', () => {
  it('acepta fecha de subasta en formato AAAA-MM-DD', () => {
    const parches = construirParches(campos({ fechaSubasta: '2026-11-03' }));
    expect(parches.invalidos).not.toContain('fechaSubasta');
    expect(parches.cotizacion.fecha_subasta).toBe('2026-11-03');
  });

  it('marca como inválida una fecha mal formada sin escribirla', () => {
    const parches = construirParches(campos({ fechaSubasta: '03/11/2026' }));
    expect(parches.invalidos).toContain('fechaSubasta');
    expect(parches.cotizacion).not.toHaveProperty('fecha_subasta');
  });

  it('guarda fecha vacía como nulo', () => {
    const parches = construirParches(campos({ fechaSubasta: '  ' }));
    expect(parches.cotizacion.fecha_subasta).toBeNull();
  });

  it('guarda la puja máxima manual como decimal exacto', () => {
    const parches = construirParches(campos({ maxBidManualUsd: '2200.50' }));
    expect(parches.cotizacion.max_bid_manual_usd).toBe('2200.5');
  });

  it('rechaza puja máxima negativa', () => {
    const parches = construirParches(campos({ maxBidManualUsd: '-1' }));
    expect(parches.invalidos).toContain('maxBidManualUsd');
  });

  it('no escribe la grúa como cero cuando está vacía', () => {
    const parches = construirParches(campos({ gruaUsd: '' }));
    expect(parches.cotizacion.grua_usd).toBeNull();
  });

  it('guarda la procedencia de barco y grúa tal como llega', () => {
    const parches = construirParches(
      campos({ barcoFuente: 'referencia', barcoReferenciaClave: 'b-7', gruaFuente: 'manual' }),
    );
    expect(parches.cotizacion.barco_fuente).toBe('referencia');
    expect(parches.cotizacion.barco_referencia_clave).toBe('b-7');
    expect(parches.cotizacion.grua_fuente).toBe('manual');
  });

  it('convierte el VIN a mayúsculas y lo deja nulo si está vacío', () => {
    expect(construirParches(campos({ vin: 'abc' })).vehiculo.vin).toBe('ABC');
    expect(construirParches(campos({ vin: '' })).vehiculo.vin).toBeNull();
  });
});

const tablas = JSON.parse(tablasTexto) as { versiones: VersionFees[] };
const iaa = tablas.versiones[0] as VersionFees;
const versionesFees: VersionFeesActiva[] = [{ perfilClave: 'iaa_standard_volume', contenido: iaa }];

describe('tabla automática de fees en el editor', () => {
  const conTabla = (parcial: Partial<Campos>) =>
    campos({ perfilFeesClave: 'iaa_standard_volume', modoFees: 'tabla', pujaUsd: '2000', ...parcial });

  it('calcula 795 con la modalidad única documentada cuando no se captura otra', () => {
    const resolucion = resolverFees(conTabla({}), versionesFees);
    expect(resolucion.modalidad).toBe('internet_live');
    expect(resolucion.resultado.ok && resolucion.resultado.total.toString()).toBe('795');
  });

  it('pasa el total a feeTablaUsd sin tocar el campo manual de fees', () => {
    const datos = conTabla({ feesUsd: '900' });
    const total = resolverFees(datos, versionesFees).resultado;
    expect(aEntradas(datos, total.ok ? total.total.toString() : null)).toMatchObject({
      modoFees: 'tabla',
      feeTablaUsd: '795',
      feesUsd: '900',
    });
  });

  it('sin tabla para el perfil no produce total', () => {
    const resolucion = resolverFees(conTabla({ perfilFeesClave: 'copart_otro' }), versionesFees);
    expect(resolucion.version).toBeNull();
    expect(resolucion.resultado).toEqual({ ok: false, motivo: 'sin_tabla' });
  });

  it('puja vacía no produce total', () => {
    const resolucion = resolverFees(conTabla({ pujaUsd: '' }), versionesFees);
    expect(resolucion.resultado).toEqual({ ok: false, motivo: 'puja_invalida' });
  });

  it('la modalidad capturada prevalece sobre la inferida', () => {
    const resolucion = resolverFees(conTabla({ modalidadPuja: 'proxy' }), versionesFees);
    expect(resolucion.modalidad).toBe('proxy');
    expect(resolucion.resultado).toEqual({ ok: false, motivo: 'modalidad_no_documentada' });
  });

  it('guarda el desglose y la versión solo cuando el modo es tabla y el cálculo es válido', () => {
    const datos = conTabla({});
    const snapshot = snapshotFees(datos, resolverFees(datos, versionesFees));
    expect(snapshot.fees_version).toBe(iaa.version);
    expect(snapshot.modalidad_puja).toBe('internet_live');
    const desglose = snapshot.fees_desglose as { concepto: string; monto: string }[];
    expect(desglose.map((l) => l.monto)).toEqual(['535', '110', '105', '25', '20']);
  });

  it('en modo manual no guarda desglose ni versión', () => {
    const datos = conTabla({ modoFees: 'total_fees' });
    expect(snapshotFees(datos, resolverFees(datos, versionesFees))).toMatchObject({
      fees_version: null,
      fees_desglose: [],
    });
  });

  it('con puja inválida no guarda desglose', () => {
    const datos = conTabla({ pujaUsd: '' });
    expect(snapshotFees(datos, resolverFees(datos, versionesFees)).fees_desglose).toEqual([]);
  });
});
