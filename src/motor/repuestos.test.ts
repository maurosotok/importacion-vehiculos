import { describe, expect, it } from 'vitest';
import { construirMatriz, type OfertaRepuesto } from './repuestos';

const oferta = (extra: Partial<OfertaRepuesto> & Pick<OfertaRepuesto, 'id' | 'supplierId'>): OfertaRepuesto => ({
  itemId: 'pieza-1',
  estado: 'cotizado',
  precio: '100',
  moneda: 'USD',
  cantidad: '1',
  disponibilidad: null,
  fechaOferta: null,
  condicion: null,
  notas: null,
  ...extra,
});

const piezas = ['pieza-1', 'pieza-2'];
const proveedores = ['p-a', 'p-b', 'p-c'];

describe('construirMatriz: estados de celda', () => {
  it('sin oferta o sin consultar es vacía, no cero', () => {
    const m = construirMatriz(piezas, proveedores, [oferta({ id: 'o1', supplierId: 'p-a', estado: 'sin_consultar' })]);
    expect(m[0]?.celdas.get('p-a')?.estado).toBe('vacia');
    expect(m[0]?.celdas.get('p-b')?.estado).toBe('vacia');
    expect(m[0]?.celdas.get('p-b')?.precio).toBeNull();
  });

  it('"No" es no disponible y nunca tiene precio', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', estado: 'no_disponible', precio: null }),
    ]);
    const celda = m[0]?.celdas.get('p-a');
    expect(celda?.estado).toBe('no_disponible');
    expect(celda?.precio).toBeNull();
    expect(celda?.destacada).toBe(false);
  });

  it('precio cero no es comparable ni gana', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', precio: '0' }),
      oferta({ id: 'o2', supplierId: 'p-b', precio: '90' }),
      oferta({ id: 'o3', supplierId: 'p-c', precio: '120' }),
    ]);
    expect(m[0]?.celdas.get('p-a')?.estado).toBe('precio_cero');
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(false);
    expect(m[0]?.celdas.get('p-b')?.destacada).toBe(true);
    expect(m[0]?.celdas.get('p-c')?.destacada).toBe(false);
  });

  it('cotizado sin precio se muestra como sin precio', () => {
    const m = construirMatriz(piezas, proveedores, [oferta({ id: 'o1', supplierId: 'p-a', precio: null })]);
    expect(m[0]?.celdas.get('p-a')?.estado).toBe('sin_precio');
  });

  it('ignora ofertas de piezas o proveedores fuera de la vista', () => {
    const m = construirMatriz(piezas, ['p-a'], [oferta({ id: 'o1', supplierId: 'p-zz' })]);
    expect(m[0]?.celdas.has('p-zz')).toBe(false);
  });
});

describe('comparación entre ofertas compatibles', () => {
  it('resalta la más barata sin forzar selección', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', precio: '120' }),
      oferta({ id: 'o2', supplierId: 'p-b', precio: '95.50' }),
    ]);
    expect(m[0]?.celdas.get('p-b')?.destacada).toBe(true);
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(false);
  });

  it('no compara monedas distintas', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', precio: '100', moneda: 'USD' }),
      oferta({ id: 'o2', supplierId: 'p-b', precio: '2000', moneda: 'HNL' }),
    ]);
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(false);
    expect(m[0]?.celdas.get('p-b')?.destacada).toBe(false);
  });

  it('no compara cantidades distintas', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', precio: '50', cantidad: '1' }),
      oferta({ id: 'o2', supplierId: 'p-b', precio: '90', cantidad: '2' }),
    ]);
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(false);
    expect(m[0]?.celdas.get('p-b')?.destacada).toBe(false);
  });

  it('una sola oferta comparable no se destaca', () => {
    const m = construirMatriz(piezas, proveedores, [oferta({ id: 'o1', supplierId: 'p-a' })]);
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(false);
  });

  it('empates destacan todas las ofertas mínimas', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', precio: '80' }),
      oferta({ id: 'o2', supplierId: 'p-b', precio: '80.00' }),
      oferta({ id: 'o3', supplierId: 'p-c', precio: '99' }),
    ]);
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(true);
    expect(m[0]?.celdas.get('p-b')?.destacada).toBe(true);
    expect(m[0]?.celdas.get('p-c')?.destacada).toBe(false);
  });

  it('cada pieza se compara por separado', () => {
    const m = construirMatriz(piezas, proveedores, [
      oferta({ id: 'o1', supplierId: 'p-a', itemId: 'pieza-1', precio: '10' }),
      oferta({ id: 'o2', supplierId: 'p-b', itemId: 'pieza-1', precio: '20' }),
      oferta({ id: 'o3', supplierId: 'p-b', itemId: 'pieza-2', precio: '30' }),
      oferta({ id: 'o4', supplierId: 'p-c', itemId: 'pieza-2', precio: '5' }),
    ]);
    expect(m[0]?.celdas.get('p-a')?.destacada).toBe(true);
    expect(m[1]?.celdas.get('p-c')?.destacada).toBe(true);
    expect(m[1]?.celdas.get('p-b')?.destacada).toBe(false);
  });
});
