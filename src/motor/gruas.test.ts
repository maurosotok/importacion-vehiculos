import { describe, expect, it } from 'vitest';
import gruasTexto from '../../data/catalogos/gruas_desde_excel.json?raw';
import { buscarGruas, limpiarEtiquetaGrua, resolverGrua, zonaSugerida, type FilaGrua } from './gruas';
import { parsearSede } from './sede';

type FilaCatalogo = {
  id: string;
  departure_zone: string;
  origin_state_raw: string | null;
  display_label: string;
  amount_usd: string | null;
};

const filasCatalogo = (JSON.parse(gruasTexto) as { rates: FilaCatalogo[] }).rates;
const filas: FilaGrua[] = filasCatalogo.map((r) => ({
  id: r.id,
  ubicacion: limpiarEtiquetaGrua(r.display_label),
  zona: r.departure_zone,
  estadoOrigen: r.origin_state_raw,
  montoUsd: r.amount_usd,
}));

describe('sede en formato Selling Branch de IAA', () => {
  it('separa nombre y estado y conserva el texto original', () => {
    expect(parsearSede('Nashville (TN)')).toEqual({ original: 'Nashville (TN)', nombre: 'Nashville', estado: 'TN' });
  });

  it('nombres de varias palabras', () => {
    expect(parsearSede('Central New Jersey (NJ)')).toMatchObject({ nombre: 'Central New Jersey', estado: 'NJ' });
  });

  it('normaliza espacios y mayúsculas del estado', () => {
    expect(parsearSede('  Tampa   North (fl) ')).toMatchObject({ nombre: 'Tampa North', estado: 'FL' });
  });

  it('un código que no es estado no se interpreta', () => {
    expect(parsearSede('Nashville (XX)')).toMatchObject({ nombre: 'Nashville (XX)', estado: null });
  });

  it('limpia el texto duplicado del Excel sin perder el nombre', () => {
    expect(limpiarEtiquetaGrua('Tampa North IAATampa North IAA $225.00$225.00')).toBe('Tampa North IAA');
    expect(limpiarEtiquetaGrua('Denver Copart - IAADenver Copart - IAA Se cotizaSe cotiza')).toBe('Denver Copart - IAA');
  });

  it('ninguna etiqueta del catálogo conserva el importe ni el texto duplicado', () => {
    expect(filas.some((f) => f.ubicacion.includes('$'))).toBe(false);
    expect(filas.filter((f) => f.ubicacion.length === 0)).toHaveLength(0);
  });
});

describe('sedes obligatorias con el catálogo de referencia', () => {
  it('Tampa North (FL) resuelve a US$225 por coincidencia IAA exacta', () => {
    const resolucion = resolverGrua(buscarGruas(filas, 'Tampa North (FL)', null));
    expect(resolucion).toMatchObject({ estado: 'unica', montoUsd: '225.00' });
  });

  it('Tampa North sugiere la zona FLORIDA', () => {
    expect(zonaSugerida(filas, 'Tampa North (FL)')).toBe('FLORIDA');
  });

  it('Tampa (FL) distingue la sede Tampa IAA de Tampa North', () => {
    expect(resolverGrua(buscarGruas(filas, 'Tampa (FL)', null))).toMatchObject({ estado: 'unica', montoUsd: '220.00' });
  });

  it('Orlando (FL) no aplica tarifa: hay varias opciones sin verificar', () => {
    const resolucion = resolverGrua(buscarGruas(filas, 'Orlando (FL)', null));
    expect(resolucion.estado).toBe('pendiente');
    expect('coincidencias' in resolucion && resolucion.coincidencias.some((c) => c.verificada)).toBe(false);
  });

  it('Central New Jersey (NJ) resuelve a US$165 por coincidencia IAA exacta', () => {
    expect(resolverGrua(buscarGruas(filas, 'Central New Jersey (NJ)', null))).toMatchObject({
      estado: 'unica',
      montoUsd: '165.00',
    });
  });

  it('Central New Jersey no coincide con otro estado', () => {
    expect(resolverGrua(buscarGruas(filas, 'Central New Jersey (NY)', null))).toEqual({ estado: 'sin_coincidencia' });
  });

  it('Richmond (VA) no aplica tarifa porque hay varias sedes Richmond sin verificar', () => {
    expect(resolverGrua(buscarGruas(filas, 'Richmond (VA)', null)).estado).toBe('pendiente');
    expect(resolverGrua(buscarGruas(filas, 'Richmond (TX)', null))).toEqual({ estado: 'sin_coincidencia' });
  });
});

describe('Nashville no se aplica sin verificación', () => {
  it('Nashville (TN) muestra US$500 como sugerencia pendiente, no como tarifa', () => {
    const resolucion = resolverGrua(buscarGruas(filas, 'Nashville (TN)', null));
    expect(resolucion.estado).toBe('pendiente');
    expect('coincidencias' in resolucion ? resolucion.coincidencias : []).toEqual([
      expect.objectContaining({ ubicacion: 'Nashville Copart - IAA', zona: 'FLORIDA', montoUsd: '500.00', verificada: false }),
    ]);
  });

  it('Nashville sin estado también queda pendiente', () => {
    expect(resolverGrua(buscarGruas(filas, 'Nashville', null)).estado).toBe('pendiente');
  });

  it('la zona sugerida sale de la fila del tarifario, no del estado de origen', () => {
    expect(zonaSugerida(filas, 'Nashville (TN)')).toBe('FLORIDA');
  });
});

describe('reglas de seguridad de coincidencia', () => {
  const sinCatalogo: FilaGrua[] = [
    { id: 'il', ubicacion: 'Springfield IAA', zona: 'DELAWARE', estadoOrigen: 'ILLINOIS', montoUsd: '200.00' },
    { id: 'mo', ubicacion: 'Springfield IAA', zona: 'DELAWARE', estadoOrigen: 'MISSOURI', montoUsd: '300.00' },
  ];

  it('una misma ciudad en dos estados no se confunde cuando se indica el estado', () => {
    expect(resolverGrua(buscarGruas(sinCatalogo, 'Springfield (IL)', null))).toMatchObject({ estado: 'unica', montoUsd: '200.00' });
    expect(resolverGrua(buscarGruas(sinCatalogo, 'Springfield (MO)', null))).toMatchObject({ estado: 'unica', montoUsd: '300.00' });
  });

  it('sin estado, una ciudad presente en dos estados queda ambigua', () => {
    expect(resolverGrua(buscarGruas(sinCatalogo, 'Springfield', null)).estado).toBe('ambigua');
  });

  it('una consulta sin coincidencia no sugiere zona ni tarifa', () => {
    expect(zonaSugerida(filas, 'Ciudad inexistente (TN)')).toBeNull();
    expect(resolverGrua(buscarGruas(filas, 'Ciudad inexistente', null))).toEqual({ estado: 'sin_coincidencia' });
  });

  it('una búsqueda genérica presente en varias zonas no sugiere zona', () => {
    expect(new Set(buscarGruas(filas, 'IAA', null).map((c) => c.zona)).size).toBeGreaterThan(1);
    expect(zonaSugerida(filas, 'IAA')).toBeNull();
  });
});
