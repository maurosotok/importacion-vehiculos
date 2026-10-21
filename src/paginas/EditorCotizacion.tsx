import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  aEntradas,
  aFormulario,
  construirParches,
  MOTIVO_FEES,
  resolverFees,
  snapshotFees,
  type Campos,
  type CampoInvalido,
  type CotizacionFila,
  type ResolucionFees,
  type VehiculoFila,
  type VersionFeesActiva,
} from '../lib/formulario';
import { crearCotizacion } from '../lib/nuevaCotizacion';
import {
  avisosCambioParametros,
  calcularCotizacion,
  formatearMonto,
  valorDecimal,
  type Pendiente,
} from '../motor/calculo';
import { buscarBarcoReferencia, type MapeoTipoVehiculo, type TarifaEmbarque } from '../motor/referencias';
import type { VersionFees } from '../motor/fees';
import {
  buscarGruas,
  limpiarEtiquetaGrua,
  resolverGrua,
  zonaSugerida,
  type AliasSedeGrua,
  type CoincidenciaGrua,
  type FilaGrua,
} from '../motor/gruas';
import { buscarDuplicadosVin, type CotizacionVin } from '../motor/duplicados';
import { formatearFechaCorta } from '../lib/listadoVehiculos';
import {
  anioDesdeTexto,
  GASTOS_LOCALES_PREDETERMINADOS_HNL,
  importesPredeterminados,
  importesSonAutomaticos,
} from '../motor/predeterminados';
import { ControladorVin, estadoVin, normalizarVin } from '../motor/vin';
import { irA } from '../lib/ruta';

type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'fallo' | 'conflicto';

type PerfilFees = { clave: string; etiqueta: string; tablaCargada: boolean };

type Referencias = {
  perfiles: PerfilFees[];
  versionesFees: VersionFeesActiva[];
  mapeos: MapeoTipoVehiculo[];
  tarifas: TarifaEmbarque[];
  gruas: FilaGrua[];
  gastosLocalesPredeterminadoHnl: string;
};

type CargaEditor = { vehiculo: VehiculoFila; cotizacion: CotizacionFila; referencias: Referencias };

type ConsultaVin = { vin: string; estado: 'consultando' | 'aplicado' | 'sin_datos' | 'error' };

const RETARDO_AUTOGUARDADO_MS = 800;

const ETIQUETA_GUARDADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado',
  pendiente: 'Cambios pendientes',
  guardando: 'Guardando…',
  fallo: 'No se pudo guardar. Se reintentará con el próximo cambio.',
  conflicto: 'Hay una versión más reciente guardada.',
};

const ETIQUETA_PENDIENTE: Record<Pendiente, string> = {
  puja: 'Puja',
  fees: 'Fees',
  grua: 'Grúa',
  barco: 'Barco',
  papeleria: 'Papelería',
  tipo_cambio: 'Tipo de cambio',
  impuestos: 'Impuestos y gastos locales',
  reparacion: 'Reparación',
  precio_venta: 'Precio de venta',
};

const ETIQUETA_VIN: Record<ConsultaVin['estado'], string> = {
  consultando: 'Consultando datos del VIN…',
  aplicado: 'Datos del VIN revisados; solo se completaron los campos vacíos.',
  sin_datos: 'vPIC no devolvió datos para este VIN. Capture marca, modelo y año a mano.',
  error: 'No hubo respuesta de vPIC. Puede capturar los datos a mano.',
};

const RETARDO_DUPLICADOS_MS = 400;

const ETIQUETA_ESTADO_COTIZACION: Record<string, string> = {
  borrador: 'Borrador',
  comprada: 'Comprada',
  no_ganada: 'No ganada',
};

type FilaMapeo = { tipo_codigo: string; zona_salida: string; categoria_origen: string | null };
type FilaTarifa = { clave: string; zona_salida: string; categoria: string; monto: number | string };
type FilaPerfil = {
  clave: string;
  etiqueta: string;
  estado_tabla: string;
  seleccionable: boolean;
};
type FilaGruaBd = {
  clave: string;
  zona_salida: string;
  estado_origen: string | null;
  etiqueta: string;
  monto_usd: number | string | null;
  alias_sedes: AliasSedeGrua[] | null;
};
type FilaAjustes = { gastos_locales_predeterminado_hnl: number | string | null };
type FilaVersionFees = { fee_profile_clave: string; contenido: unknown };
type FilaDuplicadoBd = {
  id: string;
  estado: string;
  referencia: string | null;
  updated_at: string;
  fecha_subasta: string | null;
  vendido_en_subasta: boolean;
  vehicles: { vin: string | null } | null;
};

function aTextoONulo(valor: unknown): string | null {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : null;
}

function montoNormalizado(valor: unknown, respaldo: string): string {
  const decimal = valorDecimal(aTextoONulo(valor) ?? respaldo);
  return decimal === null ? respaldo : decimal.toString();
}

function procedenciaMonto(fuente: string, monto: string): string {
  if (fuente === 'referencia') return 'tarifa de referencia';
  if (monto.trim() === '') return 'pendiente';
  return 'importe manual';
}

async function cargarEditor(id: string): Promise<CargaEditor | 'no_encontrada' | 'error'> {
  const resCotizacion = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
  if (resCotizacion.error) return 'error';
  const cotizacion = resCotizacion.data as CotizacionFila | null;
  if (!cotizacion) return 'no_encontrada';

  const resVehiculo = await supabase.from('vehicles').select('*').eq('id', cotizacion.vehicle_id).single();
  if (resVehiculo.error) return 'error';
  const vehiculo = resVehiculo.data as VehiculoFila;

  const [perfiles, mapeos, tarifas, gruas, ajustes, versiones] = await Promise.all([
    supabase.from('fee_profiles').select('clave, etiqueta, estado_tabla, seleccionable').order('etiqueta'),
    supabase.from('vehicle_type_mappings').select('tipo_codigo, zona_salida, categoria_origen'),
    supabase.from('shipping_rates').select('clave, zona_salida, categoria, monto').eq('moneda', 'USD'),
    supabase.from('towing_rates').select('clave, zona_salida, estado_origen, etiqueta, monto_usd, alias_sedes'),
    supabase.from('user_settings').select('gastos_locales_predeterminado_hnl').maybeSingle(),
    supabase.from('fee_schedule_versions').select('fee_profile_clave, contenido').eq('es_activa', true),
  ]);
  if (perfiles.error || mapeos.error || tarifas.error || gruas.error || ajustes.error || versiones.error) return 'error';

  const versionesFees: VersionFeesActiva[] = (versiones.data as unknown as FilaVersionFees[])
    .filter((v) => v.contenido !== null)
    .map((v) => ({ perfilClave: v.fee_profile_clave, contenido: v.contenido as VersionFees }));
  const perfilesConTabla = new Set(versionesFees.map((v) => v.perfilClave));

  const filasPerfiles = (perfiles.data as unknown as FilaPerfil[]).filter(
    (p) => p.seleccionable || p.clave === cotizacion.perfil_fees_clave,
  );
  const filasAjustes: FilaAjustes | null = ajustes.data;

  return {
    vehiculo,
    cotizacion,
    referencias: {
      perfiles: filasPerfiles.map((p) => ({
        clave: p.clave,
        etiqueta: p.etiqueta,
        tablaCargada: perfilesConTabla.has(p.clave) || p.estado_tabla === 'verificada',
      })),
      versionesFees,
      gastosLocalesPredeterminadoHnl: montoNormalizado(
        filasAjustes?.gastos_locales_predeterminado_hnl,
        GASTOS_LOCALES_PREDETERMINADOS_HNL,
      ),
      mapeos: (mapeos.data as unknown as FilaMapeo[]).map((m) => ({
        tipoCodigo: m.tipo_codigo,
        zonaSalida: m.zona_salida,
        categoriaOrigen: m.categoria_origen,
      })),
      tarifas: (tarifas.data as unknown as FilaTarifa[]).map((t) => ({
        clave: t.clave,
        zonaSalida: t.zona_salida,
        categoria: t.categoria,
        monto: t.monto,
      })),
      gruas: (gruas.data as unknown as FilaGruaBd[]).map((g) => ({
        id: g.clave,
        ubicacion: limpiarEtiquetaGrua(g.etiqueta),
        zona: g.zona_salida,
        estadoOrigen: g.estado_origen,
        montoUsd: aTextoONulo(g.monto_usd),
        aliasSedes: g.alias_sedes ?? [],
      })),
    },
  };
}

export function EditorCotizacion({ id }: { id: string }) {
  const [carga, setCarga] = useState<CargaEditor | 'no_encontrada' | 'error' | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    void cargarEditor(id).then((resultado) => {
      if (vigente) setCarga(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [id, version]);

  if (carga === null) return <p>Cargando…</p>;
  if (carga === 'no_encontrada') return <p>No se encontró esta cotización.</p>;
  if (carga === 'error') return <p role="alert" className="error">No se pudo cargar la cotización.</p>;
  return (
    <FormularioCotizacion
      key={version}
      carga={carga}
      onRecargar={() => {
        setCarga(null);
        setVersion((v) => v + 1);
      }}
    />
  );
}

function conZonaSugerida(entrada: Partial<Campos>, actual: Campos, gruas: FilaGrua[]): Partial<Campos> {
  if (entrada.ubicacion === undefined) return entrada;
  const sugeridaAntes = zonaSugerida(gruas, actual.ubicacion);
  if (actual.zonaSalida !== '' && actual.zonaSalida !== sugeridaAntes) return entrada;
  return { ...entrada, zonaSalida: zonaSugerida(gruas, entrada.ubicacion) ?? '' };
}

function tarifaGruaAutomatica(siguiente: Campos, gruas: FilaGrua[]): Partial<Campos> {
  if (siguiente.gruaFuente === 'manual') return {};
  const coincidencias: CoincidenciaGrua[] =
    siguiente.ubicacion.trim() === ''
      ? []
      : buscarGruas(gruas, siguiente.ubicacion, siguiente.zonaSalida || null, siguiente.subasta || null);
  const resolucion = resolverGrua(coincidencias);
  if (resolucion.estado === 'unica') {
    return { gruaUsd: resolucion.montoUsd, gruaFuente: 'referencia', gruaReferenciaClave: resolucion.coincidencias[0]?.id ?? '' };
  }
  return siguiente.gruaFuente === 'referencia' ? { gruaUsd: '', gruaFuente: '', gruaReferenciaClave: '' } : {};
}

function tarifaBarcoAutomatica(siguiente: Campos, referencias: Referencias): Partial<Campos> {
  if (siguiente.barcoFuente === 'manual') return {};
  const referencia = buscarBarcoReferencia(
    siguiente.tipoVehiculo || null,
    siguiente.zonaSalida || null,
    referencias.mapeos,
    referencias.tarifas,
  );
  const monto = referencia ? valorDecimal(referencia.monto) : null;
  if (referencia && monto !== null) {
    return { barcoUsd: monto.toString(), barcoFuente: 'referencia', barcoReferenciaClave: referencia.clave };
  }
  return siguiente.barcoFuente === 'referencia' ? { barcoUsd: '', barcoFuente: '', barcoReferenciaClave: '' } : {};
}

function importesPorAnio(siguiente: Campos, gastosPredeterminadoHnl: string): Partial<Campos> {
  const anio = anioDesdeTexto(siguiente.anio);
  if (anio === null || siguiente.modoImpuestos === 'combinado') return {};
  const actuales = { impuestoHnl: siguiente.impuestoHnl, gastosLocalesHnl: siguiente.gastosLocalesHnl };
  if (!importesSonAutomaticos(actuales, gastosPredeterminadoHnl)) return {};
  return { modoImpuestos: 'desglose', ...importesPredeterminados(anio, gastosPredeterminadoHnl) };
}

function FormularioCotizacion({ carga, onRecargar }: { carga: CargaEditor; onRecargar: () => void }) {
  const { vehiculo, cotizacion, referencias } = carga;
  const vehiculoId = vehiculo.id;
  const cotizacionId = cotizacion.id;
  const versionesFees = referencias.versionesFees;

  const [controlador] = useState(() => new ControladorVin((url) => fetch(url)));
  const [consultaVin, setConsultaVin] = useState<ConsultaVin | null>(null);
  const [campos, setCampos] = useState<Campos>(() => aFormulario(vehiculo, cotizacion));
  const [estado, setEstado] = useState<EstadoGuardado>('guardado');
  const [invalidos, setInvalidos] = useState<CampoInvalido[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const camposRef = useRef(campos);
  const versiones = useRef({ vehiculo: vehiculo.row_version, cotizacion: cotizacion.row_version });
  const enConflicto = useRef(false);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gastosPredeterminadoHnl = referencias.gastosLocalesPredeterminadoHnl;
  const [duplicados, setDuplicados] = useState<CotizacionVin[]>([]);
  const [errorDuplicados, setErrorDuplicados] = useState(false);
  const [creandoNueva, setCreandoNueva] = useState(false);
  const [errorNueva, setErrorNueva] = useState<string | null>(null);
  const secuenciaDuplicados = useRef(0);
  const temporizadorDuplicados = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ejecutar = useCallback(async () => {
    if (enConflicto.current) return;
    const instantanea = camposRef.current;
    const parches = construirParches(instantanea);
    Object.assign(parches.cotizacion, snapshotFees(instantanea, resolverFees(instantanea, versionesFees)));
    setInvalidos(parches.invalidos);
    setEstado('guardando');

    const resVehiculo = await supabase
      .from('vehicles')
      .update(parches.vehiculo)
      .eq('id', vehiculoId)
      .eq('row_version', versiones.current.vehiculo)
      .select('row_version')
      .maybeSingle();
    if (resVehiculo.error) {
      setEstado('fallo');
      return;
    }
    if (!resVehiculo.data) {
      enConflicto.current = true;
      setEstado('conflicto');
      return;
    }
    versiones.current.vehiculo = resVehiculo.data.row_version as number;

    const resCotizacion = await supabase
      .from('quotes')
      .update(parches.cotizacion)
      .eq('id', cotizacionId)
      .eq('row_version', versiones.current.cotizacion)
      .select('row_version')
      .maybeSingle();
    if (resCotizacion.error) {
      setEstado('fallo');
      return;
    }
    if (!resCotizacion.data) {
      enConflicto.current = true;
      setEstado('conflicto');
      return;
    }
    versiones.current.cotizacion = resCotizacion.data.row_version as number;

    setEstado(camposRef.current === instantanea ? 'guardado' : 'pendiente');
  }, [vehiculoId, cotizacionId, versionesFees]);

  const guardarAhora = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    cola.current = cola.current.then(ejecutar).catch(() => {
      setEstado('fallo');
    });
  }, [ejecutar]);

  const cambiar = useCallback(
    (parcial: Partial<Campos>) => {
      const anterior = camposRef.current;
      const combinado: Campos = { ...anterior, ...parcial };
      const siguiente: Campos = {
        ...combinado,
        ...(anterior.anio !== combinado.anio ? importesPorAnio(combinado, gastosPredeterminadoHnl) : {}),
      };
      camposRef.current = siguiente;
      setAvisos(avisosCambioParametros(aEntradas(anterior), aEntradas(siguiente)));
      setCampos(siguiente);
      if (!enConflicto.current) setEstado('pendiente');
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = null;
        guardarAhora();
      }, RETARDO_AUTOGUARDADO_MS);
    },
    [guardarAhora, gastosPredeterminadoHnl],
  );

  const consultarVin = useCallback(
    (texto: string) => {
      const vin = normalizarVin(texto);
      if (estadoVin(vin) !== 'completo') {
        setConsultaVin(null);
        return;
      }
      setConsultaVin({ vin, estado: 'consultando' });
      void controlador.consultar(vin).then((resultado) => {
        if (resultado.estado === 'descartado') return;
        if (normalizarVin(camposRef.current.vin) !== resultado.vin) return;
        if (resultado.estado !== 'datos') {
          setConsultaVin({ vin, estado: resultado.estado === 'sin_datos' ? 'sin_datos' : 'error' });
          return;
        }
        const actual = camposRef.current;
        const parcial: Partial<Campos> = {};
        if (actual.marca.trim() === '' && resultado.datos.marca !== null) parcial.marca = resultado.datos.marca;
        if (actual.modelo.trim() === '' && resultado.datos.modelo !== null) parcial.modelo = resultado.datos.modelo;
        if (actual.anio.trim() === '' && resultado.datos.anio !== null) parcial.anio = String(resultado.datos.anio);
        if (Object.keys(parcial).length > 0) cambiar(parcial);
        setConsultaVin({ vin, estado: 'aplicado' });
      });
    },
    [controlador, cambiar],
  );

  const consultarDuplicados = useCallback(
    (texto: string) => {
      if (temporizadorDuplicados.current) clearTimeout(temporizadorDuplicados.current);
      const secuencia = ++secuenciaDuplicados.current;
      temporizadorDuplicados.current = setTimeout(() => {
        temporizadorDuplicados.current = null;
        const vin = normalizarVin(texto);
        if (estadoVin(vin) !== 'completo') {
          setDuplicados([]);
          setErrorDuplicados(false);
          return;
        }
        void supabase
          .from('quotes')
          .select('id, estado, referencia, updated_at, fecha_subasta, vendido_en_subasta, vehicles!inner(vin)')
          .eq('vehicles.vin', vin)
          .neq('id', cotizacionId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(5)
          .then(({ data, error: fallo }) => {
            if (secuencia !== secuenciaDuplicados.current) return;
            if (normalizarVin(camposRef.current.vin) !== vin) return;
            if (fallo) {
              setDuplicados([]);
              setErrorDuplicados(true);
              return;
            }
            const filas = (data as unknown as FilaDuplicadoBd[]).map((fila) => ({
              id: fila.id,
              estado: fila.estado,
              referencia: fila.referencia,
              updated_at: fila.updated_at,
              fecha_subasta: fila.fecha_subasta,
              vendido_en_subasta: fila.vendido_en_subasta,
              vin: fila.vehicles?.vin ?? null,
            }));
            setErrorDuplicados(false);
            setDuplicados(buscarDuplicadosVin(filas, vin, cotizacionId));
          });
      }, RETARDO_DUPLICADOS_MS);
    },
    [cotizacionId],
  );

  const crearNuevaDesdeVin = async () => {
    const vin = normalizarVin(camposRef.current.vin);
    setCreandoNueva(true);
    setErrorNueva(null);
    const resultado = await crearCotizacion(estadoVin(vin) === 'completo' ? vin : null);
    setCreandoNueva(false);
    if ('error' in resultado) {
      setErrorNueva(resultado.error);
      return;
    }
    irA(`#/vehiculos/${resultado.id}`);
  };

  useEffect(() => {
    consultarDuplicados(camposRef.current.vin);
    return () => {
      secuenciaDuplicados.current += 1;
      if (temporizadorDuplicados.current) clearTimeout(temporizadorDuplicados.current);
    };
  }, [consultarDuplicados]);

  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
        evento.preventDefault();
        guardarAhora();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('keydown', alTeclear);
    };
  }, [guardarAhora]);

  useEffect(() => {
    return () => {
      if (temporizador.current) guardarAhora();
    };
  }, [guardarAhora]);

  const resolucionFees: ResolucionFees = resolverFees(campos, versionesFees);
  const feeTabla = resolucionFees.resultado.ok ? resolucionFees.resultado.total.toString() : null;
  const resultado = calcularCotizacion(aEntradas(campos, feeTabla));

  const referenciaBarco = buscarBarcoReferencia(
    campos.tipoVehiculo || null,
    campos.zonaSalida || null,
    referencias.mapeos,
    referencias.tarifas,
  );
  const montoBarcoReferencia = referenciaBarco ? valorDecimal(referenciaBarco.monto) : null;

  const coincidenciasGrua: CoincidenciaGrua[] =
    campos.ubicacion.trim() === ''
      ? []
      : buscarGruas(referencias.gruas, campos.ubicacion, campos.zonaSalida || null, campos.subasta || null);
  const resolucionGrua = resolverGrua(coincidenciasGrua);
  const tarifaGruaUnica = resolucionGrua.estado === 'unica' ? resolucionGrua.coincidencias[0] : undefined;

  const pujaDecimal = valorDecimal(campos.pujaUsd);
  const feeEfectivoTexto = resultado.feesUsd === null ? '' : resultado.feesUsd.toFixed(2);
  const carroMasFeesTexto =
    pujaDecimal === null || resultado.feesUsd === null ? '' : pujaDecimal.plus(resultado.feesUsd).toFixed(2);
  const titulo =
    [campos.marca, campos.modelo, campos.anio].map((valor) => valor.trim()).filter(Boolean).join(' ') ||
    'Vehículo sin datos';

  const usarTarifaGrua = (coincidencia: CoincidenciaGrua, fuente: 'referencia' | 'manual') => {
    if (coincidencia.montoUsd === null) return;
    cambiar({ gruaUsd: coincidencia.montoUsd, gruaFuente: fuente, gruaReferenciaClave: coincidencia.id });
  };

  const cambiarCampos = (entrada: Partial<Campos>) => {
    const parcial = conZonaSugerida(entrada, camposRef.current, referencias.gruas);
    const siguiente: Campos = { ...camposRef.current, ...parcial };
    const automaticos: Partial<Campos> = {};
    if ('ubicacion' in parcial || 'zonaSalida' in parcial) {
      Object.assign(automaticos, tarifaGruaAutomatica(siguiente, referencias.gruas));
    }
    if ('tipoVehiculo' in parcial || 'zonaSalida' in parcial) {
      Object.assign(automaticos, tarifaBarcoAutomatica(siguiente, referencias));
    }
    cambiar({ ...parcial, ...automaticos });
  };

  const cambiarPerfil = (clave: string) => {
    const manual = camposRef.current.modoFees === 'total_fees';
    cambiar(manual ? { perfilFeesClave: clave } : { perfilFeesClave: clave, modoFees: 'tabla', feesUsd: '' });
  };

  const cambiarSubasta = (subasta: string) => {
    cambiar({ subasta });
    if (subasta === 'IAA' && camposRef.current.perfilFeesClave === '') cambiarPerfil('iaa_standard_volume');
  };

  return (
    <form className="editor" onSubmit={(evento) => { evento.preventDefault(); }}>
      <div className="encabezado-seccion">
        <div>
          <button type="button" className="enlace" onClick={() => { irA('#/vehiculos'); }}>
            ← Vehículos
          </button>
          <h1>{titulo}</h1>
        </div>
        <div className="estado-guardado" role="status" aria-live="polite">
          <span className={`estado estado-${estado}`}>{ETIQUETA_GUARDADO[estado]}</span>
          <button type="button" onClick={() => { guardarAhora(); }}>
            Guardar ahora
          </button>
        </div>
      </div>

      {estado === 'conflicto' && (
        <div role="alert" className="aviso-conflicto">
          <p>Otra sesión o pestaña guardó una versión más reciente. Nada se sobrescribió.</p>
          <p>Al recargar se descartan los cambios de esta pantalla que no se guardaron.</p>
          <button type="button" onClick={onRecargar}>
            Recargar versión guardada
          </button>
        </div>
      )}

      <div className="dos-columnas">
        <div className="formulario">
          <fieldset>
            <legend>Vehículo</legend>
            <div className="rejilla">
              <label>
                VIN <small>(opcional)</small>
                <input
                  value={campos.vin}
                  maxLength={17}
                  aria-invalid={invalidos.includes('vin')}
                  onChange={(e) => {
                    cambiar({ vin: e.target.value });
                    consultarVin(e.target.value);
                    consultarDuplicados(e.target.value);
                  }}
                />
              </label>
              <div className="ancho-2 referencia">
                {consultaVin && <small role="status">{ETIQUETA_VIN[consultaVin.estado]}</small>}
                {errorDuplicados && <small role="status">No se pudo comprobar si el VIN ya está guardado.</small>}
              </div>
              {duplicados[0] && (
                <div className="ancho-2 aviso-duplicado" role="status">
                  <p>Este VIN ya aparece en cotizaciones guardadas. Puede abrir una existente o crear una nueva.</p>
                  <ul>
                    {duplicados.map((duplicado) => (
                      <li key={duplicado.id}>
                        <a href={`#/vehiculos/${duplicado.id}`}>{duplicado.referencia?.trim() || 'Sin referencia'}</a>{' '}
                        <small>
                          ({ETIQUETA_ESTADO_COTIZACION[duplicado.estado] ?? duplicado.estado}; subasta{' '}
                          {duplicado.fecha_subasta ? formatearFechaCorta(duplicado.fecha_subasta) : 'sin fecha'};{' '}
                          {duplicado.vendido_en_subasta ? 'vendido en subasta' : 'no vendido'})
                        </small>
                      </li>
                    ))}
                  </ul>
                  <div className="acciones">
                    <button
                      type="button"
                      onClick={() => {
                        irA(`#/vehiculos/${duplicados[0]?.id ?? ''}`);
                      }}
                    >
                      Abrir cotización existente
                    </button>
                    <button
                      type="button"
                      className="secundario"
                      disabled={creandoNueva}
                      onClick={() => {
                        void crearNuevaDesdeVin();
                      }}
                    >
                      {creandoNueva ? 'Creando…' : 'Crear nueva cotización'}
                    </button>
                  </div>
                  {errorNueva && (
                    <p role="alert" className="error">
                      {errorNueva}
                    </p>
                  )}
                </div>
              )}
              <label>
                Marca
                <input value={campos.marca} onChange={(e) => { cambiar({ marca: e.target.value }); }} />
              </label>
              <label>
                Modelo
                <input value={campos.modelo} onChange={(e) => { cambiar({ modelo: e.target.value }); }} />
              </label>
              <label>
                Versión
                <input value={campos.version} onChange={(e) => { cambiar({ version: e.target.value }); }} />
              </label>
              <label>
                Año
                <input
                  value={campos.anio}
                  inputMode="numeric"
                  aria-invalid={invalidos.includes('anio')}
                  onChange={(e) => { cambiar({ anio: e.target.value }); }}
                />
              </label>
              <label>
                Tipo
                <select value={campos.tipoVehiculo} onChange={(e) => { cambiarCampos({ tipoVehiculo: e.target.value }); }}>
                  <option value="">Pendiente</option>
                  <option value="sedan">Sedán</option>
                  <option value="suv">SUV / camioneta</option>
                  <option value="pickup">Pickup</option>
                  <option value="minivan">Van / minivan</option>
                  <option value="motorcycle">Motocicleta</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="ancho-2">
                Referencia
                <input value={campos.referencia} onChange={(e) => { cambiar({ referencia: e.target.value }); }} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Subasta y perfil</legend>
            <div className="rejilla">
              <label>
                Subasta
                <select value={campos.subasta} onChange={(e) => { cambiarSubasta(e.target.value); }}>
                  <option value="">Pendiente</option>
                  <option value="IAA">IAA</option>
                  <option value="COPART">Copart</option>
                  <option value="OTRA">Otra</option>
                </select>
              </label>
              <label>
                Sede o ubicación
                <input
                  value={campos.ubicacion}
                  placeholder="Ej.: Nashville (TN)"
                  onChange={(e) => { cambiarCampos({ ubicacion: e.target.value }); }}
                />
              </label>
              <label>
                Puerto de salida (zona)
                <select value={campos.zonaSalida} onChange={(e) => { cambiarCampos({ zonaSalida: e.target.value }); }}>
                  <option value="">Pendiente</option>
                  <option value="DELAWARE">Delaware</option>
                  <option value="FLORIDA">Florida</option>
                  <option value="TEXAS">Texas</option>
                  <option value="CALIFORNIA">California</option>
                </select>
              </label>
              <label className="ancho-2">
                Perfil de fees
                <select value={campos.perfilFeesClave} onChange={(e) => { cambiarPerfil(e.target.value); }}>
                  <option value="">Sin perfil</option>
                  {referencias.perfiles.map((perfil) => (
                    <option key={perfil.clave} value={perfil.clave}>
                      {perfil.tablaCargada ? perfil.etiqueta : `${perfil.etiqueta} (sin tabla cargada)`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Montos en USD</legend>
            <div className="rejilla">
              <label>
                Puja
                <input
                  value={campos.pujaUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('pujaUsd')}
                  onChange={(e) => { cambiar({ pujaUsd: e.target.value }); }}
                />
              </label>
              <label>
                Fees
                <input
                  value={campos.modoFees === 'total_fees' ? campos.feesUsd : feeEfectivoTexto}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('feesUsd')}
                  onChange={(e) => { cambiar({ feesUsd: e.target.value, modoFees: 'total_fees' }); }}
                />
              </label>
              <label>
                Carro + fees
                <input value={carroMasFeesTexto} readOnly />
              </label>
              <div className="ancho-2 referencia" aria-live="polite">
                {campos.modoFees === 'total_fees' ? (
                  <>
                    <small>Fees manuales.</small>
                    <button
                      type="button"
                      onClick={() => {
                        cambiar({ modoFees: 'tabla', feesUsd: '' });
                      }}
                    >
                      Volver a automático
                    </button>
                  </>
                ) : (
                  !resolucionFees.resultado.ok &&
                  campos.perfilFeesClave !== '' && (
                    <span className="pendiente">{MOTIVO_FEES[resolucionFees.resultado.motivo]}</span>
                  )
                )}
              </div>
              <label>
                Grúa
                <input
                  value={campos.gruaUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('gruaUsd')}
                  onChange={(e) => { cambiar({ gruaUsd: e.target.value, gruaFuente: 'manual' }); }}
                />
              </label>
              <div className="ancho-2 referencia" aria-live="polite">
                {tarifaGruaUnica && tarifaGruaUnica.montoUsd !== null && (
                  <>
                    <span>
                      Tarifa de grúa: {formatearMonto(valorDecimal(tarifaGruaUnica.montoUsd))} USD ({tarifaGruaUnica.ubicacion})
                    </span>
                    {campos.gruaFuente !== 'referencia' && (
                      <button type="button" onClick={() => { usarTarifaGrua(tarifaGruaUnica, 'referencia'); }}>
                        Volver a tarifa
                      </button>
                    )}
                  </>
                )}
                {resolucionGrua.estado === 'pendiente' && (
                  <>
                    <span className="pendiente">Hay una tarifa para esta sede que no está verificada. Confírmela si corresponde.</span>
                    {resolucionGrua.coincidencias
                      .filter((c) => c.montoUsd !== null)
                      .slice(0, 8)
                      .map((c) => (
                        <button key={c.id} type="button" onClick={() => { usarTarifaGrua(c, 'manual'); }}>
                          Usar {c.ubicacion}: {formatearMonto(valorDecimal(c.montoUsd))} USD
                        </button>
                      ))}
                  </>
                )}
                {resolucionGrua.estado === 'ambigua' && (
                  <>
                    <span>Hay tarifas distintas para esta ubicación. Elija una o capture el importe.</span>
                    {resolucionGrua.coincidencias
                      .filter((c) => c.montoUsd !== null)
                      .slice(0, 8)
                      .map((c) => (
                        <button key={c.id} type="button" onClick={() => { usarTarifaGrua(c, 'manual'); }}>
                          {c.ubicacion}: {formatearMonto(valorDecimal(c.montoUsd))} USD
                        </button>
                      ))}
                  </>
                )}
                {resolucionGrua.estado === 'sin_importe' && (
                  <span className="pendiente">Hay coincidencias sin importe en la tarifa. Capture el importe manual.</span>
                )}
                {resolucionGrua.estado === 'sin_coincidencia' && campos.ubicacion.trim() !== '' && (
                  <span className="pendiente">Grúa no encontrada para esta sede y zona. Capture el importe manual.</span>
                )}
                <small>Procedencia de la grúa: {procedenciaMonto(campos.gruaFuente, campos.gruaUsd)}</small>
              </div>
              <label>
                Barco
                <input
                  value={campos.barcoUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('barcoUsd')}
                  onChange={(e) => { cambiar({ barcoUsd: e.target.value, barcoFuente: 'manual' }); }}
                />
              </label>
              <div className="ancho-2 referencia">
                {montoBarcoReferencia && referenciaBarco ? (
                  <>
                    <span>Referencia de barco: {formatearMonto(montoBarcoReferencia)} USD</span>
                    {campos.barcoFuente === 'manual' && (
                      <button
                        type="button"
                        onClick={() => {
                          cambiar({
                            barcoUsd: montoBarcoReferencia.toString(),
                            barcoFuente: 'referencia',
                            barcoReferenciaClave: referenciaBarco.clave,
                          });
                        }}
                      >
                        Volver a tarifa
                      </button>
                    )}
                  </>
                ) : (
                  <span className="pendiente">Barco no encontrado para este tipo y zona. Capture el importe manual.</span>
                )}
                <small>Procedencia del barco: {procedenciaMonto(campos.barcoFuente, campos.barcoUsd)}</small>
              </div>
              <label>
                Papelería
                <input
                  value={campos.papeleriaUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('papeleriaUsd')}
                  onChange={(e) => { cambiar({ papeleriaUsd: e.target.value }); }}
                />
              </label>
              <label>
                Tipo de cambio (HNL por USD)
                <input
                  value={campos.tipoCambioHnlPorUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('tipoCambioHnlPorUsd')}
                  onChange={(e) => { cambiar({ tipoCambioHnlPorUsd: e.target.value }); }}
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Impuestos y gastos locales (HNL)</legend>
            <div className="rejilla">
              <label>
                Modo
                <select
                  value={campos.modoImpuestos}
                  onChange={(e) => {
                    cambiar({
                      modoImpuestos:
                        e.target.value === 'combinado' || e.target.value === 'desglose' ? e.target.value : 'pendiente',
                    });
                  }}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="combinado">Total combinado</option>
                  <option value="desglose">Desglose</option>
                </select>
              </label>
              {campos.modoImpuestos === 'combinado' && (
                <label className="ancho-2">
                  Total combinado de salida
                  <input
                    value={campos.totalCombinadoHnl}
                    inputMode="decimal"
                    aria-invalid={invalidos.includes('totalCombinadoHnl')}
                    onChange={(e) => { cambiar({ totalCombinadoHnl: e.target.value }); }}
                  />
                </label>
              )}
              {campos.modoImpuestos === 'desglose' && (
                <>
                  <label>
                    Impuesto
                    <input
                      value={campos.impuestoHnl}
                      inputMode="decimal"
                      aria-invalid={invalidos.includes('impuestoHnl')}
                      onChange={(e) => { cambiar({ impuestoHnl: e.target.value }); }}
                    />
                  </label>
                  <label>
                    Gastos locales
                    <input
                      value={campos.gastosLocalesHnl}
                      inputMode="decimal"
                      aria-invalid={invalidos.includes('gastosLocalesHnl')}
                      onChange={(e) => { cambiar({ gastosLocalesHnl: e.target.value }); }}
                    />
                  </label>
                </>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Reparación, venta y subasta (opcional)</legend>
            <div className="rejilla">
              <label>
                Reparación
                <input
                  value={campos.reparacionHnl}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('reparacionHnl')}
                  onChange={(e) => { cambiar({ reparacionHnl: e.target.value }); }}
                />
              </label>
              <label>
                Precio de venta
                <input
                  value={campos.precioVentaHnl}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('precioVentaHnl')}
                  onChange={(e) => { cambiar({ precioVentaHnl: e.target.value }); }}
                />
              </label>
              <label>
                Fecha de subasta
                <input
                  type="date"
                  value={campos.fechaSubasta}
                  aria-invalid={invalidos.includes('fechaSubasta')}
                  onChange={(e) => { cambiar({ fechaSubasta: e.target.value }); }}
                />
              </label>
              <label className="casilla">
                <input
                  type="checkbox"
                  checked={campos.vendidoEnSubasta}
                  onChange={(e) => { cambiar({ vendidoEnSubasta: e.target.checked }); }}
                />
                Vendido en esta subasta
              </label>
              <label>
                Vendedor
                <input value={campos.vendedor} onChange={(e) => { cambiar({ vendedor: e.target.value }); }} />
              </label>
              <label>
                Verificación Bid.cars
                <input
                  value={campos.verificacionBidcars}
                  onChange={(e) => { cambiar({ verificacionBidcars: e.target.value }); }}
                />
              </label>
              <label className="ancho-2">
                Notas
                <textarea value={campos.notas} rows={2} onChange={(e) => { cambiar({ notas: e.target.value }); }} />
              </label>
            </div>
          </fieldset>
        </div>

        <aside className="resumen" aria-label="Resumen de la cotización">
          <h2>Resumen</h2>
          <dl>
            <dt>Partidas conocidas (USD)</dt>
            <dd>{formatearMonto(resultado.subtotalUsd)}</dd>
            <dt>Efectivo (USD)</dt>
            <dd>{formatearMonto(resultado.cashUsd)}</dd>
            <dt>Impuestos y locales (HNL)</dt>
            <dd>{formatearMonto(resultado.impuestosHnl)}</dd>
            <dt>Importado (HNL)</dt>
            <dd>{formatearMonto(resultado.importadoHnl)}</dd>
            <dt>Importado (USD equivalente)</dt>
            <dd>{formatearMonto(resultado.importadoUsdEquivalente)}</dd>
            <dt>Inversión con reparación (HNL)</dt>
            <dd>{formatearMonto(resultado.inversionHnl)}</dd>
            <dt>
              {resultado.utilidadTipo === 'parcial' ? 'Utilidad con costos capturados (HNL)' : 'Utilidad estimada (HNL)'}
            </dt>
            <dd>
              {resultado.utilidadTipo === 'sin_precio' || resultado.utilidadTipo === 'pendiente'
                ? 'Pendiente'
                : formatearMonto(resultado.utilidadHnl)}
            </dd>
          </dl>

          {resultado.pendientes.length > 0 && (
            <div className="pendientes">
              <h3>Pendiente de datos</h3>
              <ul>
                {resultado.pendientes.map((pendiente) => (
                  <li key={pendiente}>{ETIQUETA_PENDIENTE[pendiente]}</li>
                ))}
              </ul>
              <p className="nota">Los pendientes no son cero; el resumen muestra solo lo conocido.</p>
            </div>
          )}

          {invalidos.length > 0 && (
            <p role="alert" className="error">
              {invalidos.length} campo(s) con formato no válido. Se conservó el último valor guardado.
            </p>
          )}

          {[...resultado.avisos, ...avisos].map((aviso, indice) => (
            <p key={indice} className="nota">
              {aviso}
            </p>
          ))}
        </aside>
      </div>
    </form>
  );
}
