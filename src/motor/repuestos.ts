import Decimal from 'decimal.js';
import { valorDecimal, type Valor } from './calculo';

export type MonedaOferta = 'USD' | 'HNL';

export type OfertaRepuesto = {
  id: string;
  itemId: string;
  supplierId: string;
  estado: 'cotizado' | 'no_disponible' | 'sin_consultar';
  precio: Valor;
  moneda: MonedaOferta;
  cantidad: Valor;
  disponibilidad: string | null;
  fechaOferta: string | null;
  condicion: string | null;
  notas: string | null;
};

export type EstadoCelda = 'vacia' | 'no_disponible' | 'cotizado' | 'precio_cero' | 'sin_precio';

export type CeldaRepuesto = {
  ofertaId: string | null;
  estado: EstadoCelda;
  precio: Decimal | null;
  moneda: MonedaOferta | null;
  cantidad: Decimal | null;
  destacada: boolean;
};

export type FilaRepuesto = {
  itemId: string;
  celdas: Map<string, CeldaRepuesto>;
};

function celdaVacia(): CeldaRepuesto {
  return { ofertaId: null, estado: 'vacia', precio: null, moneda: null, cantidad: null, destacada: false };
}

function clasificar(oferta: OfertaRepuesto): CeldaRepuesto {
  if (oferta.estado === 'sin_consultar') return celdaVacia();
  const base = {
    ofertaId: oferta.id,
    moneda: oferta.moneda,
    cantidad: valorDecimal(oferta.cantidad) ?? new Decimal(1),
    destacada: false,
  };
  if (oferta.estado === 'no_disponible') return { ...base, estado: 'no_disponible', precio: null };
  const precio = valorDecimal(oferta.precio);
  if (precio === null) return { ...base, estado: 'sin_precio', precio: null };
  if (precio.lte(0)) return { ...base, estado: 'precio_cero', precio };
  return { ...base, estado: 'cotizado', precio };
}


function claveComparable(celda: CeldaRepuesto): string | null {
  if (celda.estado !== 'cotizado' || celda.precio === null || celda.moneda === null || celda.cantidad === null) {
    return null;
  }
  return `${celda.moneda}|${celda.cantidad.toString()}`;
}

export function marcarMasBaratas(celdas: CeldaRepuesto[]): CeldaRepuesto[] {
  const grupos = new Map<string, CeldaRepuesto[]>();
  for (const celda of celdas) {
    const clave = claveComparable(celda);
    if (clave === null) continue;
    grupos.set(clave, [...(grupos.get(clave) ?? []), celda]);
  }
  const resultado: CeldaRepuesto[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const minimo = grupo.reduce<Decimal | null>(
      (min, celda) => (min === null || (celda.precio !== null && celda.precio.lt(min)) ? celda.precio : min),
      null,
    );
    for (const celda of grupo) {
      if (minimo !== null && celda.precio !== null && celda.precio.eq(minimo)) {
        celda.destacada = true;
        resultado.push(celda);
      }
    }
  }
  return resultado;
}

export function construirMatriz(
  piezas: string[],
  proveedores: string[],
  ofertas: OfertaRepuesto[],
): FilaRepuesto[] {
  const filas: FilaRepuesto[] = piezas.map((itemId) => {
    const celdas = new Map<string, CeldaRepuesto>();
    for (const proveedorId of proveedores) celdas.set(proveedorId, celdaVacia());
    return { itemId, celdas };
  });
  const porPieza = new Map(filas.map((fila) => [fila.itemId, fila]));
  for (const oferta of ofertas) {
    const fila = porPieza.get(oferta.itemId);
    if (fila === undefined || !fila.celdas.has(oferta.supplierId)) continue;
    fila.celdas.set(oferta.supplierId, clasificar(oferta));
  }
  for (const fila of filas) marcarMasBaratas([...fila.celdas.values()]);
  return filas;
}
