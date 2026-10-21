import { estadoVin, normalizarVin } from './vin';

export type CotizacionVin = {
  id: string;
  estado: string;
  referencia: string | null;
  updated_at: string;
  vin: string | null;
};

export function buscarDuplicadosVin(filas: CotizacionVin[], vinTexto: string, excluirId: string): CotizacionVin[] {
  const vin = normalizarVin(vinTexto);
  if (estadoVin(vin) !== 'completo') return [];
  return filas
    .filter((fila) => fila.id !== excluirId && normalizarVin(fila.vin) === vin)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
