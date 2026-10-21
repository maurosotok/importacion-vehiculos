export type FilaListado = {
  id: string;
  fechaNegocio: string;
  fechaSubasta: string | null;
  vendidoEnSubasta: boolean;
  vehiculo: string;
  vin: string | null;
  referencia: string | null;
  estado: string;
  updatedAt: string;
};

export type FiltrosListado = {
  fechas: 'hoy_en_adelante' | 'todas';
  vendido: 'todos' | 'si' | 'no';
  mostrarVendidasPasadas: boolean;
};

export const FILTROS_INICIALES: FiltrosListado = {
  fechas: 'hoy_en_adelante',
  vendido: 'todos',
  mostrarVendidasPasadas: false,
};

export const SIN_FILTROS: FiltrosListado = {
  fechas: 'todas',
  vendido: 'todos',
  mostrarVendidasPasadas: true,
};

export function hoyEnHonduras(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function formatearFechaCorta(fechaIso: string | null): string {
  if (fechaIso === null) return '—';
  const [anio, mes, dia] = fechaIso.split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fechaIso;
}

export function esBorradorSinDatos(fila: FilaListado): boolean {
  return (
    fila.estado === 'borrador' &&
    fila.vehiculo === '' &&
    fila.vin === null &&
    fila.referencia === null &&
    fila.fechaSubasta === null
  );
}

function visible(fila: FilaListado, filtros: FiltrosListado, hoy: string): boolean {
  const subastaPasada = fila.fechaSubasta !== null && fila.fechaSubasta < hoy;
  if (filtros.fechas === 'hoy_en_adelante' && subastaPasada) return false;
  if (!filtros.mostrarVendidasPasadas && subastaPasada && fila.vendidoEnSubasta) return false;
  if (filtros.vendido === 'si' && !fila.vendidoEnSubasta) return false;
  if (filtros.vendido === 'no' && fila.vendidoEnSubasta) return false;
  return true;
}

function comparar(a: FilaListado, b: FilaListado): number {
  if (a.fechaSubasta !== b.fechaSubasta) {
    if (a.fechaSubasta === null) return 1;
    if (b.fechaSubasta === null) return -1;
    return a.fechaSubasta < b.fechaSubasta ? -1 : 1;
  }
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function listarCotizaciones(filas: FilaListado[], filtros: FiltrosListado, hoy: string): FilaListado[] {
  return filas.filter((fila) => visible(fila, filtros, hoy)).sort(comparar);
}
