export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function claveComparable(texto: string): string {
  return normalizarTexto(texto).replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

const ESTADOS_EE_UU: ReadonlyArray<readonly [codigo: string, nombres: readonly string[]]> = [
  ['AL', ['ALABAMA']],
  ['AK', ['ALASKA']],
  ['AZ', ['ARIZONA']],
  ['AR', ['ARKANSAS']],
  ['CA', ['CALIFORNIA']],
  ['CO', ['COLORADO']],
  ['CT', ['CONNECTICUT']],
  ['DE', ['DELAWARE']],
  ['DC', ['DISTRICT OF COLUMBIA']],
  ['FL', ['FLORIDA']],
  ['GA', ['GEORGIA']],
  ['HI', ['HAWAII']],
  ['ID', ['IDAHO']],
  ['IL', ['ILLINOIS']],
  ['IN', ['INDIANA']],
  ['IA', ['IOWA']],
  ['KS', ['KANSAS']],
  ['KY', ['KENTUCKY']],
  ['LA', ['LOUISIANA']],
  ['ME', ['MAINE']],
  ['MD', ['MARYLAND']],
  ['MA', ['MASSACHUSETTS', 'MASSACHUSSETTS']],
  ['MI', ['MICHIGAN']],
  ['MN', ['MINNESOTA']],
  ['MS', ['MISSISSIPPI']],
  ['MO', ['MISSOURI']],
  ['MT', ['MONTANA']],
  ['NE', ['NEBRASKA']],
  ['NV', ['NEVADA']],
  ['NH', ['NEW HAMPSHIRE']],
  ['NJ', ['NEW JERSEY']],
  ['NM', ['NEW MEXICO']],
  ['NY', ['NEW YORK']],
  ['NC', ['NORTH CAROLINA']],
  ['ND', ['NORTH DAKOTA']],
  ['OH', ['OHIO']],
  ['OK', ['OKLAHOMA']],
  ['OR', ['OREGON']],
  ['PA', ['PENNSYLVANIA', 'PENSILVANIA']],
  ['RI', ['RHODE ISLAND']],
  ['SC', ['SOUTH CAROLINA']],
  ['SD', ['SOUTH DAKOTA']],
  ['TN', ['TENNESSEE']],
  ['TX', ['TEXAS']],
  ['UT', ['UTAH']],
  ['VT', ['VERMONT']],
  ['VA', ['VIRGINIA']],
  ['WA', ['WASHINGTON']],
  ['WV', ['WEST VIRGINIA']],
  ['WI', ['WISCONSIN']],
  ['WY', ['WYOMING']],
];

const CODIGOS_VALIDOS = new Set(ESTADOS_EE_UU.map(([codigo]) => codigo));
const CODIGO_POR_NOMBRE = new Map(
  ESTADOS_EE_UU.flatMap(([codigo, nombres]) => nombres.map((nombre) => [normalizarTexto(nombre), codigo] as const)),
);

export function codigoEstadoOrigen(estadoOrigen: string | null): string | null {
  if (estadoOrigen === null) return null;
  return CODIGO_POR_NOMBRE.get(normalizarTexto(estadoOrigen)) ?? null;
}

export type SedeParseada = {
  original: string;
  nombre: string;
  estado: string | null;
};

const PATRON_SEDE = /^(.*?)\s*\(([A-Za-z]{2})\)$/;

export function parsearSede(texto: string): SedeParseada {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  const coincidencia = PATRON_SEDE.exec(limpio);
  const codigo = coincidencia?.[2]?.toUpperCase();
  if (coincidencia && codigo !== undefined && CODIGOS_VALIDOS.has(codigo)) {
    return { original: texto, nombre: (coincidencia[1] ?? '').trim(), estado: codigo };
  }
  return { original: texto, nombre: limpio, estado: null };
}
