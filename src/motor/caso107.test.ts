import { describe, expect, it } from 'vitest';
import casoTexto from '../../data/fixtures/caso_107.json?raw';
import tablasTexto from '../../data/catalogos/tablas_fees_manual.json?raw';
import { calcularCotizacion, type EntradasCotizacion } from './calculo';
import { calcularTablaFees, validarVersionFees, type VersionFees } from './fees';

type Caso107 = {
  inputs: {
    bid_usd: string;
    fees_total_usd: string;
    carro_mas_fees_usd: string;
    towing_usd: string;
    ocean_usd: string;
    paperwork_usd: string;
    exchange_rate_hnl_per_usd: string;
    tax_manual_hnl: string;
    local_expenses_hnl: string;
    repair_budget_hnl: string;
    expected_sale_hnl: string;
  };
  expected: {
    cash_usd: string;
    tax_plus_local_hnl: string;
    imported_hnl: string;
    investment_hnl: string;
    profit_hnl: string;
    imported_usd_equivalent: string;
  };
  excel_comparison: { original_total_hnl: string; difference_hnl: string };
};

type CatalogoTablas = { versiones: VersionFees[] };

const caso = JSON.parse(casoTexto) as Caso107;
const version = (JSON.parse(tablasTexto) as CatalogoTablas).versiones[0] as VersionFees;
const sinCargos: VersionFees = { ...version, cargos: [] };

const entradasBase: EntradasCotizacion = {
  pujaUsd: caso.inputs.bid_usd,
  modoFees: 'tabla',
  feesUsd: null,
  carroMasFeesUsd: null,
  feeTablaUsd: caso.inputs.fees_total_usd,
  gruaUsd: caso.inputs.towing_usd,
  barcoUsd: caso.inputs.ocean_usd,
  papeleriaUsd: caso.inputs.paperwork_usd,
  tipoCambioHnlPorUsd: caso.inputs.exchange_rate_hnl_per_usd,
  modoImpuestos: 'desglose',
  totalCombinadoHnl: null,
  impuestoHnl: caso.inputs.tax_manual_hnl,
  gastosLocalesHnl: caso.inputs.local_expenses_hnl,
  reparacionHnl: caso.inputs.repair_budget_hnl,
  precioVentaHnl: caso.inputs.expected_sale_hnl,
};

describe('tabla IAA Standard Volume (data/catalogos/tablas_fees_manual.json)', () => {
  it('es una versión válida sin errores de validación', () => {
    expect(validarVersionFees(version)).toEqual([]);
  });

  it('declara vigencia 2024-11-04 y conserva 2024-10-23 solo como fecha del archivo', () => {
    expect(version.fechaFuente).toBe('2024-11-04');
    expect(version.fuente).toContain('20241023');
  });

  it('reproduce buyer fee 535 y cargos del caso real para puja 2000 con internet_live', () => {
    const r = calcularTablaFees('2000', version, 'internet_live');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total.toFixed(2)).toBe('795.00');
    expect(r.lineas.map((l) => l.monto.toFixed(2))).toEqual(['535.00', '110.00', '105.00', '25.00', '20.00']);
    expect(r.lineas[1]?.estado).toBe('caso_real');
  });

  it('respeta límites de tramo: 49.99 cae en 25 y 50 en 45 (versión sin cargos)', () => {
    const bajo = calcularTablaFees('49.99', sinCargos, 'internet_live');
    const alto = calcularTablaFees('50', sinCargos, 'internet_live');
    expect(bajo.ok && bajo.total.toFixed(2)).toBe('25.00');
    expect(alto.ok && alto.total.toFixed(2)).toBe('45.00');
  });

  it('ejemplo real 2000 → fees 795 y Internet Bid 110', () => {
    const r = calcularTablaFees('2000', version, 'internet_live');
    expect(r.ok && r.total.toFixed(2)).toBe('795.00');
    expect(r.ok && r.lineas[1]?.monto.toFixed(2)).toBe('110.00');
  });

  it('ejemplo real 3500 → fees 965 y Internet Bid 110', () => {
    const r = calcularTablaFees('3500', version, 'internet_live');
    expect(r.ok && r.total.toFixed(2)).toBe('965.00');
    expect(r.ok && r.lineas[1]?.monto.toFixed(2)).toBe('110.00');
  });

  it('ejemplo real 3750 → fees 965 y Internet Bid 110', () => {
    const r = calcularTablaFees('3750', version, 'internet_live');
    expect(r.ok && r.total.toFixed(2)).toBe('965.00');
    expect(r.ok && r.lineas[1]?.monto.toFixed(2)).toBe('110.00');
  });

  it('ejemplo real 4000 → fees 1000 y Internet Bid 125 (no aplica 110)', () => {
    const r = calcularTablaFees('4000', version, 'internet_live');
    expect(r.ok && r.total.toFixed(2)).toBe('1000.00');
    expect(r.ok && r.lineas[1]?.monto.toFixed(2)).toBe('125.00');
    expect(r.ok && r.lineas[1]?.estado).toBe('caso_real');
  });

  it('puja 4500 no tiene cobertura documentada del Internet Bid y no inventa total', () => {
    expect(calcularTablaFees('4500', version, 'internet_live')).toEqual({ ok: false, motivo: 'cargo_sin_cobertura' });
  });

  it('modalidad proxy no documentada para esta versión no produce total', () => {
    expect(calcularTablaFees('2000', version, 'proxy')).toEqual({ ok: false, motivo: 'modalidad_no_documentada' });
  });

  it('aplica 7.5% desde 15000 sin cargos de rango (versión de prueba)', () => {
    const r = calcularTablaFees('20000', sinCargos, 'internet_live');
    expect(r.ok && r.total.toFixed(2)).toBe('1500.00');
  });
});

describe('caso 107 desde data/fixtures/caso_107.json', () => {
  const esperado = caso.expected;

  it('calcula efectivo USD una sola vez y el total con la tabla y los cargos', () => {
    const r = calcularCotizacion(entradasBase);
    expect(r.feesUsd?.toFixed(2)).toBe('795.00');
    expect(r.cashUsd?.toFixed(2)).toBe(esperado.cash_usd);
  });

  it('reproduce impuestos+gastos locales, importado, inversión, utilidad y equivalente USD', () => {
    const r = calcularCotizacion(entradasBase);
    expect(r.impuestosHnl?.toFixed(2)).toBe(esperado.tax_plus_local_hnl);
    expect(r.importadoHnl?.toFixed(2)).toBe(esperado.imported_hnl);
    expect(r.inversionHnl?.toFixed(2)).toBe(esperado.investment_hnl);
    expect(r.utilidadHnl?.toFixed(2)).toBe(esperado.profit_hnl);
    expect(r.importadoUsdEquivalente?.toFixed(2)).toBe(esperado.imported_usd_equivalent);
    expect(r.utilidadTipo).toBe('final');
  });

  it('carro + fees 2795 deriva el mismo fee de 795 sin sumarlo dos veces', () => {
    const r = calcularCotizacion({
      ...entradasBase,
      modoFees: 'carro_mas_fees',
      feeTablaUsd: null,
      carroMasFeesUsd: caso.inputs.carro_mas_fees_usd,
    });
    expect(r.feesUsd?.toFixed(2)).toBe('795.00');
    expect(r.feesFuente).toBe('carro_mas_fees');
    expect(r.cashUsd?.toFixed(2)).toBe(esperado.cash_usd);
  });

  it('la diferencia con el Excel original es gastos locales 13557 más papelería 15 USD × 27.0281', () => {
    const r = calcularCotizacion(entradasBase);
    const diferencia = r.importadoHnl?.minus(caso.excel_comparison.original_total_hnl);
    expect(diferencia?.toFixed(4)).toBe(caso.excel_comparison.difference_hnl);
  });
});

describe('ejemplos reales de regresión de fees (carro + fees)', () => {
  const casos = [
    { puja: '2000', carroMasFees: '2795', fees: '795.00' },
    { puja: '3500', carroMasFees: '4465', fees: '965.00' },
    { puja: '3750', carroMasFees: '4715', fees: '965.00' },
    { puja: '4000', carroMasFees: '5000', fees: '1000.00' },
  ];

  it.each(casos)('puja $puja: carro + fees $carroMasFees deriva fees $fees', ({ puja, carroMasFees, fees }) => {
    const r = calcularCotizacion({
      ...entradasBase,
      pujaUsd: puja,
      modoFees: 'carro_mas_fees',
      feeTablaUsd: null,
      carroMasFeesUsd: carroMasFees,
    });
    expect(r.feesUsd?.toFixed(2)).toBe(fees);
  });
});
