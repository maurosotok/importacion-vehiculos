import { describe, expect, it } from 'vitest';
import {
  FILTROS_INICIALES,
  SIN_FILTROS,
  esBorradorSinDatos,
  formatearFechaCorta,
  hoyEnHonduras,
  listarCotizaciones,
  type FilaListado,
} from './listadoVehiculos';

const HOY = '2026-10-21';

function fila(id: string, props: Partial<FilaListado> = {}): FilaListado {
  return {
    id,
    fechaNegocio: '2026-10-01',
    fechaSubasta: null,
    vendidoEnSubasta: false,
    vehiculo: 'Honda CR-V 2007',
    vin: null,
    referencia: null,
    estado: 'borrador',
    updatedAt: '2026-10-01T10:00:00Z',
    ...props,
  };
}

const filas: FilaListado[] = [
  fila('pasada-no-vendida', { fechaSubasta: '2026-10-10' }),
  fila('pasada-vendida', { fechaSubasta: '2026-10-05', vendidoEnSubasta: true }),
  fila('hoy', { fechaSubasta: HOY }),
  fila('futura-vendida', { fechaSubasta: '2026-11-02', vendidoEnSubasta: true }),
  fila('futura-b', { fechaSubasta: '2026-10-30', updatedAt: '2026-10-02T10:00:00Z' }),
  fila('futura-a', { fechaSubasta: '2026-10-30', updatedAt: '2026-10-09T10:00:00Z' }),
  fila('sin-fecha-1', { fechaSubasta: null, updatedAt: '2026-10-03T10:00:00Z' }),
  fila('sin-fecha-2', { fechaSubasta: null, updatedAt: '2026-10-08T10:00:00Z' }),
];

const ids = (lista: FilaListado[]): string[] => lista.map((f) => f.id);

describe('listado por defecto', () => {
  it('muestra subastas de hoy en adelante y las sin fecha al final', () => {
    expect(ids(listarCotizaciones(filas, FILTROS_INICIALES, HOY))).toEqual([
      'hoy',
      'futura-a',
      'futura-b',
      'futura-vendida',
      'sin-fecha-2',
      'sin-fecha-1',
    ]);
  });

  it('oculta las fechas anteriores a hoy, incluidas las vendidas', () => {
    const visibles = ids(listarCotizaciones(filas, FILTROS_INICIALES, HOY));
    expect(visibles).not.toContain('pasada-no-vendida');
    expect(visibles).not.toContain('pasada-vendida');
  });
});

describe('Mostrar todas', () => {
  it('recupera subastas pasadas, vendidas y sin fecha', () => {
    const todas = ids(listarCotizaciones(filas, SIN_FILTROS, HOY));
    expect(todas).toEqual(expect.arrayContaining(['pasada-no-vendida', 'pasada-vendida', 'sin-fecha-1', 'sin-fecha-2']));
    expect(todas).toHaveLength(filas.length);
  });

  it('ordena por fecha de subasta ascendente y deja las sin fecha al final', () => {
    expect(ids(listarCotizaciones(filas, SIN_FILTROS, HOY))).toEqual([
      'pasada-vendida',
      'pasada-no-vendida',
      'hoy',
      'futura-a',
      'futura-b',
      'futura-vendida',
      'sin-fecha-2',
      'sin-fecha-1',
    ]);
  });
});

describe('filtros de estado vendido y subastas pasadas', () => {
  it('con fechas todas, las pasadas vendidas se ocultan hasta activar el interruptor', () => {
    const sinInterruptor = { fechas: 'todas' as const, vendido: 'todos' as const, mostrarVendidasPasadas: false };
    const visibles = ids(listarCotizaciones(filas, sinInterruptor, HOY));
    expect(visibles).toContain('pasada-no-vendida');
    expect(visibles).not.toContain('pasada-vendida');
  });

  it('filtra solo vendidas y solo no vendidas', () => {
    expect(ids(listarCotizaciones(filas, { ...FILTROS_INICIALES, vendido: 'si' }, HOY))).toEqual(['futura-vendida']);
    expect(ids(listarCotizaciones(filas, { ...FILTROS_INICIALES, vendido: 'no' }, HOY))).not.toContain('futura-vendida');
  });

  it('las subastas sin fecha siguen visibles con el filtro de vendido', () => {
    expect(ids(listarCotizaciones(filas, { ...FILTROS_INICIALES, vendido: 'no' }, HOY))).toContain('sin-fecha-1');
  });
});

describe('misma VIN en dos subastas', () => {
  it('ambas subastas aparecen como filas separadas con su propio estado vendido', () => {
    const misma = [
      fila('subasta-1', { vin: 'JHLRE38797C009075', fechaSubasta: '2026-10-05', vendidoEnSubasta: true }),
      fila('subasta-2', { vin: 'JHLRE38797C009075', fechaSubasta: '2026-11-10', vendidoEnSubasta: false }),
    ];
    const todas = listarCotizaciones(misma, SIN_FILTROS, HOY);
    expect(todas.map((f) => [f.id, f.vendidoEnSubasta])).toEqual([
      ['subasta-1', true],
      ['subasta-2', false],
    ]);
    expect(ids(listarCotizaciones(misma, FILTROS_INICIALES, HOY))).toEqual(['subasta-2']);
  });
});

describe('fechas en hora de Honduras', () => {
  it('usa la fecha local de Tegucigalpa, sin desfase UTC', () => {
    expect(hoyEnHonduras(new Date('2026-10-21T05:30:00Z'))).toBe('2026-10-20');
    expect(hoyEnHonduras(new Date('2026-10-21T06:30:00Z'))).toBe('2026-10-21');
    expect(hoyEnHonduras(new Date('2026-10-22T05:59:00Z'))).toBe('2026-10-21');
  });

  it('formatea la fecha sin convertirla a Date', () => {
    expect(formatearFechaCorta('2026-10-21')).toBe('21/10/2026');
    expect(formatearFechaCorta(null)).toBe('—');
  });
});

describe('borrador sin datos', () => {
  it('solo un borrador vacío se confirma como sin datos', () => {
    expect(esBorradorSinDatos(fila('vacia', { vehiculo: '', estado: 'borrador' }))).toBe(true);
    expect(esBorradorSinDatos(fila('con-vin', { vehiculo: '', vin: 'JHLRE38797C009075' }))).toBe(false);
    expect(esBorradorSinDatos(fila('comprada', { vehiculo: '', estado: 'comprada' }))).toBe(false);
  });
});
