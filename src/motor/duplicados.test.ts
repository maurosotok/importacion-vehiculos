import { describe, expect, it } from 'vitest';
import { buscarDuplicadosVin, type CotizacionVin } from './duplicados';

const VIN = '1HGCM82633A004352';
const OTRO_VIN = '1HGCM82633A004399';

function cotizacion(id: string, vin: string | null, updated_at: string, referencia: string | null = null): CotizacionVin {
  return { id, estado: 'borrador', referencia, updated_at, vin, fecha_subasta: null, vendido_en_subasta: false };
}

const filas: CotizacionVin[] = [
  cotizacion('antigua', VIN, '2026-01-01T10:00:00Z', 'Honda antigua'),
  cotizacion('reciente', VIN, '2026-03-01T10:00:00Z', 'Honda nueva'),
  cotizacion('otra', OTRO_VIN, '2026-05-01T10:00:00Z'),
  cotizacion('sin-vin', null, '2026-06-01T10:00:00Z'),
];

describe('buscarDuplicadosVin', () => {
  it('ignora mayúsculas y espacios y ordena de la más reciente a la más antigua', () => {
    expect(buscarDuplicadosVin(filas, ` ${VIN.toLowerCase()} `, 'nueva-cotizacion').map((f) => f.id)).toEqual([
      'reciente',
      'antigua',
    ]);
  });

  it('excluye la cotización que está abierta', () => {
    expect(buscarDuplicadosVin(filas, VIN, 'reciente').map((f) => f.id)).toEqual(['antigua']);
  });

  it('no busca con un VIN incompleto o ausente', () => {
    expect(buscarDuplicadosVin(filas, '1HGCM8263', 'x')).toEqual([]);
    expect(buscarDuplicadosVin(filas, '', 'x')).toEqual([]);
  });

  it('no coincide con un VIN distinto aunque comparta el prefijo', () => {
    expect(buscarDuplicadosVin(filas, '1HGCM82633A004300', 'x')).toEqual([]);
  });
});
