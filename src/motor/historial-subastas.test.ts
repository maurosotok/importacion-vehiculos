import { describe, expect, it } from 'vitest';
import { buscarDuplicadosVin, type CotizacionVin } from './duplicados';
import { estadoVin, normalizarVin } from './vin';

const VIN_CORRECTO = 'JHLRE38797C009075';
const VIN_INCOMPLETO_GUARDADO = 'JHLRE38797C00907';

function cotizacion(id: string, vin: string | null, props: Partial<CotizacionVin> = {}): CotizacionVin {
  return {
    id,
    estado: 'borrador',
    referencia: null,
    updated_at: '2026-10-01T10:00:00Z',
    vin,
    fecha_subasta: null,
    vendido_en_subasta: false,
    ...props,
  };
}

describe('VIN de la Honda CR-V 2007', () => {
  it('el VIN completo tiene 17 caracteres y es válido', () => {
    expect(VIN_CORRECTO).toHaveLength(17);
    expect(estadoVin(VIN_CORRECTO)).toBe('completo');
    expect(normalizarVin(` ${VIN_CORRECTO.toLowerCase()} `)).toBe(VIN_CORRECTO);
  });

  it('el VIN guardado con 16 caracteres sigue siendo incompleto y no se completa solo', () => {
    expect(estadoVin(VIN_INCOMPLETO_GUARDADO)).toBe('incompleto');
  });
});

describe('historial por VIN', () => {
  it('muestra cotizaciones anteriores con fecha de subasta y estado vendido', () => {
    const filas = [
      cotizacion('anterior', VIN_CORRECTO, { fecha_subasta: '2026-10-05', vendido_en_subasta: true }),
      cotizacion('nueva', null),
    ];
    expect(buscarDuplicadosVin(filas, VIN_CORRECTO, 'nueva')).toEqual([
      expect.objectContaining({ id: 'anterior', fecha_subasta: '2026-10-05', vendido_en_subasta: true }),
    ]);
  });

  it('dos subastas del mismo VIN con fechas y estado vendido distintos conviven sin bloqueo', () => {
    const filas = [
      cotizacion('subasta-1', VIN_CORRECTO, { fecha_subasta: '2026-10-05', vendido_en_subasta: true }),
      cotizacion('subasta-2', VIN_CORRECTO, { fecha_subasta: '2026-11-10', vendido_en_subasta: false }),
    ];
    const encontradas = buscarDuplicadosVin(filas, VIN_CORRECTO, 'subasta-3');
    expect(encontradas.map((f) => [f.id, f.vendido_en_subasta])).toEqual([
      ['subasta-1', true],
      ['subasta-2', false],
    ]);
  });

  it('el VIN incompleto guardado no se empareja por parecido con el completo', () => {
    const filas = [cotizacion('incompleta', VIN_INCOMPLETO_GUARDADO)];
    expect(buscarDuplicadosVin(filas, VIN_CORRECTO, 'nueva')).toEqual([]);
  });

  it('con VIN incompleto no se busca duplicado aunque otra fila coincida en el prefijo', () => {
    const filas = [cotizacion('completa', VIN_CORRECTO)];
    expect(buscarDuplicadosVin(filas, VIN_INCOMPLETO_GUARDADO, 'nueva')).toEqual([]);
  });

  it('al corregir el VIN de la cotización abierta, esa cotización no aparece como duplicada de sí misma', () => {
    const filas = [cotizacion('abierta', VIN_CORRECTO)];
    expect(buscarDuplicadosVin(filas, VIN_CORRECTO, 'abierta')).toEqual([]);
  });
});
