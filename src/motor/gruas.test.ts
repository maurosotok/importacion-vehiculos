import { describe, expect, it } from 'vitest';
import gruasTexto from '../../data/catalogos/gruas_desde_excel.json?raw';
import { buscarGruas, resolverGrua, zonaSugerida, type FilaGrua } from './gruas';

type FilaCatalogo = {
  id: string;
  departure_zone: string;
  location_label_raw: string;
  display_label: string;
  amount_usd: string | null;
};

const filasCatalogo = (JSON.parse(gruasTexto) as { rates: FilaCatalogo[] }).rates;
const filas: FilaGrua[] = filasCatalogo.map((r) => {
  const ubicacion = [r.location_label_raw, r.display_label].filter((t, i, todas) => t !== '' && todas.indexOf(t) === i);
  return { id: r.id, ubicacion: ubicacion.join(' · '), zona: r.departure_zone, montoUsd: r.amount_usd };
});

describe('grúas con el catálogo de referencia', () => {
  it('Tampa North en Florida resuelve a US$225 sin ambigüedad', () => {
    const coincidencias = buscarGruas(filas, 'Tampa North', 'FLORIDA');
    const resolucion = resolverGrua(coincidencias);
    expect(resolucion.estado).toBe('unica');
    expect(resolucion).toMatchObject({ montoUsd: '225.00' });
  });

  it('Tampa North sugiere la zona FLORIDA', () => {
    expect(zonaSugerida(filas, 'Tampa North')).toBe('FLORIDA');
  });

  it('Nashville resuelve solo la fila del catálogo (zona FLORIDA, US$500), no inventa otra', () => {
    const coincidencias = buscarGruas(filas, 'Nashville', null);
    expect(coincidencias.map((c) => [c.zona, c.montoUsd])).toEqual([['FLORIDA', '500.00']]);
    expect(zonaSugerida(filas, 'Nashville')).toBe('FLORIDA');
  });

  it('una sede sin coincidencia no sugiere zona ni tarifa', () => {
    expect(zonaSugerida(filas, 'Ciudad inexistente')).toBeNull();
    expect(resolverGrua(buscarGruas(filas, 'Ciudad inexistente', null))).toEqual({ estado: 'sin_coincidencia' });
  });

  it('una sede presente en varias zonas no sugiere zona', () => {
    expect(new Set(buscarGruas(filas, 'IAA', null).map((c) => c.zona)).size).toBeGreaterThan(1);
    expect(zonaSugerida(filas, 'IAA')).toBeNull();
  });
});
