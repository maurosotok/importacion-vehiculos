import Decimal from 'decimal.js';
import { valorDecimal, type Valor } from './calculo';

export type OfertaEnvio = {
  id: string;
  naviera: string;
  grua: Valor;
  barco: Valor;
  papeleria: Valor;
  moneda: string;
  fecha: string | null;
  notas: string | null;
};

export type TotalOferta = { id: string; total: Decimal | null; faltantes: ('grua' | 'barco' | 'papeleria')[] };

export function totalOferta(oferta: OfertaEnvio): TotalOferta {
  const partes = [
    { clave: 'grua' as const, valor: valorDecimal(oferta.grua) },
    { clave: 'barco' as const, valor: valorDecimal(oferta.barco) },
    { clave: 'papeleria' as const, valor: valorDecimal(oferta.papeleria) },
  ];
  const faltantes = partes.filter((p) => p.valor === null).map((p) => p.clave);
  if (faltantes.length > 0) return { id: oferta.id, total: null, faltantes };
  const total = partes.reduce<Decimal>((suma, p) => suma.plus(p.valor ?? 0), new Decimal(0));
  return { id: oferta.id, total, faltantes: [] };
}

export type ResultadoComparacion =
  | { motivo: 'ok'; ganadoras: string[]; moneda: string }
  | { motivo: 'menos_de_dos_completas' }
  | { motivo: 'monedas_distintas' };

export function compararOfertas(ofertas: OfertaEnvio[]): ResultadoComparacion {
  const completas = ofertas
    .map((o) => ({ oferta: o, total: totalOferta(o).total }))
    .filter((c): c is { oferta: OfertaEnvio; total: Decimal } => c.total !== null);
  if (completas.length < 2) return { motivo: 'menos_de_dos_completas' };
  const monedas = new Set(completas.map((c) => c.oferta.moneda));
  if (monedas.size > 1) return { motivo: 'monedas_distintas' };
  const menor = completas.reduce<Decimal>((min, c) => (c.total.lt(min) ? c.total : min), completas[0]?.total ?? new Decimal(0));
  const ganadoras = completas.filter((c) => c.total.eq(menor)).map((c) => c.oferta.id);
  return { motivo: 'ok', ganadoras, moneda: completas[0]?.oferta.moneda ?? '' };
}
