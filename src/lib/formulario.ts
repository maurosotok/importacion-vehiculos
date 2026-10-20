import { valorDecimal, type EntradasCotizacion, type ModoFees, type ModoImpuestos } from '../motor/calculo';

export type Numero = number | string | null;

export type VehiculoFila = {
  id: string;
  vin: string | null;
  marca: string | null;
  modelo: string | null;
  version: string | null;
  anio: number | null;
  row_version: number;
};

export type CotizacionFila = {
  id: string;
  vehicle_id: string;
  estado: string;
  referencia: string | null;
  fecha_negocio: string;
  subasta: string | null;
  ubicacion: string | null;
  zona_salida: string | null;
  tipo_vehiculo: string | null;
  perfil_fees_clave: string | null;
  modo_fees: ModoFees;
  puja_usd: Numero;
  fees_usd: Numero;
  carro_mas_fees_usd: Numero;
  grua_usd: Numero;
  barco_usd: Numero;
  papeleria_usd: Numero;
  tipo_cambio_hnl_por_usd: Numero;
  modo_impuestos: ModoImpuestos;
  total_combinado_hnl: Numero;
  impuesto_hnl: Numero;
  gastos_locales_hnl: Numero;
  reparacion_hnl: Numero;
  precio_venta_hnl: Numero;
  notas: string | null;
  row_version: number;
};

export type Campos = {
  vin: string;
  marca: string;
  modelo: string;
  version: string;
  anio: string;
  referencia: string;
  subasta: string;
  ubicacion: string;
  zonaSalida: string;
  tipoVehiculo: string;
  perfilFeesClave: string;
  modoFees: ModoFees;
  pujaUsd: string;
  feesUsd: string;
  carroMasFeesUsd: string;
  gruaUsd: string;
  barcoUsd: string;
  papeleriaUsd: string;
  tipoCambioHnlPorUsd: string;
  modoImpuestos: ModoImpuestos;
  totalCombinadoHnl: string;
  impuestoHnl: string;
  gastosLocalesHnl: string;
  reparacionHnl: string;
  precioVentaHnl: string;
  notas: string;
};

export type CampoInvalido = keyof Campos;

const COLUMNAS_COTIZACION: Record<string, keyof CotizacionFila> = {
  referencia: 'referencia',
  subasta: 'subasta',
  ubicacion: 'ubicacion',
  zonaSalida: 'zona_salida',
  tipoVehiculo: 'tipo_vehiculo',
  perfilFeesClave: 'perfil_fees_clave',
  modoFees: 'modo_fees',
  pujaUsd: 'puja_usd',
  feesUsd: 'fees_usd',
  carroMasFeesUsd: 'carro_mas_fees_usd',
  gruaUsd: 'grua_usd',
  barcoUsd: 'barco_usd',
  papeleriaUsd: 'papeleria_usd',
  tipoCambioHnlPorUsd: 'tipo_cambio_hnl_por_usd',
  modoImpuestos: 'modo_impuestos',
  totalCombinadoHnl: 'total_combinado_hnl',
  impuestoHnl: 'impuesto_hnl',
  gastosLocalesHnl: 'gastos_locales_hnl',
  reparacionHnl: 'reparacion_hnl',
  precioVentaHnl: 'precio_venta_hnl',
  notas: 'notas',
};

const NUMERICOS = new Set<keyof Campos>([
  'pujaUsd',
  'feesUsd',
  'carroMasFeesUsd',
  'gruaUsd',
  'barcoUsd',
  'papeleriaUsd',
  'tipoCambioHnlPorUsd',
  'totalCombinadoHnl',
  'impuestoHnl',
  'gastosLocalesHnl',
  'reparacionHnl',
  'precioVentaHnl',
]);

const textoODefecto = (valor: string | null | undefined): string => valor ?? '';

export function aFormulario(vehiculo: VehiculoFila, cotizacion: CotizacionFila): Campos {
  const num = (valor: Numero): string => (valor === null ? '' : String(valor));
  return {
    vin: textoODefecto(vehiculo.vin),
    marca: textoODefecto(vehiculo.marca),
    modelo: textoODefecto(vehiculo.modelo),
    version: textoODefecto(vehiculo.version),
    anio: vehiculo.anio === null ? '' : String(vehiculo.anio),
    referencia: textoODefecto(cotizacion.referencia),
    subasta: textoODefecto(cotizacion.subasta),
    ubicacion: textoODefecto(cotizacion.ubicacion),
    zonaSalida: textoODefecto(cotizacion.zona_salida),
    tipoVehiculo: textoODefecto(cotizacion.tipo_vehiculo),
    perfilFeesClave: textoODefecto(cotizacion.perfil_fees_clave),
    modoFees: cotizacion.modo_fees,
    pujaUsd: num(cotizacion.puja_usd),
    feesUsd: num(cotizacion.fees_usd),
    carroMasFeesUsd: num(cotizacion.carro_mas_fees_usd),
    gruaUsd: num(cotizacion.grua_usd),
    barcoUsd: num(cotizacion.barco_usd),
    papeleriaUsd: num(cotizacion.papeleria_usd),
    tipoCambioHnlPorUsd: num(cotizacion.tipo_cambio_hnl_por_usd),
    modoImpuestos: cotizacion.modo_impuestos,
    totalCombinadoHnl: num(cotizacion.total_combinado_hnl),
    impuestoHnl: num(cotizacion.impuesto_hnl),
    gastosLocalesHnl: num(cotizacion.gastos_locales_hnl),
    reparacionHnl: num(cotizacion.reparacion_hnl),
    precioVentaHnl: num(cotizacion.precio_venta_hnl),
    notas: textoODefecto(cotizacion.notas),
  };
}

function textoONulo(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function validarAnio(valor: string): { valor: number | null; valido: boolean } {
  const limpio = valor.trim();
  if (limpio === '') return { valor: null, valido: true };
  const anio = Number(limpio);
  const valido = /^\d{4}$/.test(limpio) && anio >= 1900 && anio <= 2100;
  return { valor: valido ? anio : null, valido };
}

function validarVin(valor: string): { valor: string | null; valido: boolean } {
  const limpio = valor.trim().toUpperCase();
  if (limpio === '') return { valor: null, valido: true };
  return { valor: limpio, valido: limpio.length <= 17 };
}

export type ParchesFormulario = {
  vehiculo: Partial<Record<keyof VehiculoFila, string | number | null>>;
  cotizacion: Partial<Record<keyof CotizacionFila, string | number | null>>;
  invalidos: CampoInvalido[];
};

export function construirParches(campos: Campos): ParchesFormulario {
  const invalidos: CampoInvalido[] = [];
  const vehiculo: ParchesFormulario['vehiculo'] = {};
  const cotizacion: ParchesFormulario['cotizacion'] = {};

  const vin = validarVin(campos.vin);
  if (!vin.valido) invalidos.push('vin');
  else vehiculo.vin = vin.valor;

  const anio = validarAnio(campos.anio);
  if (!anio.valido) invalidos.push('anio');
  else vehiculo.anio = anio.valor;

  vehiculo.marca = textoONulo(campos.marca);
  vehiculo.modelo = textoONulo(campos.modelo);
  vehiculo.version = textoONulo(campos.version);

  for (const [clave, columna] of Object.entries(COLUMNAS_COTIZACION) as [keyof Campos, keyof CotizacionFila][]) {
    const valor = campos[clave];
    if (!NUMERICOS.has(clave)) {
      cotizacion[columna] = clave === 'modoFees' || clave === 'modoImpuestos' ? valor : textoONulo(valor);
      continue;
    }
    if (valor.trim() === '') {
      cotizacion[columna] = null;
      continue;
    }
    const numero = valorDecimal(valor.trim());
    if (numero === null || numero.isNegative()) {
      invalidos.push(clave);
      continue;
    }
    cotizacion[columna] = numero.toString();
  }

  return { vehiculo, cotizacion, invalidos };
}

export function aEntradas(campos: Campos): EntradasCotizacion {
  const num = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());
  return {
    pujaUsd: num(campos.pujaUsd),
    modoFees: campos.modoFees,
    feesUsd: num(campos.feesUsd),
    carroMasFeesUsd: num(campos.carroMasFeesUsd),
    feeTablaUsd: null,
    gruaUsd: num(campos.gruaUsd),
    barcoUsd: num(campos.barcoUsd),
    papeleriaUsd: num(campos.papeleriaUsd),
    tipoCambioHnlPorUsd: num(campos.tipoCambioHnlPorUsd),
    modoImpuestos: campos.modoImpuestos,
    totalCombinadoHnl: num(campos.totalCombinadoHnl),
    impuestoHnl: num(campos.impuestoHnl),
    gastosLocalesHnl: num(campos.gastosLocalesHnl),
    reparacionHnl: num(campos.reparacionHnl),
    precioVentaHnl: num(campos.precioVentaHnl),
  };
}
