import { describe, expect, it } from 'vitest';
import { leerRuta } from './ruta';

describe('leerRuta', () => {
  it('resuelve Mercado y Compra bajo Vehículos', () => {
    expect(leerRuta('#/vehiculos/mercado')).toEqual({ nombre: 'mercado' });
    expect(leerRuta('#/vehiculos/abc/compra')).toEqual({ nombre: 'compra', id: 'abc' });
  });

  it('mantiene cotización, repuestos, configuración y vehículos por defecto', () => {
    expect(leerRuta('#/vehiculos/abc')).toEqual({ nombre: 'cotizacion', id: 'abc' });
    expect(leerRuta('#/repuestos')).toEqual({ nombre: 'repuestos' });
    expect(leerRuta('#/configuracion')).toEqual({ nombre: 'configuracion' });
    expect(leerRuta('')).toEqual({ nombre: 'vehiculos' });
  });

  it('decodifica el identificador de la cotización', () => {
    expect(leerRuta('#/vehiculos/a%20b/compra')).toEqual({ nombre: 'compra', id: 'a b' });
  });
});
