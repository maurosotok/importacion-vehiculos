import { describe, expect, it } from 'vitest';
import { anioDesdeTexto, importesPredeterminados, importesSonAutomaticos } from './predeterminados';

describe('importesPredeterminados por año', () => {
  it('2010 o anterior: impuestos L10000 y gastos locales L11000', () => {
    expect(importesPredeterminados(2010)).toEqual({ impuestoHnl: '10000', gastosLocalesHnl: '11000' });
    expect(importesPredeterminados(2007)).toEqual({ impuestoHnl: '10000', gastosLocalesHnl: '11000' });
  });

  it('2011 en adelante: impuesto vacío y gastos locales editables con L13557 por defecto', () => {
    expect(importesPredeterminados(2011)).toEqual({ impuestoHnl: '', gastosLocalesHnl: '13557' });
    expect(importesPredeterminados(2024, '14000')).toEqual({ impuestoHnl: '', gastosLocalesHnl: '14000' });
  });
});

describe('anioDesdeTexto', () => {
  it('acepta solo cuatro dígitos dentro de rango', () => {
    expect(anioDesdeTexto('2007')).toBe(2007);
    expect(anioDesdeTexto(' 2011 ')).toBe(2011);
    expect(anioDesdeTexto('20')).toBeNull();
    expect(anioDesdeTexto('20071')).toBeNull();
    expect(anioDesdeTexto('abc')).toBeNull();
    expect(anioDesdeTexto('1899')).toBeNull();
  });
});

describe('importesSonAutomaticos', () => {
  it('reconoce importes vacíos o predeterminados como automáticos', () => {
    expect(importesSonAutomaticos({ impuestoHnl: '', gastosLocalesHnl: '' })).toBe(true);
    expect(importesSonAutomaticos({ impuestoHnl: '', gastosLocalesHnl: '13557' })).toBe(true);
    expect(importesSonAutomaticos({ impuestoHnl: '10000', gastosLocalesHnl: '11000' })).toBe(true);
    expect(importesSonAutomaticos({ impuestoHnl: '', gastosLocalesHnl: '14000' }, '14000')).toBe(true);
  });

  it('un importe capturado a mano no se considera automático', () => {
    expect(importesSonAutomaticos({ impuestoHnl: '5000', gastosLocalesHnl: '11000' })).toBe(false);
    expect(importesSonAutomaticos({ impuestoHnl: '', gastosLocalesHnl: '14000' })).toBe(false);
  });
});
