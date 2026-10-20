import { describe, expect, it } from 'vitest';
import {
  borradorGastoDesdeOferta,
  ofertasYaConvertidas,
  presupuestoAjustado,
  redondearAL5000Arriba,
  resumirCompra,
  type CompraEntrada,
  type GastoCompra,
} from './compra';
import Decimal from 'decimal.js';

const base = (gastos: GastoCompra[], extra: Partial<CompraEntrada> = {}): CompraEntrada => ({
  tipoCambioCompraHnlPorUsd: '25',
  importadoEstimadoHnl: '1000',
  presupuestoReparacionHnl: null,
  contingenciaHnl: null,
  redondearPresupuesto5000: false,
  precioVentaHnl: null,
  gastos,
  ...extra,
});

const gasto = (id: string, extra: Partial<GastoCompra> = {}): GastoCompra => ({
  id,
  concepto: 'carro',
  monto: '100',
  moneda: 'USD',
  tipoCambioHnlPorUsd: null,
  estimado: false,
  ...extra,
});

describe('resumirCompra: importes en HNL', () => {
  it('convierte USD con el cambio de la compra una sola vez', () => {
    const r = resumirCompra(base([gasto('a', { monto: '100' })]));
    expect(r.realTotalHnl.toString()).toBe('2500');
  });

  it('usa el cambio propio del gasto antes que el de la compra', () => {
    const r = resumirCompra(base([gasto('a', { monto: '100', tipoCambioHnlPorUsd: '24.5' })]));
    expect(r.realTotalHnl.toString()).toBe('2450');
  });

  it('gastos en HNL no se convierten', () => {
    const r = resumirCompra(base([gasto('a', { moneda: 'HNL', monto: '1500' })]));
    expect(r.realTotalHnl.toString()).toBe('1500');
  });

  it('USD sin ningún tipo de cambio queda pendiente y no suma como cero', () => {
    const r = resumirCompra(
      base([gasto('a', { monto: '100' })], { tipoCambioCompraHnlPorUsd: null, precioVentaHnl: '5000' }),
    );
    expect(r.pendientesIds).toEqual(['a']);
    expect(r.realTotalHnl.toString()).toBe('0');
    expect(r.utilidadTipo).toBe('parcial');
  });

  it('suma decimales sin error de coma flotante', () => {
    const r = resumirCompra(
      base([gasto('a', { monto: '0.1' }), gasto('b', { monto: '0.2' })], { tipoCambioCompraHnlPorUsd: '1' }),
    );
    expect(r.realTotalHnl.toString()).toBe('0.3');
  });
});

describe('resumirCompra: real frente a estimado', () => {
  it('un gasto estimado no entra en lo real y pone la utilidad en parcial', () => {
    const r = resumirCompra(
      base([gasto('a', { monto: '10', moneda: 'HNL' }), gasto('b', { monto: '20', moneda: 'HNL', estimado: true })], {
        precioVentaHnl: '5000',
      }),
    );
    expect(r.realTotalHnl.toString()).toBe('10');
    expect(r.estimadoGastosHnl.toString()).toBe('20');
    expect(r.utilidadTipo).toBe('parcial');
  });

  it('separa reparación de costos de importación; "otro" cuenta como no reparación', () => {
    const r = resumirCompra(
      base([
        gasto('g', { concepto: 'grua', moneda: 'HNL', monto: '100' }),
        gasto('p', { concepto: 'pintura', moneda: 'HNL', monto: '300' }),
        gasto('o', { concepto: 'otro', moneda: 'HNL', monto: '50' }),
      ]),
    );
    expect(r.realSinReparacionHnl.toString()).toBe('150');
    expect(r.realReparacionHnl.toString()).toBe('300');
    expect(r.realTotalHnl.toString()).toBe('450');
  });

  it('la desviación de importación compara lo real sin reparación con el importado estimado', () => {
    const r = resumirCompra(base([gasto('a', { moneda: 'HNL', monto: '1200' })], { importadoEstimadoHnl: '1000' }));
    expect(r.desviacionImportacionHnl?.toString()).toBe('200');
  });
});

describe('presupuesto de reparación', () => {
  it('suma contingencia y redondea hacia arriba al siguiente L5000 si se elige', () => {
    expect(presupuestoAjustado('12345', '1000', true)?.toString()).toBe('15000');
  });

  it('un importe ya múltiplo de L5000 no sube', () => {
    expect(redondearAL5000Arriba(new Decimal(15000)).toString()).toBe('15000');
  });

  it('sin redondeo conserva el importe exacto con contingencia', () => {
    expect(presupuestoAjustado('12345', '1000', false)?.toString()).toBe('13345');
  });

  it('sin presupuesto no hay ajuste ni desviación', () => {
    const r = resumirCompra(base([gasto('a', { moneda: 'HNL', monto: '500', concepto: 'pintura' })]));
    expect(r.presupuestoAjustadoHnl).toBeNull();
    expect(r.desviacionReparacionHnl).toBeNull();
  });

  it('muestra la desviación real frente al presupuesto sin tocar el gasto real', () => {
    const r = resumirCompra(
      base([gasto('a', { moneda: 'HNL', monto: '16000', concepto: 'mano_obra' })], {
        presupuestoReparacionHnl: '15000',
      }),
    );
    expect(r.desviacionReparacionHnl?.toString()).toBe('1000');
    expect(r.realReparacionHnl.toString()).toBe('16000');
  });
});

describe('utilidad', () => {
  it('sin precio de venta no inventa utilidad', () => {
    const r = resumirCompra(base([gasto('a', { moneda: 'HNL', monto: '100' })]));
    expect(r.utilidadTipo).toBe('sin_venta');
    expect(r.utilidadRealizadaHnl).toBeNull();
  });

  it('estimada = venta − importado − presupuesto; realizada = venta − real total', () => {
    const r = resumirCompra(
      base([gasto('a', { moneda: 'HNL', monto: '1100', concepto: 'repuesto' })], {
        importadoEstimadoHnl: '1000',
        presupuestoReparacionHnl: '500',
        precioVentaHnl: '3000',
      }),
    );
    expect(r.utilidadEstimadaHnl?.toString()).toBe('1500');
    expect(r.utilidadRealizadaHnl?.toString()).toBe('1900');
    expect(r.utilidadTipo).toBe('final');
  });
});

describe('gasto desde oferta de repuesto', () => {
  const oferta = {
    id: 'o1',
    estado: 'cotizado' as const,
    precio: '40',
    cantidad: '2',
    moneda: 'USD' as const,
    pieza: 'Bomba de agua',
    proveedor: 'Inmecro',
  };

  it('convierte precio × cantidad en un borrador de repuesto', () => {
    expect(borradorGastoDesdeOferta(oferta)).toEqual({
      ok: true,
      borrador: {
        ofertaRepuestoId: 'o1',
        concepto: 'repuesto',
        descripcion: 'Bomba de agua',
        lugar: 'Inmecro',
        monto: '80',
        moneda: 'USD',
      },
    });
  });

  it('una oferta "No" no se convierte en gasto', () => {
    expect(borradorGastoDesdeOferta({ ...oferta, estado: 'no_disponible', precio: null })).toEqual({
      ok: false,
      motivo: 'no_disponible',
    });
  });

  it('sin consultar y sin precio no se convierten', () => {
    expect(borradorGastoDesdeOferta({ ...oferta, estado: 'sin_consultar' })).toEqual({ ok: false, motivo: 'sin_consultar' });
    expect(borradorGastoDesdeOferta({ ...oferta, precio: null })).toEqual({ ok: false, motivo: 'sin_precio' });
  });

  it('precio cero no se convierte en gasto', () => {
    expect(borradorGastoDesdeOferta({ ...oferta, precio: '0' })).toEqual({ ok: false, motivo: 'precio_cero' });
  });

  it('marca como ya convertidas las ofertas con gasto, sin contarlas dos veces', () => {
    const ids = ofertasYaConvertidas([{ ofertaRepuestoId: 'o1' }, { ofertaRepuestoId: 'o1' }, { ofertaRepuestoId: null }]);
    expect([...ids]).toEqual(['o1']);
  });
});
