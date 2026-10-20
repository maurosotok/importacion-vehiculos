export type Posicion = { fila: number; columna: number };
export type Dimensiones = { filas: number; columnas: number };

export function moverPosicion(pos: Posicion, dim: Dimensiones, tecla: string, shift = false): Posicion {
  if (dim.filas <= 0 || dim.columnas <= 0) return pos;
  const ultimaColumna = dim.columnas - 1;
  const ultimaFila = dim.filas - 1;
  const limitar = (n: number, max: number) => Math.min(Math.max(n, 0), max);

  switch (tecla) {
    case 'ArrowUp':
      return { fila: limitar(pos.fila - 1, ultimaFila), columna: pos.columna };
    case 'ArrowDown':
    case 'Enter':
      return { fila: limitar(pos.fila + 1, ultimaFila), columna: pos.columna };
    case 'ArrowLeft':
      return { fila: pos.fila, columna: limitar(pos.columna - 1, ultimaColumna) };
    case 'ArrowRight':
      return { fila: pos.fila, columna: limitar(pos.columna + 1, ultimaColumna) };
    case 'Tab': {
      const indice = pos.fila * dim.columnas + pos.columna + (shift ? -1 : 1);
      const total = dim.filas * dim.columnas;
      const ajustado = ((indice % total) + total) % total;
      return { fila: Math.floor(ajustado / dim.columnas), columna: ajustado % dim.columnas };
    }
    default:
      return pos;
  }
}
