import { describe, expect, it } from 'vitest';
import casoTexto from '../../data/fixtures/caso_104.json?raw';
import { calcularCotizacion, type EntradasCotizacion } from './calculo';

type CasoFixture = {
  inputs: {
    bid_usd: string;
    fees_usd: string;
    towing_usd: string;
    ocean_usd: string;
    paperwork_usd: string;
    exchange_rate_hnl_per_usd: string;
    manual_combined_landing_hnl: string;
    repair_budget_hnl: string;
    expected_sale_hnl: string;
  };
  new_calculation_explicit_change: {
    cash_components_usd: string;
    total_usd_display: string;
    total_hnl_unrounded: string;
    total_hnl_display: string;
    with_repair_hnl_display: string;
    profit_hnl_display: string;
  };
};

const caso = JSON.parse(casoTexto) as CasoFixture;

const entradas: EntradasCotizacion = {
  pujaUsd: caso.inputs.bid_usd,
  modoFees: 'total_fees',
  feesUsd: caso.inputs.fees_usd,
  carroMasFeesUsd: null,
  feeTablaUsd: null,
  gruaUsd: caso.inputs.towing_usd,
  barcoUsd: caso.inputs.ocean_usd,
  papeleriaUsd: caso.inputs.paperwork_usd,
  tipoCambioHnlPorUsd: caso.inputs.exchange_rate_hnl_per_usd,
  modoImpuestos: 'combinado',
  totalCombinadoHnl: caso.inputs.manual_combined_landing_hnl,
  impuestoHnl: null,
  gastosLocalesHnl: null,
  reparacionHnl: caso.inputs.repair_budget_hnl,
  precioVentaHnl: caso.inputs.expected_sale_hnl,
};

describe('caso 104 desde data/fixtures/caso_104.json', () => {
  const esperado = caso.new_calculation_explicit_change;

  it('reproduce el efectivo USD una sola vez', () => {
    expect(calcularCotizacion(entradas).cashUsd?.toString()).toBe(esperado.cash_components_usd);
  });

  it('reproduce total USD, total HNL, inversión y utilidad de la corrección explícita', () => {
    const r = calcularCotizacion(entradas);
    expect(r.importadoUsdEquivalente?.toFixed(2)).toBe(esperado.total_usd_display);
    expect(r.importadoHnl?.toFixed(4)).toBe(esperado.total_hnl_unrounded);
    expect(r.importadoHnl?.toFixed(2)).toBe(esperado.total_hnl_display);
    expect(r.inversionHnl?.toFixed(2)).toBe(esperado.with_repair_hnl_display);
    expect(r.utilidadHnl?.toFixed(2)).toBe(esperado.profit_hnl_display);
    expect(r.utilidadTipo).toBe('final');
  });

  it('no usa el desglose: el total combinado 50297.89 se toma completo, sin inferir partes', () => {
    expect(calcularCotizacion(entradas).impuestosHnl?.toString()).toBe(caso.inputs.manual_combined_landing_hnl);
  });
});
