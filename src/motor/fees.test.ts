import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import plantillaTexto from '../../data/catalogos/tablas_fees_manual.json?raw';
import { calcularTablaFees, validarVersionFees, type VersionFees } from './fees';

const base: VersionFees = {
  perfilId: 'iaa_standard_volume',
  version: 'prueba-1',
  fuente: 'Captura de prueba',
  fechaFuente: '2026-10-01',
  estado: 'verificada',
  convencionLimite: 'desde_incluido_hasta_excluido',
  modalidades: ['internet_live', 'proxy'],
  tramos: [
    { desde: null, hasta: '1000', tipo: 'fijo', valor: '100' },
    { desde: '1000', hasta: '2000', tipo: 'porcentaje', valor: '10' },
    { desde: '2000', hasta: null, tipo: 'porcentaje', valor: '7.5' },
  ],
  cargos: [
    { codigo: 'servicio', etiqueta: 'Servicio', monto: '25', modalidad: null },
    { codigo: 'live', etiqueta: 'Cargo en vivo', monto: '15', modalidad: 'internet_live' },
  ],
};

describe('validarVersionFees', () => {
  it('acepta tramos contiguos y abiertos en ambos extremos', () => {
    expect(validarVersionFees(base)).toEqual([]);
  });

  it('acepta un primer tramo que empieza en cero', () => {
    const version: VersionFees = {
      ...base,
      tramos: [{ desde: '0', hasta: '1000', tipo: 'fijo', valor: '100' }, { desde: '1000', hasta: null, tipo: 'porcentaje', valor: '7.5' }],
    };
    expect(validarVersionFees(version)).toEqual([]);
  });

  it('rechaza un hueco entre tramos', () => {
    const version = { ...base, tramos: [base.tramos[0], { ...base.tramos[2], desde: '1500' }] } as VersionFees;
    expect(validarVersionFees(version).join(' ')).toContain('no son contiguos');
  });

  it('rechaza verificada sin fuente o fecha', () => {
    expect(validarVersionFees({ ...base, fuente: null }).join(' ')).toContain('verificada sin fuente');
  });

  it('rechaza porcentaje mayor que 100 y tramo con desde mayor que hasta', () => {
    const version: VersionFees = {
      ...base,
      tramos: [{ desde: null, hasta: '1000', tipo: 'porcentaje', valor: '120' }],
    };
    expect(validarVersionFees(version).join(' ')).toContain('porcentaje mayor que 100');
    const invertido: VersionFees = {
      ...base,
      tramos: [{ desde: '500', hasta: '100', tipo: 'fijo', valor: '1' }],
    };
    expect(validarVersionFees(invertido).join(' ')).toContain('desde debe ser menor');
  });

  it('exige que el primer tramo no tenga límite inferior y el último quede abierto', () => {
    const cerrado: VersionFees = { ...base, tramos: [{ desde: null, hasta: '1000', tipo: 'fijo', valor: '100' }] };
    expect(validarVersionFees(cerrado).join(' ')).toContain('debe quedar abierto');
  });
});

describe('calcularTablaFees con convención desde incluido, hasta excluido', () => {
  it('la puja exactamente en el corte entra al tramo superior', () => {
    const r = calcularTablaFees('1000', base, 'internet_live');
    expect(r.ok && r.tramoIndice).toBe(1);
    expect(r.ok && r.total.toString()).toBe('140');
  });

  it('justo debajo del corte queda en el tramo inferior', () => {
    const r = calcularTablaFees('999.99', base, 'internet_live');
    expect(r.ok && r.tramoIndice).toBe(0);
    expect(r.ok && r.lineas[0]?.monto.toString()).toBe('100');
  });

  it('en el corte 2000 entra al tramo abierto', () => {
    const r = calcularTablaFees('2000', base, 'internet_live');
    expect(r.ok && r.tramoIndice).toBe(2);
  });
});

describe('convención desde excluido, hasta incluido', () => {
  const alternativa: VersionFees = { ...base, convencionLimite: 'desde_excluido_hasta_incluido' };

  it('la puja exactamente en el corte queda en el tramo inferior', () => {
    expect(calcularTablaFees('1000', alternativa, 'internet_live')).toMatchObject({ ok: true, tramoIndice: 0 });
    expect(calcularTablaFees('1000.01', alternativa, 'internet_live')).toMatchObject({ ok: true, tramoIndice: 1 });
  });
});

describe('porcentaje, cargos y motivos', () => {
  it('redondeo exacto del porcentaje sin perder decimales', () => {
    const r = calcularTablaFees('1234.56', base, 'internet_live');
    expect(r.ok && r.lineas[0]?.monto.toString()).toBe('123.456');
  });

  it('cargo por modalidad solo se suma cuando la modalidad coincide', () => {
    const live = calcularTablaFees('2200', base, 'internet_live');
    const proxy = calcularTablaFees('2200', base, 'proxy');
    expect(live.ok && live.total.toString()).toBe(new Decimal('2200').times('7.5').div(100).plus(25).plus(15).toString());
    expect(proxy.ok && proxy.total.toString()).toBe(new Decimal('2200').times('7.5').div(100).plus(25).toString());
  });

  it('modalidad no documentada o ausente no produce total parcial', () => {
    expect(calcularTablaFees('2200', base, null)).toEqual({ ok: false, motivo: 'modalidad_no_documentada' });
    expect(calcularTablaFees('2200', base, 'otra')).toEqual({ ok: false, motivo: 'modalidad_no_documentada' });
  });

  it('sin versión o sin tramos devuelve sin_tabla y nunca cero', () => {
    expect(calcularTablaFees('2200', null, 'internet_live')).toEqual({ ok: false, motivo: 'sin_tabla' });
    expect(calcularTablaFees('2200', { ...base, tramos: [], estado: 'pendiente' }, 'internet_live')).toEqual({
      ok: false,
      motivo: 'sin_tabla',
    });
  });

  it('una versión inválida no produce total', () => {
    const invalida = { ...base, fuente: null };
    expect(calcularTablaFees('2200', invalida, 'internet_live')).toEqual({ ok: false, motivo: 'version_invalida' });
  });

  it('puja vacía o negativa no produce total', () => {
    expect(calcularTablaFees(null, base, 'internet_live')).toEqual({ ok: false, motivo: 'puja_invalida' });
    expect(calcularTablaFees('-1', base, 'internet_live')).toEqual({ ok: false, motivo: 'puja_invalida' });
  });
});

describe('tarifas manuales cargadas', () => {
  it('cada versión del catálogo debe validar y declarar fuente y fecha', () => {
    const catalogo = JSON.parse(plantillaTexto) as { versiones: VersionFees[]; estado: string };
    expect(['pendiente', 'captura_manual', 'verificada']).toContain(catalogo.estado);
    for (const version of catalogo.versiones) {
      expect(validarVersionFees(version)).toEqual([]);
      expect(version.fuente).toBeTruthy();
      expect(version.fechaFuente).toBeTruthy();
    }
  });
});
