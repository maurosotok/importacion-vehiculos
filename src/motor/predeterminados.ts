export const ANIO_LIMITE_IMPUESTO_BAJO = 2010;
export const IMPUESTO_ANIO_BAJO_HNL = '10000';
export const GASTOS_LOCALES_ANIO_BAJO_HNL = '11000';
export const GASTOS_LOCALES_PREDETERMINADOS_HNL = '13557';

export type ImportesPredeterminados = { impuestoHnl: string; gastosLocalesHnl: string };

export function anioDesdeTexto(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{4}$/.test(limpio)) return null;
  const anio = Number(limpio);
  return anio >= 1900 && anio <= 2100 ? anio : null;
}

export function importesPredeterminados(
  anio: number,
  gastosLocalesHnl: string = GASTOS_LOCALES_PREDETERMINADOS_HNL,
): ImportesPredeterminados {
  if (anio <= ANIO_LIMITE_IMPUESTO_BAJO) {
    return { impuestoHnl: IMPUESTO_ANIO_BAJO_HNL, gastosLocalesHnl: GASTOS_LOCALES_ANIO_BAJO_HNL };
  }
  return { impuestoHnl: '', gastosLocalesHnl };
}

export function importesSonAutomaticos(
  actual: ImportesPredeterminados,
  gastosPredeterminadoHnl: string = GASTOS_LOCALES_PREDETERMINADOS_HNL,
): boolean {
  const impuesto = actual.impuestoHnl.trim();
  const gastos = actual.gastosLocalesHnl.trim();
  const impuestoAutomatico = impuesto === '' || impuesto === IMPUESTO_ANIO_BAJO_HNL;
  const gastosAutomaticos = [
    '',
    GASTOS_LOCALES_ANIO_BAJO_HNL,
    GASTOS_LOCALES_PREDETERMINADOS_HNL,
    gastosPredeterminadoHnl,
  ].includes(gastos);
  return impuestoAutomatico && gastosAutomaticos;
}
