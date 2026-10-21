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
  amount_usd_excel_anterior?: string;
  fuente_tarifa?: string;
  pdf_pagina?: number;
  alias_sedes?: FilaGrua['aliasSedes'];
};

const catalogo = JSON.parse(gruasTexto) as { rates: FilaCatalogo[]; row_count: number };
const filasCatalogo = catalogo.rates;

const aFilaGrua = (r: FilaCatalogo, montoUsd: string | null = r.amount_usd): FilaGrua => ({
  id: r.id,
  ubicacion: limpiarEtiquetaGrua(r.display_label),
  zona: r.departure_zone,
  estadoOrigen: r.origin_state_raw,
  montoUsd,
  aliasSedes: r.alias_sedes ?? [],
});

const filas: FilaGrua[] = filasCatalogo.map((r) => aFilaGrua(r));

const porId = (id: string): FilaCatalogo => {
  const fila = filasCatalogo.find((r) => r.id === id);
  if (!fila) throw new Error(`falta la fila ${id}`);
  return fila;
};

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

describe('tarifas de grúa definitivas según el PDF (decisión 2026-10-21)', () => {
  const esperadas: Array<{ id: string; etiqueta: string; zona: string; pdf: string; anterior: string; pagina: number }> = [
    { id: 'NA-XLSX-GRUAS-0056', etiqueta: 'Central New Jersey - IAA', zona: 'DELAWARE', pdf: '275.00', anterior: '165.00', pagina: 4 },
    { id: 'NA-XLSX-GRUAS-0078', etiqueta: 'Orlando - Copart - IAA', zona: 'FLORIDA', pdf: '225.00', anterior: '200.00', pagina: 7 },
    { id: 'NA-XLSX-GRUAS-0079', etiqueta: 'Orlando North & South - Copart - IAA', zona: 'FLORIDA', pdf: '210.00', anterior: '200.00', pagina: 7 },
    { id: 'NA-XLSX-GRUAS-0089', etiqueta: 'Tampa IAA', zona: 'FLORIDA', pdf: '225.00', anterior: '220.00', pagina: 7 },
    { id: 'NA-XLSX-GRUAS-0093', etiqueta: 'Orlando IAA - Sublot Boggy Greek', zona: 'FLORIDA', pdf: '350.00', anterior: '225.00', pagina: 7 },
    { id: 'NA-XLSX-GRUAS-0095', etiqueta: 'Tampa North IAA', zona: 'FLORIDA', pdf: '265.00', anterior: '225.00', pagina: 7 },
    { id: 'NA-XLSX-GRUAS-0101', etiqueta: 'Tampa US41 IAA', zona: 'FLORIDA', pdf: '200.00', anterior: '250.00', pagina: 7 },
    { id: 'NA-XLSX-GRUAS-0121', etiqueta: 'Richmond - Copart - IAA', zona: 'DELAWARE', pdf: '325.00', anterior: '270.00', pagina: 6 },
    { id: 'NA-XLSX-GRUAS-0165', etiqueta: 'Richmond Doswell - IAA', zona: 'DELAWARE', pdf: '500.00', anterior: '350.00', pagina: 6 },
  ];

  it.each(esperadas)('$id ($etiqueta) queda en el importe del PDF',({ id, etiqueta, zona, pdf, anterior, pagina }) => {
    const fila = porId(id);
    expect(fila.display_label.replace(/\s+/g, ' ')).toContain(etiqueta);
    expect(fila.departure_zone).toBe(zona);
    expect(fila.amount_usd).toBe(pdf);
    expect(fila.amount_usd_excel_anterior).toBe(anterior);
    expect(fila.pdf_pagina).toBe(pagina);
    expect(fila.fuente_tarifa).toBe('pdf_north_atlantic');
  });

  it('el catálogo conserva 282 filas sin duplicados', () => {
    expect(catalogo.row_count).toBe(282);
    expect(filasCatalogo).toHaveLength(282);
    expect(new Set(filasCatalogo.map((r) => r.id)).size).toBe(282);
  });

  it('Tampa North (FL) resuelve a US$265 del PDF', () => {
    expect(resolverGrua(buscarGruas(filas, 'Tampa North (FL)', null))).toMatchObject({ estado: 'unica', montoUsd: '265.00' });
  });

  it('Tampa North sugiere la zona FLORIDA', () => {
    expect(zonaSugerida(filas, 'Tampa North (FL)')).toBe('FLORIDA');
  });

  it('Tampa (FL) distingue la sede Tampa IAA de Tampa North y usa US$225', () => {
    expect(resolverGrua(buscarGruas(filas, 'Tampa (FL)', null))).toMatchObject({ estado: 'unica', montoUsd: '225.00' });
  });

  it('Tampa US41 IAA resuelve a US$200 con su sede exacta', () => {
    expect(resolverGrua(buscarGruas(filas, 'Tampa US41 IAA (FL)', null))).toMatchObject({ estado: 'unica', montoUsd: '200.00' });
  });

  it('Orlando - Copart - IAA resuelve a US$225 y no toma la fila North & South', () => {
    const resolucion = resolverGrua(buscarGruas(filas, 'Orlando - Copart - IAA (FL)', null));
    expect(resolucion).toMatchObject({ estado: 'unica', montoUsd: '225.00' });
    expect('coincidencias' in resolucion ? resolucion.coincidencias.map((c) => c.id) : []).toEqual(['NA-XLSX-GRUAS-0078']);
  });

  it('Orlando IAA - Sublot Boggy Greek resuelve a su propio importe US$350', () => {
    expect(resolverGrua(buscarGruas(filas, 'Orlando IAA - Sublot Boggy Greek (FL)', null))).toMatchObject({
      estado: 'unica',
      montoUsd: '350.00',
    });
  });

  it('Orlando sin sublote ni sede exacta no aplica tarifa', () => {
    expect(resolverGrua(buscarGruas(filas, 'Orlando (FL)', null)).estado).toBe('pendiente');
  });

  it('Central New Jersey (NJ) resuelve a US$275 del PDF', () => {
    expect(resolverGrua(buscarGruas(filas, 'Central New Jersey (NJ)', null))).toMatchObject({
      estado: 'unica',
      montoUsd: '275.00',
    });
  });

  it('Central New Jersey no coincide con otro estado', () => {
    expect(resolverGrua(buscarGruas(filas, 'Central New Jersey (NY)', null))).toEqual({ estado: 'sin_coincidencia' });
  });

  it('Richmond - Copart - IAA resuelve a US$325 y Richmond Doswell a US$500', () => {
    expect(resolverGrua(buscarGruas(filas, 'Richmond - Copart - IAA (VA)', null))).toMatchObject({
      estado: 'unica',
      montoUsd: '325.00',
    });
    expect(resolverGrua(buscarGruas(filas, 'Richmond Doswell - IAA (VA)', null))).toMatchObject({
      estado: 'unica',
      montoUsd: '500.00',
    });
  });

  it('Richmond (VA) sin sede exacta sigue pendiente y Richmond (TX) no coincide', () => {
    expect(resolverGrua(buscarGruas(filas, 'Richmond (VA)', null)).estado).toBe('pendiente');
    expect(resolverGrua(buscarGruas(filas, 'Richmond (TX)', null))).toEqual({ estado: 'sin_coincidencia' });
  });

  it('una fila que el usuario no cambió conserva su importe original', () => {
    expect(porId('NA-XLSX-GRUAS-0079').amount_usd).toBe('210.00');
    expect(porId('NA-XLSX-GRUAS-0086').amount_usd).toBe('210.00');
    expect(porId('NA-XLSX-GRUAS-0086').amount_usd_excel_anterior).toBeUndefined();
  });
});

describe('historial del Excel y cotizaciones guardadas', () => {
  it('el importe anterior del Excel se usa solo como referencia histórica', () => {
    const historica = filasCatalogo.map((r) => aFilaGrua(r, r.amount_usd_excel_anterior ?? r.amount_usd));
    expect(resolverGrua(buscarGruas(historica, 'Tampa North (FL)', null))).toMatchObject({ estado: 'unica', montoUsd: '225.00' });
    expect(resolverGrua(buscarGruas(filas, 'Tampa North (FL)', null))).toMatchObject({ estado: 'unica', montoUsd: '265.00' });
  });
});

describe('Nashville, Tennessee: US$500 para IAA y Copart', () => {
  const nashville = porId('NA-XLSX-GRUAS-0238');

  it('la fila original se conserva con su etiqueta y zona FLORIDA', () => {
    expect(nashville.display_label).toContain('Nashville Copart - IAA');
    expect(nashville.departure_zone).toBe('FLORIDA');
    expect(nashville.origin_state_raw).toBe('TENNESSEE');
    expect(nashville.amount_usd).toBe('500.00');
  });

  it('IAA + Nashville (TN) resuelve a US$500 sin quedar pendiente', () => {
    expect(resolverGrua(buscarGruas(filas, 'Nashville (TN)', null, 'IAA'))).toMatchObject({ estado: 'unica', montoUsd: '500.00' });
  });

  it('Copart + Nashville (TN) resuelve a US$500', () => {
    expect(resolverGrua(buscarGruas(filas, 'Nashville (TN)', null, 'COPART'))).toMatchObject({ estado: 'unica', montoUsd: '500.00' });
  });

  it('la zona sugerida es FLORIDA, la de la fila del tarifario', () => {
    expect(zonaSugerida(filas, 'Nashville (TN)')).toBe('FLORIDA');
  });

  it('sin subasta definida, Nashville (TN) queda pendiente y no se aplica', () => {
    const resolucion = resolverGrua(buscarGruas(filas, 'Nashville (TN)', null));
    expect(resolucion.estado).toBe('pendiente');
    expect('coincidencias' in resolucion ? resolucion.coincidencias : []).toEqual([
      expect.objectContaining({ ubicacion: 'Nashville Copart - IAA', zona: 'FLORIDA', montoUsd: '500.00', verificada: false }),
    ]);
  });

  it('una subasta distinta de IAA o Copart no confirma Nashville', () => {
    expect(resolverGrua(buscarGruas(filas, 'Nashville (TN)', null, 'OTRA')).estado).toBe('pendiente');
  });

  it('Nashville sin estado queda pendiente aunque la subasta sea IAA', () => {
    expect(resolverGrua(buscarGruas(filas, 'Nashville', null, 'IAA')).estado).toBe('pendiente');
  });

  it('otro estado con nombre parecido no confirma Nashville', () => {
    expect(resolverGrua(buscarGruas(filas, 'Nashville (TX)', null, 'IAA'))).toEqual({ estado: 'sin_coincidencia' });
    expect(resolverGrua(buscarGruas(filas, 'Nashville (KY)', null, 'COPART'))).toEqual({ estado: 'sin_coincidencia' });
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
