import Decimal from 'decimal.js';
import { valorDecimal, type Valor } from './calculo';

export const CONCEPTOS_GASTO = [
  'grua',
  'barco',
  'papeleria',
  'carro',
  'buyer_fee',
  'bac_fees',
  'paypal_fee',
  'bank_receiver_fee',
  'impuestos_salida',
  'repuesto',
  'servicio',
  'gasolina_aceite',
  'mano_obra',
  'pintura',
  'otro',
] as const;

export type ConceptoGasto = (typeof CONCEPTOS_GASTO)[number];
export type MonedaGasto = 'USD' | 'HNL';

const CONCEPTOS_REPARACION: ReadonlySet<string> = new Set([
  'repuesto',
  'servicio',
  'gasolina_aceite',
  'mano_obra',
  'pintura',
]);

export function esConceptoReparacion(concepto: string): boolean {
  return CONCEPTOS_REPARACION.has(concepto);
}

export type GastoCompra = {
  id: string;
  concepto: ConceptoGasto;
  monto: Valor;
  moneda: MonedaGasto;
  tipoCambioHnlPorUsd: Valor;
  estimado: boolean;
};

export type CompraEntrada = {
  tipoCambioCompraHnlPorUsd: Valor;
  importadoEstimadoHnl: Valor;
  presupuestoReparacionHnl: Valor;
  contingenciaHnl: Valor;
  redondearPresupuesto5000: boolean;
  precioVentaHnl: Valor;
  gastos: GastoCompra[];
};

export type TipoUtilidad = 'sin_venta' | 'parcial' | 'final';

export type ResumenCompra = {
  pendientesIds: string[];
  realSinReparacionHnl: Decimal;
  realReparacionHnl: Decimal;
  realTotalHnl: Decimal;
  estimadoGastosHnl: Decimal;
  presupuestoAjustadoHnl: Decimal | null;
  desviacionReparacionHnl: Decimal | null;
  importadoEstimadoHnl: Decimal | null;
  desviacionImportacionHnl: Decimal | null;
  utilidadEstimadaHnl: Decimal | null;
  utilidadRealizadaHnl: Decimal | null;
  utilidadTipo: TipoUtilidad;
};

const BLOQUE_REDONDEO = new Decimal(5000);

export function redondearAL5000Arriba(valor: Decimal): Decimal {
  return valor.div(BLOQUE_REDONDEO).ceil().mul(BLOQUE_REDONDEO);
}

export function montoHnl(gasto: GastoCompra, tipoCambioCompra: Valor): Decimal | null {
  const monto = valorDecimal(gasto.monto);
  if (monto === null) return null;
  if (gasto.moneda === 'HNL') return monto;
  const tipo = valorDecimal(gasto.tipoCambioHnlPorUsd) ?? valorDecimal(tipoCambioCompra);
  return tipo === null ? null : monto.times(tipo);
}

export function presupuestoAjustado(presupuesto: Valor, contingencia: Valor, redondear: boolean): Decimal | null {
  const base = valorDecimal(presupuesto);
  if (base === null) return null;
  const total = base.plus(valorDecimal(contingencia) ?? 0);
  return redondear ? redondearAL5000Arriba(total) : total;
}

export function resumirCompra(entrada: CompraEntrada): ResumenCompra {
  const pendientesIds: string[] = [];
  let realSinReparacion = new Decimal(0);
  let realReparacion = new Decimal(0);
  let estimado = new Decimal(0);

  for (const gasto of entrada.gastos) {
    const hnl = montoHnl(gasto, entrada.tipoCambioCompraHnlPorUsd);
    if (hnl === null) {
      pendientesIds.push(gasto.id);
    } else if (gasto.estimado) {
      estimado = estimado.plus(hnl);
    } else if (esConceptoReparacion(gasto.concepto)) {
      realReparacion = realReparacion.plus(hnl);
    } else {
      realSinReparacion = realSinReparacion.plus(hnl);
    }
  }

  const realTotal = realSinReparacion.plus(realReparacion);
  const presupuesto = presupuestoAjustado(
    entrada.presupuestoReparacionHnl,
    entrada.contingenciaHnl,
    entrada.redondearPresupuesto5000,
  );
  const importado = valorDecimal(entrada.importadoEstimadoHnl);
  const venta = valorDecimal(entrada.precioVentaHnl);

  const utilidadEstimada =
    venta !== null && importado !== null && presupuesto !== null
      ? venta.minus(importado).minus(presupuesto)
      : null;
  const utilidadRealizada = venta !== null ? venta.minus(realTotal) : null;

  let utilidadTipo: TipoUtilidad = 'final';
  if (venta === null) utilidadTipo = 'sin_venta';
  else if (pendientesIds.length > 0 || entrada.gastos.some((g) => g.estimado)) {
    utilidadTipo = 'parcial';
  }

  return {
    pendientesIds,
    realSinReparacionHnl: realSinReparacion,
    realReparacionHnl: realReparacion,
    realTotalHnl: realTotal,
    estimadoGastosHnl: estimado,
    presupuestoAjustadoHnl: presupuesto,
    desviacionReparacionHnl: presupuesto === null ? null : realReparacion.minus(presupuesto),
    importadoEstimadoHnl: importado,
    desviacionImportacionHnl: importado === null ? null : realSinReparacion.minus(importado),
    utilidadEstimadaHnl: utilidadEstimada,
    utilidadRealizadaHnl: utilidadRealizada,
    utilidadTipo,
  };
}

export type OfertaParaGasto = {
  id: string;
  estado: 'cotizado' | 'no_disponible' | 'sin_consultar';
  precio: Valor;
  cantidad: Valor;
  moneda: MonedaGasto;
  pieza: string;
  proveedor: string;
};

export type BorradorGastoRepuesto = {
  ofertaRepuestoId: string;
  concepto: 'repuesto';
  descripcion: string;
  lugar: string;
  monto: string;
  moneda: MonedaGasto;
};

export type ResultadoConversion =
  | { ok: true; borrador: BorradorGastoRepuesto }
  | { ok: false; motivo: 'no_disponible' | 'sin_precio' | 'precio_cero' | 'sin_consultar' };

export function borradorGastoDesdeOferta(oferta: OfertaParaGasto): ResultadoConversion {
  if (oferta.estado === 'no_disponible') return { ok: false, motivo: 'no_disponible' };
  if (oferta.estado === 'sin_consultar') return { ok: false, motivo: 'sin_consultar' };
  const precio = valorDecimal(oferta.precio);
  if (precio === null) return { ok: false, motivo: 'sin_precio' };
  if (precio.lte(0)) return { ok: false, motivo: 'precio_cero' };
  const cantidad = valorDecimal(oferta.cantidad) ?? new Decimal(1);
  return {
    ok: true,
    borrador: {
      ofertaRepuestoId: oferta.id,
      concepto: 'repuesto',
      descripcion: oferta.pieza,
      lugar: oferta.proveedor,
      monto: precio.times(cantidad).toString(),
      moneda: oferta.moneda,
    },
  };
}

export function ofertasYaConvertidas(gastos: { ofertaRepuestoId: string | null }[]): Set<string> {
  const ids = new Set<string>();
  for (const gasto of gastos) if (gasto.ofertaRepuestoId !== null) ids.add(gasto.ofertaRepuestoId);
  return ids;
}
