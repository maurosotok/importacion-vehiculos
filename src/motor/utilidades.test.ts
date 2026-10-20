import { describe, expect, it } from 'vitest';
import { aCsv, escaparCelda } from './csv';
import { coincideBusqueda, filtrarPorBusqueda } from './busqueda';
import { calcularMercado, sugerirPrecioObjetivoHnl, type CriteriosMercado, type ObservacionMercado } from './mercado';
import { moverPosicion } from '../lib/navegacion';

describe('csv', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(escaparCelda('a,b')).toBe('"a,b"');
    expect(escaparCelda('dice "hola"')).toBe('"dice ""hola"""');
    expect(escaparCelda('línea\nnueva')).toBe('"línea\nnueva"');
  });

  it('neutraliza fórmulas en celdas de texto', () => {
    expect(escaparCelda('=SUMA(A1)')).toBe("'=SUMA(A1)");
    expect(escaparCelda('+1')).toBe("'+1");
    expect(escaparCelda('@cmd')).toBe("'@cmd");
  });

  it('no altera números ni vacíos', () => {
    expect(escaparCelda(-5)).toBe('-5');
    expect(escaparCelda(null)).toBe('');
  });

  it('genera BOM, CRLF y fila final', () => {
    expect(aCsv([['a', 'b'], ['1', null]])).toBe('﻿a,b\r\n1,\r\n');
  });
});

describe('busqueda', () => {
  it('ignora acentos y mayúsculas, y exige todas las palabras', () => {
    expect(coincideBusqueda(['Bomba de Agua', 'Toyota Corolla 2012'], 'agua corolla')).toBe(true);
    expect(coincideBusqueda(['Bomba de Agua'], 'freno')).toBe(false);
    expect(coincideBusqueda(['Inmécro'], 'inmecro')).toBe(true);
  });

  it('consulta vacía devuelve todo', () => {
    expect(filtrarPorBusqueda([1, 2], '  ', (n) => [String(n)])).toEqual([1, 2]);
  });

  it('busca por campos nulos sin fallar', () => {
    expect(coincideBusqueda([null, 'Honda'], 'honda')).toBe(true);
  });
});

const obs = (extra: Partial<ObservacionMercado> & Pick<ObservacionMercado, 'id'>): ObservacionMercado => ({
  marca: 'Toyota',
  modelo: 'Corolla',
  alias: null,
  version: 'LE',
  anio: 2012,
  precioUsd: '5000',
  motor: null,
  traccion: null,
  millas: null,
  fechaConsulta: '2026-10-01',
  recienIngreso: false,
  ubicacion: null,
  ...extra,
});

const criterio = (extra: Partial<CriteriosMercado> = {}): CriteriosMercado => ({
  marca: 'Toyota',
  modelo: 'Corolla',
  anioDesde: null,
  anioHasta: null,
  version: null,
  modoVersiones: 'agrupar',
  versionesEspeciales: [],
  ...extra,
});

describe('mercado: promedio de comparables', () => {
  it('promedia solo precios conocidos y cuenta las muestras', () => {
    const r = calcularMercado(
      [obs({ id: 'a', precioUsd: '4000' }), obs({ id: 'b', precioUsd: '6000' }), obs({ id: 'c', precioUsd: null })],
      criterio(),
    );
    expect(r.promedioUsd?.toString()).toBe('5000');
    expect(r.muestras).toBe(2);
    expect(r.sinPrecio).toBe(1);
  });

  it('precio cero se trata como desconocido, no como dato', () => {
    const r = calcularMercado([obs({ id: 'a', precioUsd: '0' }), obs({ id: 'b', precioUsd: '7000' })], criterio());
    expect(r.promedioUsd?.toString()).toBe('7000');
    expect(r.sinPrecio).toBe(1);
  });

  it('sin comparables no hay promedio', () => {
    const r = calcularMercado([obs({ id: 'a', precioUsd: null })], criterio());
    expect(r.promedioUsd).toBeNull();
    expect(r.muestras).toBe(0);
  });

  it('filtra por modelo, alias, años y versión', () => {
    const datos = [
      obs({ id: 'a', precioUsd: '4000', anio: 2010 }),
      obs({ id: 'b', precioUsd: '8000', anio: 2015, modelo: 'Otro' }),
      obs({ id: 'c', precioUsd: '6000', anio: 2013, alias: 'corolla' }),
      obs({ id: 'd', precioUsd: '9000', anio: 2013, version: 'SE' }),
    ];
    const r = calcularMercado(datos, criterio({ anioDesde: 2011, anioHasta: 2014, version: 'le' }));
    expect(r.incluidas).toEqual(['c']);
    expect(r.promedioUsd?.toString()).toBe('6000');
  });

  it('expone fechas extremas y criterios visibles', () => {
    const r = calcularMercado(
      [obs({ id: 'a', fechaConsulta: '2026-09-01' }), obs({ id: 'b', fechaConsulta: '2026-10-05' })],
      criterio({ anioDesde: 2010 }),
    );
    expect(r.fechaMasAntigua).toBe('2026-09-01');
    expect(r.fechaMasReciente).toBe('2026-10-05');
    expect(r.criterios.some((c) => c.startsWith('Años: 2010'))).toBe(true);
  });
});

describe('mercado: versiones especiales', () => {
  const datos = [
    obs({ id: 'a', precioUsd: '4000', version: 'LE' }),
    obs({ id: 'b', precioUsd: '6000', version: 'LE' }),
    obs({ id: 'c', precioUsd: '20000', version: 'XSE' }),
  ];

  it('agrupar incluye todas las versiones en el promedio', () => {
    const r = calcularMercado(datos, criterio({ modoVersiones: 'agrupar', versionesEspeciales: ['XSE'] }));
    expect(r.promedioUsd?.toString()).toBe('10000');
    expect(r.aisladas).toBe(0);
  });

  it('aislar separa las especiales en su propio promedio', () => {
    const r = calcularMercado(datos, criterio({ modoVersiones: 'aislar', versionesEspeciales: ['xse'] }));
    expect(r.promedioUsd?.toString()).toBe('5000');
    expect(r.promedioAisladasUsd?.toString()).toBe('20000');
    expect(r.aisladas).toBe(1);
    expect(r.incluidas).not.toContain('c');
  });
});

describe('precio objetivo sugerido', () => {
  it('convierte la media a HNL solo con tipo de cambio conocido', () => {
    const media = calcularMercado([obs({ id: 'a', precioUsd: '5000' })], criterio()).promedioUsd;
    expect(sugerirPrecioObjetivoHnl(media, '25')?.toString()).toBe('125000');
    expect(sugerirPrecioObjetivoHnl(null, '25')).toBeNull();
    expect(sugerirPrecioObjetivoHnl(media, null)).toBeNull();
  });
});

describe('navegación por teclado', () => {
  const dim = { filas: 3, columnas: 4 };

  it('flechas se limitan a la tabla', () => {
    expect(moverPosicion({ fila: 0, columna: 0 }, dim, 'ArrowUp')).toEqual({ fila: 0, columna: 0 });
    expect(moverPosicion({ fila: 2, columna: 3 }, dim, 'ArrowRight')).toEqual({ fila: 2, columna: 3 });
    expect(moverPosicion({ fila: 1, columna: 1 }, dim, 'ArrowDown')).toEqual({ fila: 2, columna: 1 });
  });

  it('Tab recorre por filas y da la vuelta al final', () => {
    expect(moverPosicion({ fila: 0, columna: 3 }, dim, 'Tab')).toEqual({ fila: 1, columna: 0 });
    expect(moverPosicion({ fila: 2, columna: 3 }, dim, 'Tab')).toEqual({ fila: 0, columna: 0 });
    expect(moverPosicion({ fila: 0, columna: 0 }, dim, 'Tab', true)).toEqual({ fila: 2, columna: 3 });
  });

  it('Enter baja una fila y tecla desconocida no mueve', () => {
    expect(moverPosicion({ fila: 0, columna: 2 }, dim, 'Enter')).toEqual({ fila: 1, columna: 2 });
    expect(moverPosicion({ fila: 1, columna: 2 }, dim, 'a')).toEqual({ fila: 1, columna: 2 });
  });

  it('tabla vacía no mueve', () => {
    expect(moverPosicion({ fila: 0, columna: 0 }, { filas: 0, columnas: 0 }, 'ArrowDown')).toEqual({ fila: 0, columna: 0 });
  });
});
