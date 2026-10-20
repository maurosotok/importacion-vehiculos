import { normalizarTexto } from './gruas';

export function coincideBusqueda(campos: (string | null | undefined)[], consulta: string): boolean {
  const tokens = normalizarTexto(consulta).split(' ').filter((t) => t !== '');
  if (tokens.length === 0) return true;
  const texto = normalizarTexto(campos.filter((c): c is string => typeof c === 'string').join(' '));
  return tokens.every((token) => texto.includes(token));
}

export function filtrarPorBusqueda<T>(
  items: T[],
  consulta: string,
  campos: (item: T) => (string | null | undefined)[],
): T[] {
  return items.filter((item) => coincideBusqueda(campos(item), consulta));
}
