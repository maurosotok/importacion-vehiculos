import type { Valor } from './calculo';

export type MapeoTipoVehiculo = {
  tipoCodigo: string;
  zonaSalida: string;
  categoriaOrigen: string | null;
};

export type TarifaEmbarque = {
  clave: string;
  zonaSalida: string;
  categoria: string;
  monto: Valor;
};

export type FuenteMonto = 'manual' | 'referencia';

export type MontoConFuente = { fuente: FuenteMonto; manual: Valor; referencia: Valor };

export function buscarBarcoReferencia(
  tipoCodigo: string | null,
  zonaSalida: string | null,
  mapeos: MapeoTipoVehiculo[],
  tarifas: TarifaEmbarque[],
): { clave: string; monto: Valor } | null {
  if (!tipoCodigo || !zonaSalida) return null;
  const mapeo = mapeos.find((m) => m.tipoCodigo === tipoCodigo && m.zonaSalida === zonaSalida);
  if (!mapeo?.categoriaOrigen) return null;
  const tarifa = tarifas.find((t) => t.zonaSalida === zonaSalida && t.categoria === mapeo.categoriaOrigen);
  return tarifa ? { clave: tarifa.clave, monto: tarifa.monto } : null;
}

export function montoEfectivo(entrada: MontoConFuente): Valor {
  return entrada.fuente === 'manual' ? entrada.manual : entrada.referencia;
}

export function volverATarifa(entrada: MontoConFuente): MontoConFuente {
  return { ...entrada, fuente: 'referencia' };
}
