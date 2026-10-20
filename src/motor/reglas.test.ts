import { describe, expect, it } from 'vitest';
import { calcularCotizacion, type EntradasCotizacion } from './calculo';
import {
  aplicarPagoUnicoRapido,
  cambiarModoImpuestos,
  enRangoGastosLocales,
  type EstadoImpuestos,
} from './impuestos';

const base: EntradasCotizacion = {
  pujaUsd: '1000',
  modoFees: 'total_fees',
  feesUsd: '200',
  carroMasFeesUsd: null,
  feeTablaUsd: null,
  gruaUsd: '300',
  barcoUsd: '500',
  papeleriaUsd: '15',
  tipoCambioHnlPorUsd: '25',
  modoImpuestos: 'pendiente',
  totalCombinadoHnl: null,
  impuestoHnl: null,
  gastosLocalesHnl: null,
  reparacionHnl: '0',
  precioVentaHnl: null,
};

describe('fees: precedencia y modos', () => {
  it('el fee manual gana sobre la tabla y se marca como manual', () => {
    const r = calcularCotizacion({ ...base, modoFees: 'tabla', feeTablaUsd: '150' });
    expect(r.feesUsd?.toString()).toBe('200');
    expect(r.feesFuente).toBe('manual');
  });

  it('en modo tabla sin fee manual usa el valor de la tabla', () => {
    const r = calcularCotizacion({ ...base, feesUsd: null, modoFees: 'tabla', feeTablaUsd: '150' });
    expect(r.feesUsd?.toString()).toBe('150');
    expect(r.feesFuente).toBe('tabla');
  });

  it('sin fee manual ni tabla queda pendiente y no cuenta cero', () => {
    const r = calcularCotizacion({ ...base, feesUsd: null, modoFees: 'tabla', feeTablaUsd: null });
    expect(r.feesUsd).toBeNull();
    expect(r.feesFuente).toBe('pendiente');
    expect(r.pendientes).toContain('fees');
    expect(r.cashUsd).toBeNull();
  });

  it('carro + fees deriva el fee restando la puja', () => {
    const r = calcularCotizacion({ ...base, feesUsd: null, modoFees: 'carro_mas_fees', carroMasFeesUsd: '1250' });
    expect(r.feesUsd?.toString()).toBe('250');
    expect(r.feesFuente).toBe('carro_mas_fees');
  });

  it('carro + fees menor que la puja avisa y no produce fee negativo', () => {
    const r = calcularCotizacion({ ...base, feesUsd: null, modoFees: 'carro_mas_fees', carroMasFeesUsd: '900' });
    expect(r.feesUsd).toBeNull();
    expect(r.avisos.join(' ')).toContain('ya no cubre la puja');
  });
});

describe('contabilidad: sin doble conteo y precisión', () => {
  it('la papelería se cuenta una sola vez en el efectivo', () => {
    const cambiada = calcularCotizacion({ ...base, papeleriaUsd: '20' });
    expect(cambiada.cashUsd?.minus(calcularCotizacion(base).cashUsd ?? 0).toString()).toBe('5');
  });

  it('sumas decimales exactas: 0.1 + 0.2 = 0.3', () => {
    const r = calcularCotizacion({
      ...base,
      pujaUsd: '0.1',
      feesUsd: '0.2',
      gruaUsd: '0',
      barcoUsd: '0',
      papeleriaUsd: '0',
    });
    expect(r.cashUsd?.toString()).toBe('0.3');
  });

  it('los importes se conservan sin redondear internamente', () => {
    const r = calcularCotizacion({ ...base, tipoCambioHnlPorUsd: '27.0288', modoImpuestos: 'combinado', totalCombinadoHnl: '1' });
    expect(r.importadoHnl?.toString()).toBe(
      r.cashUsd?.times('27.0288').plus(1).toString(),
    );
  });

  it('un campo de cero es válido; un campo vacío sigue pendiente', () => {
    expect(calcularCotizacion({ ...base, barcoUsd: '0' }).pendientes).not.toContain('barco');
    expect(calcularCotizacion({ ...base, barcoUsd: null }).pendientes).toContain('barco');
  });
});

describe('impuestos: modo combinado y desglose', () => {
  const combinado: EstadoImpuestos = {
    modo: 'combinado',
    totalCombinadoHnl: '50297.89',
    impuestoHnl: null,
    gastosLocalesHnl: null,
    referenciaTotalHnl: null,
  };

  it('cambiar a desglose no suma ni borra: guarda el total como referencia', () => {
    const cambiado = cambiarModoImpuestos(combinado, 'desglose');
    expect(cambiado.totalCombinadoHnl).toBeNull();
    expect(cambiado.referenciaTotalHnl).toBe('50297.89');
    expect(cambiado.impuestoHnl).toBeNull();
  });

  it('L10000 es un acceso rápido explícito que llena solo el impuesto', () => {
    const r = aplicarPagoUnicoRapido(cambiarModoImpuestos(combinado, 'desglose'), '10000');
    expect(r.modo).toBe('desglose');
    expect(r.impuestoHnl).toBe('10000');
    expect(r.gastosLocalesHnl).toBeNull();
  });

  it('un total combinado no se mezcla con desglose al calcular', () => {
    const r = calcularCotizacion({
      ...base,
      modoImpuestos: 'combinado',
      totalCombinadoHnl: '50000',
      impuestoHnl: '10000',
      gastosLocalesHnl: '21000',
    });
    expect(r.impuestosHnl?.toString()).toBe('50000');
  });

  it('el rango de gastos locales 20000 a 21000 solo informa, no bloquea', () => {
    expect(enRangoGastosLocales('20000')).toBe('dentro');
    expect(enRangoGastosLocales('21000')).toBe('dentro');
    expect(enRangoGastosLocales('21000.01')).toBe('fuera');
    expect(enRangoGastosLocales(null)).toBe('sin_valor');
  });

  it('impuesto con locales vacíos no produce total', () => {
    const r = calcularCotizacion({
      ...base,
      modoImpuestos: 'desglose',
      impuestoHnl: '10000',
      gastosLocalesHnl: null,
    });
    expect(r.impuestosHnl).toBeNull();
    expect(r.pendientes).toContain('impuestos');
  });
});
