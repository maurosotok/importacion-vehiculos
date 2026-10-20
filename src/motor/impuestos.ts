import { valorDecimal, type ModoImpuestos, type Valor } from './calculo';

export type EstadoImpuestos = {
  modo: ModoImpuestos;
  totalCombinadoHnl: Valor;
  impuestoHnl: Valor;
  gastosLocalesHnl: Valor;
  referenciaTotalHnl: Valor;
};

export type RangoReferencia = { minimo: string; maximo: string };

export const RANGO_GASTOS_LOCALES_REFERENCIA: RangoReferencia = { minimo: '20000', maximo: '21000' };

export function cambiarModoImpuestos(
  estado: EstadoImpuestos,
  modo: 'combinado' | 'desglose',
): EstadoImpuestos {
  if (estado.modo === modo) return estado;
  if (modo === 'desglose' && estado.modo === 'combinado') {
    return {
      ...estado,
      modo,
      referenciaTotalHnl: valorDecimal(estado.totalCombinadoHnl) !== null ? estado.totalCombinadoHnl : estado.referenciaTotalHnl,
      totalCombinadoHnl: null,
    };
  }
  return { ...estado, modo };
}

export function aplicarPagoUnicoRapido(estado: EstadoImpuestos, montoHnl: string): EstadoImpuestos {
  return { ...cambiarModoImpuestos(estado, 'desglose'), impuestoHnl: montoHnl };
}

export function enRangoGastosLocales(
  valor: Valor,
  rango: RangoReferencia = RANGO_GASTOS_LOCALES_REFERENCIA,
): 'dentro' | 'fuera' | 'sin_valor' {
  const monto = valorDecimal(valor);
  const minimo = valorDecimal(rango.minimo);
  const maximo = valorDecimal(rango.maximo);
  if (monto === null || minimo === null || maximo === null) return 'sin_valor';
  return monto.gte(minimo) && monto.lte(maximo) ? 'dentro' : 'fuera';
}
