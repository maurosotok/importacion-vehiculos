export type FilaGrua = {
  id: string;
  ubicacion: string;
  zona: string;
  montoUsd: string | null;
};

export type CoincidenciaGrua = {
  id: string;
  ubicacion: string;
  zona: string;
  montoUsd: string | null;
};

export type ResolucionGrua =
  | { estado: 'unica'; montoUsd: string; coincidencias: CoincidenciaGrua[] }
  | { estado: 'ambigua'; coincidencias: CoincidenciaGrua[] }
  | { estado: 'sin_importe'; coincidencias: CoincidenciaGrua[] }
  | { estado: 'sin_coincidencia' };

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function buscarGruas(filas: FilaGrua[], consulta: string, zona: string | null): CoincidenciaGrua[] {
  const buscado = normalizarTexto(consulta);
  if (buscado === '') return [];
  return filas
    .filter((f) => (zona === null || f.zona === zona) && normalizarTexto(f.ubicacion).includes(buscado))
    .map(({ id, ubicacion, zona: z, montoUsd }) => ({ id, ubicacion, zona: z, montoUsd }));
}

export function resolverGrua(coincidencias: CoincidenciaGrua[]): ResolucionGrua {
  if (coincidencias.length === 0) return { estado: 'sin_coincidencia' };
  const montos = new Set(coincidencias.map((c) => c.montoUsd ?? 'null'));
  if (montos.size > 1) return { estado: 'ambigua', coincidencias };
  const monto = coincidencias[0]?.montoUsd ?? null;
  if (monto === null) return { estado: 'sin_importe', coincidencias };
  return { estado: 'unica', montoUsd: monto, coincidencias };
}

export function zonaSugerida(filas: FilaGrua[], ubicacion: string): string | null {
  const zonas = Array.from(new Set(buscarGruas(filas, ubicacion, null).map((c) => c.zona)));
  return zonas.length === 1 ? (zonas[0] ?? null) : null;
}
