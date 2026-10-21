import { describe, expect, it } from 'vitest';
import versionTexto from '../../data/catalogos/tablas_fees_manual.json?raw';
import { calcularCotizacion, type EntradasCotizacion } from './calculo';
import { calcularTablaFees, type VersionFees } from './fees';

const version = (JSON.parse(versionTexto) as { versiones: VersionFees[] }).versiones[0] as VersionFees;
const feeTabla = calcularTablaFees('2000', version, 'internet_live');

const base: EntradasCotizacion = {
  pujaUsd: '2000',
  modoFees: 'tabla',
  feesUsd: null,
  carroMasFeesUsd: null,
  feeTablaUsd: feeTabla.ok ? feeTabla.total.toString() : null,
  gruaUsd: '500',
  barcoUsd: '825',
  papeleriaUsd: '15',
  tipoCambioHnlPorUsd: '27.0281',
  modoImpuestos: 'desglose',
  totalCombinadoHnl: null,
  impuestoHnl: '10000',
  gastosLocalesHnl: '11000',
  reparacionHnl: '20000',
  precioVentaHnl: '190000',
};

describe('fees: tabla y sustitución manual', () => {
  it('sin captura manual usa la tabla (795 para puja 2000)', () => {
    expect(calcularCotizacion(base).feesUsd?.toFixed(2)).toBe('795.00');
    expect(calcularCotizacion(base).subtotalUsd.toFixed(2)).toBe('4135.00');
  });

  it('un fee manual de 800 sustituye la tabla de 795', () => {
    const r = calcularCotizacion({ ...base, feesUsd: '800' });
    expect(r.feesUsd?.toFixed(2)).toBe('800.00');
    expect(r.feesFuente).not.toBe('tabla');
    expect(r.subtotalUsd.toFixed(2)).toBe('4140.00');
  });

  it('al borrar el fee manual vuelve a la tabla de 795', () => {
    const r = calcularCotizacion({ ...base, feesUsd: null });
    expect(r.feesUsd?.toFixed(2)).toBe('795.00');
    expect(r.subtotalUsd.toFixed(2)).toBe('4135.00');
  });
});
