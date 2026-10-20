import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  avisosCambioParametros,
  calcularCotizacion,
  formatearMonto,
  type EntradasCotizacion,
} from './calculo';
import { buscarBarcoReferencia, montoEfectivo, volverATarifa } from './referencias';

const caso104: EntradasCotizacion = {
  pujaUsd: 2200,
  modoFees: 'total_fees',
  feesUsd: 795,
  carroMasFeesUsd: null,
  feeTablaUsd: null,
  gruaUsd: 270,
  barcoUsd: 1020,
  papeleriaUsd: 15,
  tipoCambioHnlPorUsd: '27.0288',
  modoImpuestos: 'combinado',
  totalCombinadoHnl: '50297.89',
  impuestoHnl: null,
  gastosLocalesHnl: null,
  reparacionHnl: 20000,
  precioVentaHnl: 220000,
};

const sinImpuesto = { ...caso104, modoImpuestos: 'pendiente' as const, totalCombinadoHnl: null };

describe('caso 104 (M01)', () => {
  it('reproduce importado, inversión y utilidad con papelería contada una sola vez', () => {
    const r = calcularCotizacion(caso104);
    expect(formatearMonto(r.importadoHnl)).toBe('166,521.73');
    expect(formatearMonto(r.inversionHnl)).toBe('186,521.73');
    expect(formatearMonto(r.utilidadHnl)).toBe('33,478.27');
    expect(formatearMonto(r.importadoUsdEquivalente)).toBe('6,160.90');
    expect(r.utilidadTipo).toBe('final');
    expect(r.pendientes).toEqual([]);
  });

  it('suma el efectivo en USD una sola vez: 4300', () => {
    expect(calcularCotizacion(caso104).cashUsd?.toString()).toBe('4300');
  });
});

describe('impuestos (T03, T04, T07)', () => {
  it('el total combinado se suma una sola vez y no se mezcla con desglose (T03/T06)', () => {
    const r = calcularCotizacion({ ...caso104, impuestoHnl: 10000, gastosLocalesHnl: 21000 });
    expect(r.impuestosHnl?.toString()).toBe('50297.89');
  });

  it('impuesto 10000 más locales 21000 da salida 31000 (T04)', () => {
    const r = calcularCotizacion({
      ...caso104,
      modoImpuestos: 'desglose',
      totalCombinadoHnl: null,
      impuestoHnl: 10000,
      gastosLocalesHnl: 21000,
    });
    expect(r.impuestosHnl?.toString()).toBe('31000');
  });

  it('impuesto sin locales queda pendiente y nunca es cero (T07)', () => {
    const r = calcularCotizacion({
      ...caso104,
      modoImpuestos: 'desglose',
      totalCombinadoHnl: null,
      impuestoHnl: 10000,
      gastosLocalesHnl: null,
    });
    expect(r.impuestosHnl).toBeNull();
    expect(r.importadoHnl).toBeNull();
    expect(r.pendientes).toContain('impuestos');
    expect(r.utilidadTipo).toBe('parcial');
  });

  it('al cambiar la puja se conserva el impuesto manual y el fee manual con avisos informativos (T02)', () => {
    const cambiado = { ...caso104, pujaUsd: 2300 };
    const r = calcularCotizacion(cambiado);
    expect(r.impuestosHnl?.toString()).toBe('50297.89');
    expect(r.feesFuente).toBe('manual');
    const avisos = avisosCambioParametros(caso104, cambiado);
    expect(avisos).toHaveLength(2);
    expect(avisos.join(' ')).toContain('impuesto manual se conserva');
    expect(avisos.join(' ')).toContain('estimación fija');
  });
});

describe('pendientes y tipo de cambio (M03, P08)', () => {
  it('tipo de cambio ausente no produce NaN ni conversión falsa', () => {
    const r = calcularCotizacion({ ...caso104, tipoCambioHnlPorUsd: null });
    expect(r.importadoHnl).toBeNull();
    expect(r.importadoUsdEquivalente).toBeNull();
    expect(r.pendientes).toContain('tipo_cambio');
    expect(Number.isNaN(Number(r.utilidadHnl ?? 0))).toBe(false);
  });

  it('tipo de cambio cero se trata como ausente', () => {
    const r = calcularCotizacion({ ...caso104, tipoCambioHnlPorUsd: 0 });
    expect(r.importadoHnl).toBeNull();
    expect(r.pendientes).toContain('tipo_cambio');
  });

  it('sin precio de venta la utilidad no se inventa', () => {
    const r = calcularCotizacion({ ...caso104, precioVentaHnl: null });
    expect(r.utilidadHnl).toBeNull();
    expect(r.utilidadTipo).toBe('sin_precio');
  });

  it('una partida pendiente deja el subtotal conocido y no cuenta cero', () => {
    const r = calcularCotizacion({ ...sinImpuesto, gruaUsd: null });
    expect(r.cashUsd).toBeNull();
    expect(r.subtotalUsd.toString()).toBe('4030');
    expect(r.pendientes).toContain('grua');
  });

  it('usa el redondeo HALF_UP solo al mostrar', () => {
    expect(formatearMonto(new Decimal('2.345'))).toBe('2.35');
    expect(formatearMonto(new Decimal('2.344'))).toBe('2.34');
  });
});

describe('fees carro + fees (F06, F08)', () => {
  it('carro + fees 2995 con puja 2200 da fee 795 sin sumar el total otra vez (F06)', () => {
    const r = calcularCotizacion({
      ...caso104,
      modoFees: 'carro_mas_fees',
      feesUsd: null,
      carroMasFeesUsd: 2995,
    });
    expect(r.feesUsd?.toString()).toBe('795');
    expect(r.cashUsd?.toString()).toBe('4300');
  });

  it('al subir la puja por encima del total no deriva fee negativo y avisa (F08)', () => {
    const r = calcularCotizacion({
      ...caso104,
      modoFees: 'carro_mas_fees',
      feesUsd: 795,
      carroMasFeesUsd: 2995,
      pujaUsd: 3100,
    });
    expect(r.feesUsd?.toString()).toBe('795');
    expect(r.avisos).toHaveLength(1);
  });
});

describe('referencias de tarifa (UX01, UX10)', () => {
  const mapeos = [
    { tipoCodigo: 'suv', zonaSalida: 'DELAWARE', categoriaOrigen: 'SUV_CAMIONETA' },
    { tipoCodigo: 'motorcycle', zonaSalida: 'DELAWARE', categoriaOrigen: 'MOTOCICLETA' },
  ];
  const tarifas = [
    { clave: 'emb-del-suv', zonaSalida: 'DELAWARE', categoria: 'SUV_CAMIONETA', monto: '1020.00' },
    { clave: 'emb-tx-suv', zonaSalida: 'TEXAS', categoria: 'SUV_CAMIONETA', monto: '1500' },
  ];

  it('SUV con puerto Delaware usa la referencia de US$1020 sin pedir medidas (UX01)', () => {
    expect(buscarBarcoReferencia('suv', 'DELAWARE', mapeos, tarifas)).toEqual({
      clave: 'emb-del-suv',
      monto: '1020.00',
    });
  });

  it('un tipo sin categoría de referencia queda sin tarifa en vez de cero', () => {
    expect(buscarBarcoReferencia('pickup', 'DELAWARE', mapeos, tarifas)).toBeNull();
  });

  it('editar la grúa a mano no la reemplaza al cambiar otro campo; volver a tarifa sí (UX10)', () => {
    const grua = { fuente: 'manual' as const, manual: 300, referencia: 270 };
    expect(montoEfectivo(grua)?.toString()).toBe('300');
    expect(montoEfectivo(volverATarifa(grua))?.toString()).toBe('270');
  });
});
