import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  aEntradas,
  aFormulario,
  construirParches,
  type Campos,
  type CampoInvalido,
  type CotizacionFila,
  type VehiculoFila,
} from '../lib/formulario';
import {
  avisosCambioParametros,
  calcularCotizacion,
  formatearMonto,
  valorDecimal,
  type Pendiente,
} from '../motor/calculo';
import { buscarBarcoReferencia, type MapeoTipoVehiculo, type TarifaEmbarque } from '../motor/referencias';
import { irA } from '../lib/ruta';

type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'fallo' | 'conflicto';

type Referencias = {
  perfiles: { clave: string; etiqueta: string }[];
  mapeos: MapeoTipoVehiculo[];
  tarifas: TarifaEmbarque[];
  pagoUnicoHnl: string | null;
};

type CargaEditor = { vehiculo: VehiculoFila; cotizacion: CotizacionFila; referencias: Referencias };

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

type FilaMapeo = { tipo_codigo: string; zona_salida: string; categoria_origen: string | null };
type FilaTarifa = { clave: string; zona_salida: string; categoria: string; monto: number | string };

function aTextoONulo(valor: unknown): string | null {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : null;
}

async function cargarEditor(id: string): Promise<CargaEditor | 'no_encontrada' | 'error'> {
  const resCotizacion = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
  if (resCotizacion.error) return 'error';
  const cotizacion = resCotizacion.data as CotizacionFila | null;
  if (!cotizacion) return 'no_encontrada';

  const resVehiculo = await supabase.from('vehicles').select('*').eq('id', cotizacion.vehicle_id).single();
  if (resVehiculo.error) return 'error';
  const vehiculo = resVehiculo.data as VehiculoFila;

  const [perfiles, mapeos, tarifas, ajustes] = await Promise.all([
    supabase.from('fee_profiles').select('clave, etiqueta').order('etiqueta'),
    supabase.from('vehicle_type_mappings').select('tipo_codigo, zona_salida, categoria_origen'),
    supabase.from('shipping_rates').select('clave, zona_salida, categoria, monto').eq('moneda', 'USD'),
    supabase.from('user_settings').select('pago_unico_hnl').maybeSingle(),
  ]);
  if (perfiles.error || mapeos.error || tarifas.error || ajustes.error) return 'error';

  return {
    vehiculo,
    cotizacion,
    referencias: {
      perfiles: perfiles.data,
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
      pagoUnicoHnl: aTextoONulo(ajustes.data?.pago_unico_hnl),
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

function FormularioCotizacion({ carga, onRecargar }: { carga: CargaEditor; onRecargar: () => void }) {
  const { vehiculo, cotizacion, referencias } = carga;
  const vehiculoId = vehiculo.id;
  const cotizacionId = cotizacion.id;

  const [campos, setCampos] = useState<Campos>(() => aFormulario(vehiculo, cotizacion));
  const [estado, setEstado] = useState<EstadoGuardado>('guardado');
  const [invalidos, setInvalidos] = useState<CampoInvalido[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const camposRef = useRef(campos);
  const versiones = useRef({ vehiculo: vehiculo.row_version, cotizacion: cotizacion.row_version });
  const enConflicto = useRef(false);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ejecutar = useCallback(async () => {
    if (enConflicto.current) return;
    const instantanea = camposRef.current;
    const parches = construirParches(instantanea);
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
  }, [vehiculoId, cotizacionId]);

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
      const siguiente: Campos = { ...anterior, ...parcial };
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
    [guardarAhora],
  );

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

  const resultado = calcularCotizacion(aEntradas(campos));
  const referenciaBarco = buscarBarcoReferencia(
    campos.tipoVehiculo || null,
    campos.zonaSalida || null,
    referencias.mapeos,
    referencias.tarifas,
  );
  const montoBarcoReferencia = referenciaBarco ? valorDecimal(referenciaBarco.monto) : null;
  const pagoUnico = referencias.pagoUnicoHnl;
  const titulo = [vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ') || 'Vehículo sin datos';

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
                  onChange={(e) => { cambiar({ vin: e.target.value }); }}
                />
              </label>
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
                <select value={campos.tipoVehiculo} onChange={(e) => { cambiar({ tipoVehiculo: e.target.value }); }}>
                  <option value="">Pendiente</option>
                  <option value="sedan">Sedán</option>
                  <option value="suv">SUV / camioneta</option>
                  <option value="pickup">Pickup</option>
                  <option value="minivan">Minivan</option>
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
                <select value={campos.subasta} onChange={(e) => { cambiar({ subasta: e.target.value }); }}>
                  <option value="">Pendiente</option>
                  <option value="IAA">IAA</option>
                  <option value="COPART">Copart</option>
                  <option value="OTRA">Otra</option>
                </select>
              </label>
              <label>
                Ubicación
                <input value={campos.ubicacion} onChange={(e) => { cambiar({ ubicacion: e.target.value }); }} />
              </label>
              <label>
                Zona de salida
                <select value={campos.zonaSalida} onChange={(e) => { cambiar({ zonaSalida: e.target.value }); }}>
                  <option value="">Pendiente</option>
                  <option value="DELAWARE">Delaware</option>
                  <option value="FLORIDA">Florida</option>
                  <option value="TEXAS">Texas</option>
                  <option value="CALIFORNIA">California</option>
                </select>
              </label>
              <label className="ancho-2">
                Perfil de fees
                <select
                  value={campos.perfilFeesClave}
                  onChange={(e) => { cambiar({ perfilFeesClave: e.target.value }); }}
                >
                  <option value="">Sin perfil</option>
                  {referencias.perfiles.map((perfil) => (
                    <option key={perfil.clave} value={perfil.clave}>
                      {perfil.etiqueta}
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
                Modo de fees
                <select
                  value={campos.modoFees}
                  onChange={(e) => { cambiar({ modoFees: e.target.value === 'carro_mas_fees' ? 'carro_mas_fees' : 'total_fees' }); }}
                >
                  <option value="total_fees">Fees manuales</option>
                  <option value="carro_mas_fees">Carro + fees</option>
                </select>
              </label>
              <label>
                Fees
                <input
                  value={campos.feesUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('feesUsd')}
                  onChange={(e) => { cambiar({ feesUsd: e.target.value }); }}
                />
              </label>
              <label>
                Carro + fees
                <input
                  value={campos.carroMasFeesUsd}
                  inputMode="decimal"
                  disabled={campos.modoFees !== 'carro_mas_fees'}
                  aria-invalid={invalidos.includes('carroMasFeesUsd')}
                  onChange={(e) => { cambiar({ carroMasFeesUsd: e.target.value }); }}
                />
              </label>
              <label>
                Grúa
                <input
                  value={campos.gruaUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('gruaUsd')}
                  onChange={(e) => { cambiar({ gruaUsd: e.target.value }); }}
                />
              </label>
              <label>
                Barco
                <input
                  value={campos.barcoUsd}
                  inputMode="decimal"
                  aria-invalid={invalidos.includes('barcoUsd')}
                  onChange={(e) => { cambiar({ barcoUsd: e.target.value }); }}
                />
              </label>
              <div className="ancho-2 referencia">
                {montoBarcoReferencia ? (
                  <>
                    <span>Referencia de barco: {formatearMonto(montoBarcoReferencia)} USD</span>
                    <button
                      type="button"
                      onClick={() => { cambiar({ barcoUsd: montoBarcoReferencia.toString() }); }}
                    >
                      Usar referencia
                    </button>
                  </>
                ) : (
                  <span className="pendiente">Sin referencia de barco para este tipo y zona</span>
                )}
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
                  {pagoUnico && (
                    <div className="ancho-2 referencia">
                      <button type="button" onClick={() => { cambiar({ impuestoHnl: pagoUnico }); }}>
                        Usar pago único (L {formatearMonto(valorDecimal(pagoUnico))})
                      </button>
                      <small>Solo se aplica al pulsar; no depende del modelo ni del año.</small>
                    </div>
                  )}
                </>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Reparación y venta (HNL)</legend>
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
