import Decimal from 'decimal.js';
import { valorDecimal, type Valor } from './calculo';
import { normalizarTexto } from './gruas';

export type ObservacionMercado = {
  id: string;
  marca: string;
  modelo: string;
  alias: string | null;
  version: string | null;
  anio: number | null;
  precioUsd: Valor;
  motor: string | null;
  traccion: string | null;
  millas: number | null;
  fechaConsulta: string | null;
  recienIngreso: boolean;
  ubicacion: string | null;
};

export type CriteriosMercado = {
  marca: string;
  modelo: string;
  anioDesde: number | null;
  anioHasta: number | null;
  version: string | null;
  modoVersiones: 'agrupar' | 'aislar';
  versionesEspeciales: string[];
};

export type ResultadoMercado = {
  promedioUsd: Decimal | null;
  muestras: number;
  sinPrecio: number;
  aisladas: number;
  promedioAisladasUsd: Decimal | null;
  muestrasAisladas: number;
  fechaMasReciente: string | null;
  fechaMasAntigua: string | null;
  incluidas: string[];
  criterios: string[];
};

function coincideModelo(obs: ObservacionMercado, criterio: CriteriosMercado): boolean {
  if (normalizarTexto(obs.marca) !== normalizarTexto(criterio.marca)) return false;
  const modelo = normalizarTexto(criterio.modelo);
  return normalizarTexto(obs.modelo) === modelo || (obs.alias !== null && normalizarTexto(obs.alias) === modelo);
}

function enRangoAnio(anio: number | null, criterio: CriteriosMercado): boolean {
  if (criterio.anioDesde === null && criterio.anioHasta === null) return true;
  if (anio === null) return false;
  if (criterio.anioDesde !== null && anio < criterio.anioDesde) return false;
  if (criterio.anioHasta !== null && anio > criterio.anioHasta) return false;
  return true;
}

function promedio(valores: Decimal[]): Decimal | null {
  if (valores.length === 0) return null;
  return valores.reduce((suma, v) => suma.plus(v), new Decimal(0)).div(valores.length);
}

function describirCriterios(criterio: CriteriosMercado): string[] {
  const lineas = [`Marca y modelo: ${criterio.marca} ${criterio.modelo} (incluye alias)`];
  if (criterio.anioDesde !== null || criterio.anioHasta !== null) {
    lineas.push(`Años: ${String(criterio.anioDesde ?? 'sin mínimo')} a ${String(criterio.anioHasta ?? 'sin máximo')}`);
  }
  if (criterio.version !== null) lineas.push(`Versión: ${criterio.version}`);
  lineas.push(
    criterio.modoVersiones === 'aislar'
      ? `Versiones especiales aisladas: ${criterio.versionesEspeciales.join(', ') || 'ninguna'}`
      : 'Versiones agrupadas',
  );
  lineas.push('Excluidos: precios vacíos o cero');
  return lineas;
}

export function calcularMercado(observaciones: ObservacionMercado[], criterio: CriteriosMercado): ResultadoMercado {
  const especiales = new Set(criterio.versionesEspeciales.map(normalizarTexto));
  const version = criterio.version === null ? null : normalizarTexto(criterio.version);
  const base: Decimal[] = [];
  const aisladas: Decimal[] = [];
  const incluidas: string[] = [];
  let sinPrecio = 0;
  let fechaMin: string | null = null;
  let fechaMax: string | null = null;

  for (const obs of observaciones) {
    if (!coincideModelo(obs, criterio) || !enRangoAnio(obs.anio, criterio)) continue;
    if (version !== null && normalizarTexto(obs.version ?? '') !== version) continue;

    const precio = valorDecimal(obs.precioUsd);
    if (precio === null || precio.lte(0)) {
      sinPrecio += 1;
      continue;
    }

    const esEspecial = obs.version !== null && especiales.has(normalizarTexto(obs.version));
    if (criterio.modoVersiones === 'aislar' && esEspecial) {
      aisladas.push(precio);
      continue;
    }
    base.push(precio);
    incluidas.push(obs.id);
    if (obs.fechaConsulta !== null) {
      if (fechaMin === null || obs.fechaConsulta < fechaMin) fechaMin = obs.fechaConsulta;
      if (fechaMax === null || obs.fechaConsulta > fechaMax) fechaMax = obs.fechaConsulta;
    }
  }

  return {
    promedioUsd: promedio(base),
    muestras: base.length,
    sinPrecio,
    aisladas: aisladas.length,
    promedioAisladasUsd: promedio(aisladas),
    muestrasAisladas: aisladas.length,
    fechaMasReciente: fechaMax,
    fechaMasAntigua: fechaMin,
    incluidas,
    criterios: describirCriterios(criterio),
  };
}

export function sugerirPrecioObjetivoHnl(promedioUsd: Decimal | null, tipoCambioHnlPorUsd: Valor): Decimal | null {
  const tipo = valorDecimal(tipoCambioHnlPorUsd);
  if (promedioUsd === null || tipo === null) return null;
  return promedioUsd.times(tipo);
}
