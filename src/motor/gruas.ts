import { claveComparable, codigoEstadoOrigen, normalizarTexto, parsearSede } from './sede';

export { normalizarTexto };

export type FilaGrua = {
  id: string;
  ubicacion: string;
  zona: string;
  estadoOrigen: string | null;
  montoUsd: string | null;
};

export type CoincidenciaGrua = {
  id: string;
  ubicacion: string;
  zona: string;
  estadoOrigen: string | null;
  montoUsd: string | null;
  verificada: boolean;
};

export type ResolucionGrua =
  | { estado: 'unica'; montoUsd: string; coincidencias: CoincidenciaGrua[] }
  | { estado: 'ambigua'; coincidencias: CoincidenciaGrua[] }
  | { estado: 'sin_importe'; coincidencias: CoincidenciaGrua[] }
  | { estado: 'pendiente'; coincidencias: CoincidenciaGrua[] }
  | { estado: 'sin_coincidencia' };

export function limpiarEtiquetaGrua(texto: string): string {
  const base = texto
    .replace(/\$\s*[\d.,]+/g, ' ')
    .replace(/Se cotiza/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (let corte = 1; corte < base.length; corte++) {
    const primera = base.slice(0, corte).trim();
    if (primera !== '' && primera === base.slice(corte).trim()) return primera;
  }
  return base;
}

export function buscarGruas(filas: FilaGrua[], consulta: string, zona: string | null): CoincidenciaGrua[] {
  const sede = parsearSede(consulta);
  const nombre = claveComparable(sede.nombre);
  if (nombre === '') return [];
  return filas.flatMap((fila) => {
    if (zona !== null && fila.zona !== zona) return [];
    if (sede.estado !== null && codigoEstadoOrigen(fila.estadoOrigen) !== sede.estado) return [];
    const etiqueta = claveComparable(fila.ubicacion);
    if (!etiqueta.includes(nombre)) return [];
    return [
      {
        id: fila.id,
        ubicacion: fila.ubicacion,
        zona: fila.zona,
        estadoOrigen: fila.estadoOrigen,
        montoUsd: fila.montoUsd,
        verificada: etiqueta === `${nombre} IAA`,
      },
    ];
  });
}

export function resolverGrua(coincidencias: CoincidenciaGrua[]): ResolucionGrua {
  if (coincidencias.length === 0) return { estado: 'sin_coincidencia' };
  const verificadas = coincidencias.filter((c) => c.verificada);
  if (verificadas.length === 0) return { estado: 'pendiente', coincidencias };
  const estados = new Set(verificadas.map((c) => c.estadoOrigen));
  if (estados.size > 1) return { estado: 'ambigua', coincidencias: verificadas };
  const montos = new Set(verificadas.map((c) => c.montoUsd ?? 'null'));
  if (montos.size > 1) return { estado: 'ambigua', coincidencias: verificadas };
  const monto = verificadas[0]?.montoUsd ?? null;
  if (monto === null) return { estado: 'sin_importe', coincidencias: verificadas };
  return { estado: 'unica', montoUsd: monto, coincidencias: verificadas };
}

export function zonaSugerida(filas: FilaGrua[], ubicacion: string): string | null {
  const zonas = Array.from(new Set(buscarGruas(filas, ubicacion, null).map((c) => c.zona)));
  return zonas.length === 1 ? (zonas[0] ?? null) : null;
}
