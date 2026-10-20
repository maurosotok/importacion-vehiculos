import Decimal from 'decimal.js';
import { calcularCotizacion, valorDecimal, type EntradasCotizacion, type ResultadoCotizacion, type Valor } from './calculo';

export type FuentesRevision = {
  perfilFeesClave: string | null;
  versionTablaFees: string | null;
  tarifaEmbarqueId: string | null;
  gruaId: string | null;
  tipoCambioFuente: string | null;
};

export type ResultadoRevision = {
  pendientes: string[];
  avisos: string[];
  feesUsd: string | null;
  feesFuente: string;
  subtotalUsd: string;
  cashUsd: string | null;
  impuestosHnl: string | null;
  importadoHnl: string | null;
  importadoUsdEquivalente: string | null;
  inversionHnl: string | null;
  utilidadHnl: string | null;
  utilidadTipo: string;
};

export type RevisionCongelada = {
  version: 1;
  creadaEn: string;
  entradas: Record<keyof EntradasCotizacion, string | null>;
  fuentes: FuentesRevision;
  resultado: ResultadoRevision;
};

function aTexto(valor: Valor): string | null {
  const decimal = valorDecimal(valor);
  return decimal === null ? null : decimal.toString();
}

function aTextoDecimal(valor: Decimal | null): string | null {
  return valor === null ? null : valor.toString();
}

function serializarEntradas(entradas: EntradasCotizacion): RevisionCongelada['entradas'] {
  return {
    pujaUsd: aTexto(entradas.pujaUsd),
    modoFees: entradas.modoFees,
    feesUsd: aTexto(entradas.feesUsd),
    carroMasFeesUsd: aTexto(entradas.carroMasFeesUsd),
    feeTablaUsd: aTexto(entradas.feeTablaUsd),
    gruaUsd: aTexto(entradas.gruaUsd),
    barcoUsd: aTexto(entradas.barcoUsd),
    papeleriaUsd: aTexto(entradas.papeleriaUsd),
    tipoCambioHnlPorUsd: aTexto(entradas.tipoCambioHnlPorUsd),
    modoImpuestos: entradas.modoImpuestos,
    totalCombinadoHnl: aTexto(entradas.totalCombinadoHnl),
    impuestoHnl: aTexto(entradas.impuestoHnl),
    gastosLocalesHnl: aTexto(entradas.gastosLocalesHnl),
    reparacionHnl: aTexto(entradas.reparacionHnl),
    precioVentaHnl: aTexto(entradas.precioVentaHnl),
  };
}

function serializarResultado(r: ResultadoCotizacion): ResultadoRevision {
  return {
    pendientes: [...r.pendientes],
    avisos: [...r.avisos],
    feesUsd: aTextoDecimal(r.feesUsd),
    feesFuente: r.feesFuente,
    subtotalUsd: r.subtotalUsd.toString(),
    cashUsd: aTextoDecimal(r.cashUsd),
    impuestosHnl: aTextoDecimal(r.impuestosHnl),
    importadoHnl: aTextoDecimal(r.importadoHnl),
    importadoUsdEquivalente: aTextoDecimal(r.importadoUsdEquivalente),
    inversionHnl: aTextoDecimal(r.inversionHnl),
    utilidadHnl: aTextoDecimal(r.utilidadHnl),
    utilidadTipo: r.utilidadTipo,
  };
}

function congelar<T>(valor: T): T {
  if (typeof valor !== 'object' || valor === null) return valor;
  for (const hijo of Object.values(valor)) congelar(hijo);
  return Object.freeze(valor);
}

export function crearRevision(
  entradas: EntradasCotizacion,
  fuentes: FuentesRevision,
  creadaEn: string,
): Readonly<RevisionCongelada> {
  const resultado = calcularCotizacion(entradas);
  const copia: RevisionCongelada = {
    version: 1,
    creadaEn,
    entradas: serializarEntradas(entradas),
    fuentes: { ...fuentes },
    resultado: serializarResultado(resultado),
  };
  return congelar(copia);
}
