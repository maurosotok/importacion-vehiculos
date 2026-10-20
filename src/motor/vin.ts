export type EstadoVin = 'ausente' | 'incompleto' | 'formato_invalido' | 'completo';

export type DatosVin = {
  marca: string | null;
  modelo: string | null;
  anio: number | null;
};

export type ResultadoVin =
  | { estado: 'datos'; vin: string; datos: DatosVin }
  | { estado: 'sin_datos'; vin: string }
  | { estado: 'error'; vin: string }
  | { estado: 'descartado' };

export type FetchVin = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const PATRON_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const LONGITUD_VIN = 17;
const URL_VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended';

export function normalizarVin(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, '').toUpperCase();
}

export function estadoVin(texto: string | null | undefined): EstadoVin {
  const vin = normalizarVin(texto);
  if (vin === '') return 'ausente';
  if (vin.length < LONGITUD_VIN) return 'incompleto';
  if (vin.length === LONGITUD_VIN && PATRON_VIN.test(vin)) return 'completo';
  return 'formato_invalido';
}

function textoONulo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

export function interpretarRespuestaVpic(json: unknown): DatosVin | null {
  if (typeof json !== 'object' || json === null || !('Results' in json)) return null;
  const resultados = json.Results;
  if (!Array.isArray(resultados)) return null;
  const primero: unknown = resultados[0];
  if (typeof primero !== 'object' || primero === null) return null;
  const registro = primero as Record<string, unknown>;
  const anioTexto = textoONulo(registro['ModelYear']);
  const anio = anioTexto !== null && /^\d{4}$/.test(anioTexto) ? Number(anioTexto) : null;
  const datos: DatosVin = {
    marca: textoONulo(registro['Make']),
    modelo: textoONulo(registro['Model']),
    anio,
  };
  return datos.marca === null && datos.modelo === null && datos.anio === null ? null : datos;
}

export function vinsRepetidos(filas: { id: string; vin: string | null }[]): Map<string, string[]> {
  const porVin = new Map<string, string[]>();
  for (const fila of filas) {
    const vin = normalizarVin(fila.vin);
    if (vin === '') continue;
    porVin.set(vin, [...(porVin.get(vin) ?? []), fila.id]);
  }
  for (const [vin, ids] of porVin) {
    if (ids.length < 2) porVin.delete(vin);
  }
  return porVin;
}

export class ControladorVin {
  private secuencia = 0;
  private readonly cache = new Map<string, DatosVin | null>();

  constructor(private readonly fetchFn: FetchVin) {}

  async consultar(texto: string): Promise<ResultadoVin> {
    const vin = normalizarVin(texto);
    const numero = ++this.secuencia;
    if (estadoVin(vin) !== 'completo') return { estado: 'sin_datos', vin };

    const enCache = this.cache.get(vin);
    if (enCache !== undefined) {
      return enCache === null ? { estado: 'sin_datos', vin } : { estado: 'datos', vin, datos: enCache };
    }

    let resultado: ResultadoVin;
    try {
      const respuesta = await this.fetchFn(`${URL_VPIC}/${vin}?format=json`);
      if (!respuesta.ok) return this.vigente(numero) ? { estado: 'error', vin } : { estado: 'descartado' };
      const datos = interpretarRespuestaVpic(await respuesta.json());
      this.cache.set(vin, datos);
      resultado = datos === null ? { estado: 'sin_datos', vin } : { estado: 'datos', vin, datos };
    } catch {
      resultado = { estado: 'error', vin };
    }
    return this.vigente(numero) ? resultado : { estado: 'descartado' };
  }

  private vigente(numero: number): boolean {
    return numero === this.secuencia;
  }
}
