import { valorDecimal, type EntradasCotizacion, type ModoFees, type ModoImpuestos } from '../motor/calculo';
import { calcularTablaFees, type ResultadoTablaFees, type VersionFees } from '../motor/fees';

export type Numero = number | string | null;

export type VersionFeesActiva = { perfilClave: string; contenido: VersionFees };

export type ResolucionFees = {
  version: VersionFees | null;
  modalidad: string | null;
  resultado: ResultadoTablaFees;
};

export const MOTIVO_FEES: Record<Extract<ResultadoTablaFees, { ok: false }>['motivo'], string> = {
  sin_tabla: 'El perfil no tiene tabla cargada. Capture los fees a mano.',
  sin_tramo: 'La puja no cae en ningún tramo de la tabla.',
  puja_invalida: 'Capture la puja para calcular los fees.',
  version_invalida: 'La tabla de fees tiene un error de datos. Capture los fees a mano.',
  cargo_sin_cobertura: 'Hay un cargo de la tabla que no cubre esta puja. Capture los fees a mano.',
  modalidad_no_documentada: 'Elija una modalidad de puja documentada en la tabla.',
};

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
  modalidad_puja: string | null;
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
  grua_fuente: string | null;
  grua_referencia_clave: string | null;
  barco_fuente: string | null;
  barco_referencia_clave: string | null;
  vendedor: string | null;
  fecha_subasta: string | null;
  vendido_en_subasta: boolean;
  max_bid_manual_usd: Numero;
  verificacion_bidcars: string | null;
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
  modalidadPuja: string;
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
  gruaFuente: string;
  gruaReferenciaClave: string;
  barcoFuente: string;
  barcoReferenciaClave: string;
  vendedor: string;
  fechaSubasta: string;
  vendidoEnSubasta: boolean;
  maxBidManualUsd: string;
  verificacionBidcars: string;
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
  modalidadPuja: 'modalidad_puja',
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
  gruaFuente: 'grua_fuente',
  gruaReferenciaClave: 'grua_referencia_clave',
  barcoFuente: 'barco_fuente',
  barcoReferenciaClave: 'barco_referencia_clave',
  vendedor: 'vendedor',
  maxBidManualUsd: 'max_bid_manual_usd',
  verificacionBidcars: 'verificacion_bidcars',
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
  'maxBidManualUsd',
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
    modalidadPuja: textoODefecto(cotizacion.modalidad_puja),
    pujaUsd: num(cotizacion.puja_usd),
    feesUsd: cotizacion.modo_fees === 'tabla' ? '' : num(cotizacion.fees_usd),
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
    gruaFuente: textoODefecto(cotizacion.grua_fuente),
    gruaReferenciaClave: textoODefecto(cotizacion.grua_referencia_clave),
    barcoFuente: textoODefecto(cotizacion.barco_fuente),
    barcoReferenciaClave: textoODefecto(cotizacion.barco_referencia_clave),
    vendedor: textoODefecto(cotizacion.vendedor),
    fechaSubasta: textoODefecto(cotizacion.fecha_subasta),
    vendidoEnSubasta: cotizacion.vendido_en_subasta,
    maxBidManualUsd: num(cotizacion.max_bid_manual_usd),
    verificacionBidcars: textoODefecto(cotizacion.verificacion_bidcars),
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

function validarFecha(valor: string): { valor: string | null; valido: boolean } {
  const limpio = valor.trim();
  if (limpio === '') return { valor: null, valido: true };
  return { valor: limpio, valido: /^\d{4}-\d{2}-\d{2}$/.test(limpio) };
}

export type ParchesFormulario = {
  vehiculo: Partial<Record<keyof VehiculoFila, string | number | null>>;
  cotizacion: Record<string, unknown>;
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

  const fecha = validarFecha(campos.fechaSubasta);
  if (!fecha.valido) invalidos.push('fechaSubasta');
  else cotizacion.fecha_subasta = fecha.valor;

  cotizacion.vendido_en_subasta = campos.vendidoEnSubasta;

  vehiculo.marca = textoONulo(campos.marca);
  vehiculo.modelo = textoONulo(campos.modelo);
  vehiculo.version = textoONulo(campos.version);

  for (const [clave, columna] of Object.entries(COLUMNAS_COTIZACION) as [Exclude<keyof Campos, 'vendidoEnSubasta'>, keyof CotizacionFila][]) {
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

export const MODALIDAD_PREDETERMINADA = 'internet_live';

export function modalidadEfectiva(campos: Campos, version: VersionFees | null): string | null {
  const capturada = campos.modalidadPuja.trim();
  if (capturada !== '') return capturada;
  if (version?.modalidades.includes(MODALIDAD_PREDETERMINADA)) return MODALIDAD_PREDETERMINADA;
  return version && version.modalidades.length === 1 ? version.modalidades[0] ?? null : null;
}

export function resolverFees(campos: Campos, versiones: VersionFeesActiva[]): ResolucionFees {
  const version = versiones.find((v) => v.perfilClave === campos.perfilFeesClave)?.contenido ?? null;
  const modalidad = modalidadEfectiva(campos, version);
  const puja = campos.pujaUsd.trim() === '' ? null : campos.pujaUsd.trim();
  return { version, modalidad, resultado: calcularTablaFees(puja, version, modalidad) };
}

export function snapshotFees(campos: Campos, resolucion: ResolucionFees): Record<string, unknown> {
  const { resultado, version, modalidad } = resolucion;
  if (campos.modoFees !== 'tabla' || !resultado.ok || version === null) {
    return { modalidad_puja: modalidad, fees_version: null, fees_desglose: [] };
  }
  return {
    modalidad_puja: modalidad,
    fees_version: version.version,
    fees_desglose: resultado.lineas.map((linea) => ({
      concepto: linea.concepto,
      monto: linea.monto.toString(),
      estado: linea.estado ?? null,
    })),
  };
}

export function aEntradas(campos: Campos, feeTablaUsd: string | null = null): EntradasCotizacion {
  const num = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());
  return {
    pujaUsd: num(campos.pujaUsd),
    modoFees: campos.modoFees,
    feesUsd: num(campos.feesUsd),
    carroMasFeesUsd: num(campos.carroMasFeesUsd),
    feeTablaUsd,
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
