import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Valor = Decimal | string | number | null | undefined;
export type ModoFees = 'total_fees' | 'carro_mas_fees' | 'tabla';
export type FuenteFees = 'manual' | 'carro_mas_fees' | 'tabla' | 'pendiente';
export type ModoImpuestos = 'pendiente' | 'combinado' | 'desglose';

export type Pendiente =
  | 'puja'
  | 'fees'
  | 'grua'
  | 'barco'
  | 'papeleria'
  | 'tipo_cambio'
  | 'impuestos'
  | 'reparacion'
  | 'precio_venta';

export type EntradasCotizacion = {
  pujaUsd: Valor;
  modoFees: ModoFees;
  feesUsd: Valor;
  carroMasFeesUsd: Valor;
  feeTablaUsd: Valor;
  gruaUsd: Valor;
  barcoUsd: Valor;
  papeleriaUsd: Valor;
  tipoCambioHnlPorUsd: Valor;
  modoImpuestos: ModoImpuestos;
  totalCombinadoHnl: Valor;
  impuestoHnl: Valor;
  gastosLocalesHnl: Valor;
  reparacionHnl: Valor;
  precioVentaHnl: Valor;
};

export type ResultadoCotizacion = {
  pendientes: Pendiente[];
  avisos: string[];
  feesUsd: Decimal | null;
  feesFuente: FuenteFees;
  subtotalUsd: Decimal;
  cashUsd: Decimal | null;
  impuestosHnl: Decimal | null;
  importadoHnl: Decimal | null;
  importadoUsdEquivalente: Decimal | null;
  inversionHnl: Decimal | null;
  utilidadHnl: Decimal | null;
  utilidadTipo: 'final' | 'parcial' | 'sin_precio' | 'pendiente';
};

export function valorDecimal(valor: Valor): Decimal | null {
  if (valor === null || valor === undefined || valor === '') return null;
  try {
    const d = new Decimal(valor);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function resolverFees(
  entradas: EntradasCotizacion,
  puja: Decimal | null,
): { fee: Decimal | null; fuente: FuenteFees; aviso: string | null } {
  let aviso: string | null = null;
  let derivado: Decimal | null = null;
  if (entradas.modoFees === 'carro_mas_fees') {
    const carroMasFees = valorDecimal(entradas.carroMasFeesUsd);
    if (carroMasFees !== null && puja !== null) {
      const diferencia = carroMasFees.minus(puja);
      if (diferencia.gte(0)) derivado = diferencia;
      else aviso = 'El carro + fees ya no cubre la puja. Revise el total o el fee manual.';
    }
  }

  const manual = valorDecimal(entradas.feesUsd);
  if (manual !== null) return { fee: manual, fuente: 'manual', aviso };
  if (entradas.modoFees === 'carro_mas_fees') {
    return derivado !== null
      ? { fee: derivado, fuente: 'carro_mas_fees', aviso }
      : { fee: null, fuente: 'pendiente', aviso };
  }
  if (entradas.modoFees === 'tabla') {
    const tabla = valorDecimal(entradas.feeTablaUsd);
    return tabla !== null ? { fee: tabla, fuente: 'tabla', aviso } : { fee: null, fuente: 'pendiente', aviso };
  }
  return { fee: null, fuente: 'pendiente', aviso };
}

function resolverImpuestos(entradas: EntradasCotizacion): Decimal | null {
  if (entradas.modoImpuestos === 'combinado') return valorDecimal(entradas.totalCombinadoHnl);
  if (entradas.modoImpuestos === 'desglose') {
    const impuesto = valorDecimal(entradas.impuestoHnl);
    const locales = valorDecimal(entradas.gastosLocalesHnl);
    return impuesto !== null && locales !== null ? impuesto.plus(locales) : null;
  }
  return null;
}

export function calcularCotizacion(entradas: EntradasCotizacion): ResultadoCotizacion {
  const pendientes: Pendiente[] = [];
  const avisos: string[] = [];

  const puja = valorDecimal(entradas.pujaUsd);
  if (puja === null) pendientes.push('puja');

  const { fee, fuente, aviso } = resolverFees(entradas, puja);
  if (aviso) avisos.push(aviso);
  if (fee === null) pendientes.push('fees');

  const grua = valorDecimal(entradas.gruaUsd);
  const barco = valorDecimal(entradas.barcoUsd);
  const papeleria = valorDecimal(entradas.papeleriaUsd);
  if (grua === null) pendientes.push('grua');
  if (barco === null) pendientes.push('barco');
  if (papeleria === null) pendientes.push('papeleria');

  const partidas = [puja, fee, grua, barco, papeleria];
  const subtotalUsd = partidas.reduce<Decimal>((suma, p) => (p === null ? suma : suma.plus(p)), new Decimal(0));
  const cashUsd = partidas.every((p) => p !== null) ? subtotalUsd : null;

  const impuestosHnl = resolverImpuestos(entradas);
  if (impuestosHnl === null) pendientes.push('impuestos');

  const fx = valorDecimal(entradas.tipoCambioHnlPorUsd);
  const fxValido = fx !== null && fx.gt(0) ? fx : null;
  if (fxValido === null) pendientes.push('tipo_cambio');

  const importadoHnl =
    cashUsd !== null && fxValido !== null && impuestosHnl !== null
      ? cashUsd.times(fxValido).plus(impuestosHnl)
      : null;
  const importadoUsdEquivalente =
    cashUsd !== null && fxValido !== null && impuestosHnl !== null
      ? cashUsd.plus(impuestosHnl.div(fxValido))
      : null;

  const reparacion = valorDecimal(entradas.reparacionHnl);
  if (reparacion === null) pendientes.push('reparacion');
  const inversionHnl = importadoHnl !== null && reparacion !== null ? importadoHnl.plus(reparacion) : null;

  const venta = valorDecimal(entradas.precioVentaHnl);
  if (venta === null) pendientes.push('precio_venta');

  let utilidadHnl: Decimal | null = null;
  let utilidadTipo: ResultadoCotizacion['utilidadTipo'];
  if (venta === null) {
    utilidadTipo = 'sin_precio';
  } else if (inversionHnl !== null) {
    utilidadHnl = venta.minus(inversionHnl);
    utilidadTipo = 'final';
  } else if (fxValido !== null || subtotalUsd.isZero()) {
    const capturadoHnl = (fxValido ? subtotalUsd.times(fxValido) : new Decimal(0))
      .plus(impuestosHnl ?? 0)
      .plus(reparacion ?? 0);
    utilidadHnl = venta.minus(capturadoHnl);
    utilidadTipo = 'parcial';
  } else {
    utilidadTipo = 'pendiente';
  }

  return {
    pendientes,
    avisos,
    feesUsd: fee,
    feesFuente: fuente,
    subtotalUsd,
    cashUsd,
    impuestosHnl,
    importadoHnl,
    importadoUsdEquivalente,
    inversionHnl,
    utilidadHnl,
    utilidadTipo,
  };
}

export function avisosCambioParametros(anterior: EntradasCotizacion, siguiente: EntradasCotizacion): string[] {
  const cambioPuja = valorDecimal(anterior.pujaUsd)?.toString() !== valorDecimal(siguiente.pujaUsd)?.toString();
  const cambios =
    cambioPuja ||
    valorDecimal(anterior.gruaUsd)?.toString() !== valorDecimal(siguiente.gruaUsd)?.toString() ||
    valorDecimal(anterior.barcoUsd)?.toString() !== valorDecimal(siguiente.barcoUsd)?.toString() ||
    valorDecimal(anterior.tipoCambioHnlPorUsd)?.toString() !== valorDecimal(siguiente.tipoCambioHnlPorUsd)?.toString();
  const avisos: string[] = [];
  if (cambios && resolverImpuestos(siguiente) !== null) {
    avisos.push('El impuesto manual se conserva. Revise si depende de la puja, el flete o el tipo de cambio.');
  }
  if (cambioPuja && valorDecimal(siguiente.feesUsd) !== null) {
    avisos.push('El fee manual se conserva como estimación fija.');
  }
  return avisos;
}

export function formatearMonto(valor: Decimal | null): string {
  if (valor === null) return 'Pendiente';
  const redondeado = valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(redondeado.toString()),
  );
}
