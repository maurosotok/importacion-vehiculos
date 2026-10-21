import { describe, expect, it } from 'vitest';
import versionTexto from '../../data/catalogos/tablas_fees_manual.json?raw';
import { calcularCotizacion, type EntradasCotizacion } from './calculo';
import { calcularTablaFees, type VersionFees } from './fees';

const version = (JSON.parse(versionTexto) as { versiones: VersionFees[] }).versiones[0] as VersionFees;
const feeTabla = calcularTablaFees('2000', version, 'internet_live');

const honda: EntradasCotizacion = {
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

describe('regresión Honda CR-V 2007 (IAA, puja 2000)', () => {
  it('la tabla IAA da fees 795 para puja 2000', () => {
    expect(feeTabla.ok && feeTabla.total.toString()).toBe('795');
  });

  it('partidas en USD suman 4135 con fees 795, grúa 500, barco 825 y papelería 15', () => {
    const r = calcularCotizacion(honda);
    expect(r.subtotalUsd.toFixed(2)).toBe('4135.00');
    expect(r.pendientes).toEqual([]);
  });

  it('total importado L132,761.19 con impuesto L10,000 y gastos locales L11,000', () => {
    expect(calcularCotizacion(honda).importadoHnl?.toFixed(2)).toBe('132761.19');
  });

  it('inversión L152,761.19 con reparación L20,000', () => {
    expect(calcularCotizacion(honda).inversionHnl?.toFixed(2)).toBe('152761.19');
  });

  it('utilidad L37,238.81 sobre precio de venta L190,000', () => {
    const r = calcularCotizacion(honda);
    expect(r.utilidadHnl?.toFixed(2)).toBe('37238.81');
    expect(r.utilidadTipo).toBe('final');
  });
});
