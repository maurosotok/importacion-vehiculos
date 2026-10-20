import { describe, expect, it } from 'vitest';
import { compararOfertas, totalOferta, type OfertaEnvio } from './envio';
import { buscarGruas, normalizarTexto, resolverGrua, type FilaGrua } from './gruas';

const oferta = (over: Partial<OfertaEnvio> & Pick<OfertaEnvio, 'id'>): OfertaEnvio => ({
  naviera: 'Naviera',
  grua: '270',
  barco: '1020',
  papeleria: '15',
  moneda: 'USD',
  fecha: null,
  notas: null,
  ...over,
});

describe('comparador de envíos', () => {
  it('suma grúa, barco y papelería de cada oferta completa', () => {
    expect(totalOferta(oferta({ id: 'a' })).total?.toString()).toBe('1305');
  });

  it('una oferta con partida vacía no tiene total y lista el faltante', () => {
    const r = totalOferta(oferta({ id: 'a', grua: null }));
    expect(r.total).toBeNull();
    expect(r.faltantes).toEqual(['grua']);
  });

  it('cero explícito es un valor válido, no un faltante', () => {
    expect(totalOferta(oferta({ id: 'a', papeleria: '0' })).total?.toString()).toBe('1290');
  });

  it('compara solo ofertas completas y elige la menor', () => {
    const r = compararOfertas([
      oferta({ id: 'a', barco: '1100' }),
      oferta({ id: 'b', barco: '1000' }),
      oferta({ id: 'c', barco: null }),
    ]);
    expect(r).toEqual({ motivo: 'ok', ganadoras: ['b'], moneda: 'USD' });
  });

  it('empates devuelven varias ganadoras', () => {
    const r = compararOfertas([oferta({ id: 'a' }), oferta({ id: 'b' })]);
    expect(r).toEqual({ motivo: 'ok', ganadoras: ['a', 'b'], moneda: 'USD' });
  });

  it('con menos de dos ofertas completas no compara', () => {
    expect(compararOfertas([oferta({ id: 'a' }), oferta({ id: 'b', grua: null })])).toEqual({
      motivo: 'menos_de_dos_completas',
    });
  });

  it('no compara monedas distintas', () => {
    expect(compararOfertas([oferta({ id: 'a' }), oferta({ id: 'b', moneda: 'HNL' })])).toEqual({
      motivo: 'monedas_distintas',
    });
  });
});

describe('grúas y sublotes', () => {
  const filas: FilaGrua[] = [
    { id: 'g1', ubicacion: 'Miami, FL', zona: 'FLORIDA', montoUsd: '350' },
    { id: 'g2', ubicacion: 'Tampa, FL', zona: 'FLORIDA', montoUsd: null },
    { id: 'g3', ubicacion: 'Jacksonville, FL', zona: 'FLORIDA', montoUsd: '350' },
    { id: 'g4', ubicacion: 'Sarasota, FL', zona: 'FLORIDA', montoUsd: '410' },
    { id: 'g5', ubicacion: 'Mexico (Mérida)', zona: 'TEXAS', montoUsd: '250' },
  ];

  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(normalizarTexto('  Mérida   ')).toBe('MERIDA');
  });

  it('una coincidencia con importe devuelve única', () => {
    const r = resolverGrua(buscarGruas(filas, 'Miami', 'FLORIDA'));
    expect(r).toMatchObject({ estado: 'unica', montoUsd: '350' });
  });

  it('sublotes con importes distintos quedan ambiguos, sin colapsar', () => {
    const r = resolverGrua(buscarGruas(filas, 'FL', 'FLORIDA'));
    expect(r.estado).toBe('ambigua');
  });

  it('una coincidencia sin importe no se trata como cero', () => {
    expect(resolverGrua(buscarGruas(filas, 'Tampa', 'FLORIDA'))).toMatchObject({ estado: 'sin_importe' });
  });

  it('sin coincidencia se reporta explícitamente', () => {
    expect(resolverGrua(buscarGruas(filas, 'Atlanta', null))).toEqual({ estado: 'sin_coincidencia' });
  });

  it('filtra por zona de salida', () => {
    expect(buscarGruas(filas, 'Mérida', 'FLORIDA')).toEqual([]);
    expect(buscarGruas(filas, 'Mérida', 'TEXAS')).toHaveLength(1);
  });
});
