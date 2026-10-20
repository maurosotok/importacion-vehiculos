import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { supabase } from '../lib/supabase';
import { aEntradas, aFormulario, type CotizacionFila, type Numero, type VehiculoFila } from '../lib/formulario';
import { formatearMonto, valorDecimal } from '../motor/calculo';
import {
  CONCEPTOS_GASTO,
  montoHnl,
  resumirCompra,
  type ConceptoGasto,
  type GastoCompra,
  type MonedaGasto,
  type ResumenCompra,
  type TipoUtilidad,
} from '../motor/compra';
import { crearRevision, type RevisionCongelada } from '../motor/revision';
import { aCsv } from '../motor/csv';
import type { Decimal } from 'decimal.js';

const MOTOR_VERSION = 'calculo-1';

const CONCEPTO_ETIQUETA: Record<ConceptoGasto, string> = {
  grua: 'Grúa',
  barco: 'Barco',
  papeleria: 'Papelería',
  carro: 'Carro',
  buyer_fee: 'Buyer fee',
  bac_fees: 'BAC / BP fees',
  paypal_fee: 'PayPal',
  bank_receiver_fee: 'Receptor bancario',
  impuestos_salida: 'Impuestos / salida',
  repuesto: 'Repuesto',
  servicio: 'Servicio',
  gasolina_aceite: 'Gasolina y aceite',
  mano_obra: 'Mano de obra',
  pintura: 'Pintura',
  otro: 'Otro',
};

const ESTADO_ETIQUETA: Record<string, string> = {
  comprado: 'Comprado',
  recibido: 'Recibido',
  vendido: 'Vendido',
  cancelado: 'Cancelado',
};

const UTILIDAD_ETIQUETA: Record<TipoUtilidad, string> = {
  sin_venta: 'Sin precio de venta',
  parcial: 'Parcial: hay gastos pendientes o estimados',
  final: 'Final',
};

type CompraDb = {
  id: string;
  revision_id: string;
  estado: string;
  fecha_compra: string | null;
  fecha_recepcion: string | null;
  precio_venta_hnl: Numero;
  fecha_venta: string | null;
  notas: string | null;
  presupuesto_reparacion_hnl: Numero;
  contingencia_hnl: Numero;
  redondear_presupuesto_5000: boolean;
  tipo_cambio_origen_hnl_por_usd: Numero;
};

type GastoDb = {
  id: string;
  concepto: ConceptoGasto;
  descripcion: string | null;
  lugar: string | null;
  monto: Numero;
  moneda: MonedaGasto;
  tipo_cambio_hnl_por_usd: Numero;
  fecha_compra: string | null;
  fecha_pago: string | null;
  estimado: boolean;
  monto_total_referencia: Numero;
  motivo_reparto: string | null;
  notas: string | null;
};

type SinCompra = { cotizacion: CotizacionFila; vehiculo: VehiculoFila; compra: null };

type CompraCompleta = {
  cotizacion: CotizacionFila;
  vehiculo: VehiculoFila;
  compra: CompraDb;
  revision: RevisionCongelada;
  gastos: GastoDb[];
};

type Datos = SinCompra | CompraCompleta;

type CargaCompra = Datos | 'no_encontrada' | 'error';

async function cargar(id: string): Promise<CargaCompra> {
  const resCotizacion = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
  if (resCotizacion.error) return 'error';
  const cotizacion = resCotizacion.data as CotizacionFila | null;
  if (!cotizacion) return 'no_encontrada';

  const [resVehiculo, resCompra] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', cotizacion.vehicle_id).single(),
    supabase.from('purchases').select('*').eq('quote_id', id).maybeSingle(),
  ]);
  if (resVehiculo.error || resCompra.error) return 'error';
  const vehiculo = resVehiculo.data as VehiculoFila;
  const compra = resCompra.data as CompraDb | null;
  if (!compra) return { cotizacion, vehiculo, compra: null };

  const [resRevision, resGastos] = await Promise.all([
    supabase.from('quote_revisions').select('snapshot').eq('id', compra.revision_id).single(),
    supabase.from('purchase_expenses').select('*').eq('purchase_id', compra.id).order('created_at'),
  ]);
  if (resRevision.error || resGastos.error) return 'error';
  const revision = resRevision.data.snapshot as RevisionCongelada;
  return { cotizacion, vehiculo, compra, revision, gastos: resGastos.data as GastoDb[] };
}

function textoNumero(valor: Numero | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

function numeroOpcional(texto: string): { ok: true; valor: string | null } | { ok: false } {
  const limpio = texto.trim();
  if (limpio === '') return { ok: true, valor: null };
  const decimal = valorDecimal(limpio);
  if (decimal === null || decimal.lt(0)) return { ok: false };
  return { ok: true, valor: decimal.toString() };
}

function mostrar(valor: Decimal | null): string {
  return valor === null ? 'pendiente' : `L ${formatearMonto(valor)}`;
}

function aGastoCompra(g: GastoDb): GastoCompra {
  return {
    id: g.id,
    concepto: g.concepto,
    monto: g.monto,
    moneda: g.moneda,
    tipoCambioHnlPorUsd: g.tipo_cambio_hnl_por_usd,
    estimado: g.estimado,
  };
}

function nombreVehiculo(vehiculo: VehiculoFila): string {
  return [vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter((x) => x !== null && x !== '').join(' ') || 'Vehículo sin datos';
}

export function Compra({ id }: { id: string }) {
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState<CargaCompra | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const enCurso = useRef(false);

  useEffect(() => {
    let vigente = true;
    void cargar(id).then((resultado) => {
      if (vigente) setDatos(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [id, version]);

  function recargar(texto: string | null) {
    setMensaje(texto);
    setError(null);
    setVersion((v) => v + 1);
  }

  async function marcarComprado() {
    if (datos === null || typeof datos === 'string' || datos.compra !== null || enCurso.current) return;
    enCurso.current = true;
    setMarcando(true);
    setError(null);
    const revision = crearRevision(
      aEntradas(aFormulario(datos.vehiculo, datos.cotizacion)),
      {
        perfilFeesClave: datos.cotizacion.perfil_fees_clave,
        versionTablaFees: null,
        tarifaEmbarqueId: null,
        gruaId: null,
        tipoCambioFuente: null,
      },
      new Date().toISOString(),
    );
    const { error: fallo } = await supabase.rpc('marcar_comprado', {
      p_quote_id: id,
      p_motor_version: MOTOR_VERSION,
      p_snapshot: revision,
    });
    enCurso.current = false;
    setMarcando(false);
    if (fallo) {
      setError('No se pudo marcar como comprado. Revise la conexión e intente de nuevo.');
      return;
    }
    recargar('Marcado como comprado. La cotización histórica no cambió.');
  }

  if (datos === null) return <p>Cargando…</p>;
  if (datos === 'no_encontrada') return <p>Cotización no encontrada.</p>;
  if (datos === 'error') return <p role="alert">No se pudo cargar la compra.</p>;

  const titulo = nombreVehiculo(datos.vehiculo);

  return (
    <section>
      <div className="encabezado-seccion">
        <h1>Compra · {titulo}</h1>
      </div>
      {mensaje && <p role="status">{mensaje}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {datos.compra === null ? (
        <section className="panel">
          <p>
            Esta cotización todavía no está marcada como comprada. Marcarla crea la compra y guarda una revisión
            inmutable de la cotización; no crea gastos pagados.
          </p>
          <button
            type="button"
            onClick={() => {
              void marcarComprado();
            }}
            disabled={marcando}
          >
            Marcar comprado
          </button>
        </section>
      ) : (
        <DetalleCompra key={version} datos={datos} recargar={recargar} />
      )}
    </section>
  );
}

type FormGasto = {
  concepto: ConceptoGasto;
  descripcion: string;
  lugar: string;
  monto: string;
  moneda: MonedaGasto;
  tipoCambio: string;
  fechaCompra: string;
  fechaPago: string;
  estimado: boolean;
  totalReferencia: string;
  motivoReparto: string;
  notas: string;
};

function formGastoVacio(): FormGasto {
  return {
    concepto: 'carro',
    descripcion: '',
    lugar: '',
    monto: '',
    moneda: 'USD',
    tipoCambio: '',
    fechaCompra: '',
    fechaPago: '',
    estimado: false,
    totalReferencia: '',
    motivoReparto: '',
    notas: '',
  };
}

function formGastoDesde(g: GastoDb): FormGasto {
  return {
    concepto: g.concepto,
    descripcion: g.descripcion ?? '',
    lugar: g.lugar ?? '',
    monto: textoNumero(g.monto),
    moneda: g.moneda,
    tipoCambio: textoNumero(g.tipo_cambio_hnl_por_usd),
    fechaCompra: g.fecha_compra ?? '',
    fechaPago: g.fecha_pago ?? '',
    estimado: g.estimado,
    totalReferencia: textoNumero(g.monto_total_referencia),
    motivoReparto: g.motivo_reparto ?? '',
    notas: g.notas ?? '',
  };
}

type FormCompra = {
  estado: string;
  fechaCompra: string;
  fechaRecepcion: string;
  presupuesto: string;
  contingencia: string;
  redondear: boolean;
  tipoCambio: string;
  precioVenta: string;
  fechaVenta: string;
  notas: string;
};

function DetalleCompra({
  datos,
  recargar,
}: {
  datos: CompraCompleta;
  recargar: (texto: string | null) => void;
}) {
  const { compra, revision, gastos } = datos;
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formGasto, setFormGasto] = useState<FormGasto>(formGastoVacio);
  const [formCompra, setFormCompra] = useState<FormCompra>(() => ({
    estado: compra.estado,
    fechaCompra: compra.fecha_compra ?? '',
    fechaRecepcion: compra.fecha_recepcion ?? '',
    presupuesto: textoNumero(compra.presupuesto_reparacion_hnl),
    contingencia: textoNumero(compra.contingencia_hnl),
    redondear: compra.redondear_presupuesto_5000,
    tipoCambio: textoNumero(compra.tipo_cambio_origen_hnl_por_usd),
    precioVenta: textoNumero(compra.precio_venta_hnl),
    fechaVenta: compra.fecha_venta ?? '',
    notas: compra.notas ?? '',
  }));

  const tipoCambioCompra = compra.tipo_cambio_origen_hnl_por_usd ?? revision.entradas.tipoCambioHnlPorUsd;
  const resumen: ResumenCompra = resumirCompra({
    tipoCambioCompraHnlPorUsd: tipoCambioCompra,
    importadoEstimadoHnl: revision.resultado.importadoHnl,
    presupuestoReparacionHnl: compra.presupuesto_reparacion_hnl,
    contingenciaHnl: compra.contingencia_hnl,
    redondearPresupuesto5000: compra.redondear_presupuesto_5000,
    precioVentaHnl: compra.precio_venta_hnl,
    gastos: gastos.map(aGastoCompra),
  });

  async function ejecutar(
    operacion: () => PromiseLike<{ error: { code?: string } | null }>,
    exito: string,
    fallo: string,
  ): Promise<boolean> {
    if (enCurso.current) return false;
    enCurso.current = true;
    setOcupado(true);
    const resultado = await operacion();
    enCurso.current = false;
    setOcupado(false);
    if (resultado.error) {
      setError(fallo);
      return false;
    }
    setError(null);
    recargar(exito);
    return true;
  }

  async function guardarGasto(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const monto = valorDecimal(formGasto.monto.trim());
    if (monto === null || monto.lt(0)) {
      setError('Indique un monto válido, igual o mayor que cero.');
      return;
    }
    const tc = numeroOpcional(formGasto.tipoCambio);
    if (!tc.ok || (tc.valor !== null && valorDecimal(tc.valor)?.lte(0))) {
      setError('El tipo de cambio debe ser mayor que cero o quedar vacío.');
      return;
    }
    const total = numeroOpcional(formGasto.totalReferencia);
    if (!total.ok) {
      setError('El total de reparto debe ser un número válido.');
      return;
    }
    if (total.valor !== null) {
      const totalDecimal = valorDecimal(total.valor);
      if (totalDecimal === null || totalDecimal.lt(monto)) {
        setError('El total de reparto no puede ser menor que el monto del gasto.');
        return;
      }
      if (formGasto.motivoReparto.trim() === '') {
        setError('Indique el motivo del reparto para registrar un total.');
        return;
      }
    }

    const payload = {
      concepto: formGasto.concepto,
      descripcion: formGasto.descripcion.trim() || null,
      lugar: formGasto.lugar.trim() || null,
      monto: monto.toString(),
      moneda: formGasto.moneda,
      tipo_cambio_hnl_por_usd: formGasto.moneda === 'USD' ? tc.valor : null,
      fecha_compra: formGasto.fechaCompra || null,
      fecha_pago: formGasto.fechaPago || null,
      estimado: formGasto.estimado,
      monto_total_referencia: total.valor,
      motivo_reparto: formGasto.motivoReparto.trim() || null,
      notas: formGasto.notas.trim() || null,
    };

    const exito = editandoId === null ? 'Gasto agregado.' : 'Gasto actualizado.';
    const resultado = await ejecutar(
      () =>
        editandoId === null
          ? supabase.from('purchase_expenses').insert({ ...payload, purchase_id: compra.id })
          : supabase.from('purchase_expenses').update(payload).eq('id', editandoId),
      exito,
      'No se pudo guardar el gasto.',
    );
    if (resultado) {
      setEditandoId(null);
      setFormGasto(formGastoVacio());
    }
  }

  async function eliminarGasto(gasto: GastoDb) {
    if (!window.confirm('¿Eliminar este gasto de la compra? La oferta de origen no cambia.')) return;
    await ejecutar(
      () => supabase.from('purchase_expenses').delete().eq('id', gasto.id),
      'Gasto eliminado.',
      'No se pudo eliminar el gasto.',
    );
  }

  async function guardarCompra(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const presupuesto = numeroOpcional(formCompra.presupuesto);
    const contingencia = numeroOpcional(formCompra.contingencia);
    const tc = numeroOpcional(formCompra.tipoCambio);
    const venta = numeroOpcional(formCompra.precioVenta);
    if (!presupuesto.ok || !contingencia.ok || !tc.ok || !venta.ok) {
      setError('Revise los importes: deben ser números iguales o mayores que cero.');
      return;
    }
    if (tc.valor !== null && valorDecimal(tc.valor)?.lte(0)) {
      setError('El tipo de cambio debe ser mayor que cero.');
      return;
    }
    await ejecutar(
      () =>
        supabase
          .from('purchases')
          .update({
            estado: formCompra.estado,
            fecha_compra: formCompra.fechaCompra || null,
            fecha_recepcion: formCompra.fechaRecepcion || null,
            presupuesto_reparacion_hnl: presupuesto.valor,
            contingencia_hnl: contingencia.valor,
            redondear_presupuesto_5000: formCompra.redondear,
            tipo_cambio_origen_hnl_por_usd: tc.valor,
            precio_venta_hnl: venta.valor,
            fecha_venta: formCompra.fechaVenta || null,
            notas: formCompra.notas.trim() || null,
          })
          .eq('id', compra.id),
      'Compra guardada.',
      'No se pudo guardar la compra.',
    );
  }

  function exportarGastosCsv() {
    const cabecera = [
      'Concepto',
      'Descripción',
      'Monto',
      'Moneda',
      'Tipo de cambio',
      'Equivalente HNL',
      'Fecha compra',
      'Fecha pago',
      'Estimado',
      'Total reparto referencia',
      'Motivo reparto',
    ];
    const filas = gastos.map((g) => {
      const hnl = montoHnl(aGastoCompra(g), tipoCambioCompra);
      return [
        CONCEPTO_ETIQUETA[g.concepto],
        g.descripcion,
        g.monto,
        g.moneda,
        g.tipo_cambio_hnl_por_usd,
        hnl === null ? 'pendiente' : hnl.toFixed(2),
        g.fecha_compra,
        g.fecha_pago,
        g.estimado ? 'Sí' : 'No',
        g.monto_total_referencia,
        g.motivo_reparto,
      ];
    });
    const blob = new Blob([aCsv([cabecera, ...filas])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'gastos-compra.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  const estadoLabel = ESTADO_ETIQUETA[compra.estado] ?? compra.estado;

  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <section className="panel" aria-label="Resumen de compra">
        <h2>Resumen</h2>
        <dl className="resumen-compra">
          <dt>Importado estimado (cotización)</dt>
          <dd>{mostrar(resumen.importadoEstimadoHnl)}</dd>
          <dt>Real sin reparación</dt>
          <dd>{mostrar(resumen.realSinReparacionHnl)}</dd>
          <dt>Real reparación</dt>
          <dd>{mostrar(resumen.realReparacionHnl)}</dd>
          <dt>Real total (con reparación)</dt>
          <dd>{mostrar(resumen.realTotalHnl)}</dd>
          <dt>Gastos estimados (fuera del real)</dt>
          <dd>{mostrar(resumen.estimadoGastosHnl)}</dd>
          <dt>Gastos pendientes de tipo de cambio</dt>
          <dd>{resumen.pendientesIds.length}</dd>
          <dt>Presupuesto de reparación ajustado</dt>
          <dd>{mostrar(resumen.presupuestoAjustadoHnl)}</dd>
          <dt>Desviación reparación (real − presupuesto)</dt>
          <dd>{mostrar(resumen.desviacionReparacionHnl)}</dd>
          <dt>Desviación importación (real sin reparación − importado)</dt>
          <dd>{mostrar(resumen.desviacionImportacionHnl)}</dd>
          <dt>Utilidad estimada</dt>
          <dd>{mostrar(resumen.utilidadEstimadaHnl)}</dd>
          <dt>Utilidad realizada</dt>
          <dd>{mostrar(resumen.utilidadRealizadaHnl)}</dd>
          <dt>Tipo de utilidad</dt>
          <dd>{UTILIDAD_ETIQUETA[resumen.utilidadTipo]}</dd>
        </dl>
        <div className="acciones">
          <button type="button" onClick={() => { window.print(); }}>
            Imprimir resumen
          </button>
          <button type="button" onClick={exportarGastosCsv} disabled={gastos.length === 0}>
            Exportar gastos CSV
          </button>
        </div>
      </section>

      <section className="panel" aria-label="Datos de compra">
        <h2>Datos de compra · {estadoLabel}</h2>
        <form className="formulario-cuadricula" onSubmit={(e) => void guardarCompra(e)}>
          <label>
            Estado
            <select
              value={formCompra.estado}
              onChange={(e) => {
                setFormCompra({ ...formCompra, estado: e.target.value });
              }}
            >
              <option value="comprado">Comprado</option>
              <option value="recibido">Recibido</option>
              <option value="vendido">Vendido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
          <label>
            Fecha de compra
            <input
              type="date"
              value={formCompra.fechaCompra}
              onChange={(e) => {
                setFormCompra({ ...formCompra, fechaCompra: e.target.value });
              }}
            />
          </label>
          <label>
            Fecha de recepción
            <input
              type="date"
              value={formCompra.fechaRecepcion}
              onChange={(e) => {
                setFormCompra({ ...formCompra, fechaRecepcion: e.target.value });
              }}
            />
          </label>
          <label>
            Tipo de cambio de la compra (HNL por USD)
            <input
              inputMode="decimal"
              value={formCompra.tipoCambio}
              onChange={(e) => {
                setFormCompra({ ...formCompra, tipoCambio: e.target.value });
              }}
            />
          </label>
          <label>
            Presupuesto de reparación (HNL)
            <input
              inputMode="decimal"
              value={formCompra.presupuesto}
              onChange={(e) => {
                setFormCompra({ ...formCompra, presupuesto: e.target.value });
              }}
            />
          </label>
          <label>
            Contingencia (HNL)
            <input
              inputMode="decimal"
              value={formCompra.contingencia}
              onChange={(e) => {
                setFormCompra({ ...formCompra, contingencia: e.target.value });
              }}
            />
          </label>
          <label className="linea">
            <input
              type="checkbox"
              checked={formCompra.redondear}
              onChange={(e) => {
                setFormCompra({ ...formCompra, redondear: e.target.checked });
              }}
            />
            Redondear presupuesto hacia arriba a L5000
          </label>
          <label>
            Vendido a (precio de venta, HNL)
            <input
              inputMode="decimal"
              value={formCompra.precioVenta}
              onChange={(e) => {
                setFormCompra({ ...formCompra, precioVenta: e.target.value });
              }}
            />
          </label>
          <label>
            Fecha de venta
            <input
              type="date"
              value={formCompra.fechaVenta}
              onChange={(e) => {
                setFormCompra({ ...formCompra, fechaVenta: e.target.value });
              }}
            />
          </label>
          <label className="ancho-completo">
            Notas
            <input
              value={formCompra.notas}
              onChange={(e) => {
                setFormCompra({ ...formCompra, notas: e.target.value });
              }}
            />
          </label>
          <div className="acciones ancho-completo">
            <button type="submit" disabled={ocupado}>
              Guardar datos de compra
            </button>
          </div>
        </form>
        <p className="nota">
          El presupuesto de reparación no modifica los gastos reales. Las ventas se registran solo con datos que usted
          confirme; no se deducen de anuncios.
        </p>
      </section>

      <section className="panel" aria-label="Gastos de compra">
        <h2>Gastos</h2>
        {gastos.length === 0 ? (
          <p>No hay gastos registrados.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>HNL</th>
                <th>Fechas</th>
                <th>Reparto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => {
                const hnl = montoHnl(aGastoCompra(g), tipoCambioCompra);
                return (
                  <tr key={g.id}>
                    <td>
                      {CONCEPTO_ETIQUETA[g.concepto]}
                      {g.estimado && <small> · estimado</small>}
                    </td>
                    <td>
                      {g.descripcion ?? ''}
                      {g.lugar && <small> · {g.lugar}</small>}
                    </td>
                    <td>
                      {textoNumero(g.monto)} {g.moneda}
                    </td>
                    <td>{hnl === null ? 'pendiente' : formatearMonto(hnl)}</td>
                    <td>
                      {g.fecha_compra ?? '—'} / {g.fecha_pago ?? '—'}
                    </td>
                    <td>
                      {g.monto_total_referencia !== null ? (
                        <>
                          Total {textoNumero(g.monto_total_referencia)}: {g.motivo_reparto ?? ''}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="acciones">
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoId(g.id);
                          setFormGasto(formGastoDesde(g));
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void eliminarGasto(g);
                        }}
                        disabled={ocupado}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <form className="formulario-cuadricula" onSubmit={(e) => void guardarGasto(e)} aria-label="Gasto">
          <h3 className="ancho-completo">{editandoId === null ? 'Agregar gasto' : 'Editar gasto'}</h3>
          <label>
            Concepto
            <select
              value={formGasto.concepto}
              onChange={(e) => {
                setFormGasto({ ...formGasto, concepto: e.target.value as ConceptoGasto });
              }}
            >
              {CONCEPTOS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {CONCEPTO_ETIQUETA[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción
            <input
              value={formGasto.descripcion}
              onChange={(e) => {
                setFormGasto({ ...formGasto, descripcion: e.target.value });
              }}
            />
          </label>
          <label>
            Lugar
            <input
              value={formGasto.lugar}
              onChange={(e) => {
                setFormGasto({ ...formGasto, lugar: e.target.value });
              }}
            />
          </label>
          <label>
            Monto
            <input
              inputMode="decimal"
              value={formGasto.monto}
              onChange={(e) => {
                setFormGasto({ ...formGasto, monto: e.target.value });
              }}
            />
          </label>
          <label>
            Moneda
            <select
              value={formGasto.moneda}
              onChange={(e) => {
                setFormGasto({ ...formGasto, moneda: e.target.value as MonedaGasto });
              }}
            >
              <option value="USD">USD</option>
              <option value="HNL">HNL</option>
            </select>
          </label>
          <label>
            Tipo de cambio propio (opcional, solo USD)
            <input
              inputMode="decimal"
              value={formGasto.tipoCambio}
              disabled={formGasto.moneda !== 'USD'}
              onChange={(e) => {
                setFormGasto({ ...formGasto, tipoCambio: e.target.value });
              }}
            />
          </label>
          <label>
            Fecha de compra
            <input
              type="date"
              value={formGasto.fechaCompra}
              onChange={(e) => {
                setFormGasto({ ...formGasto, fechaCompra: e.target.value });
              }}
            />
          </label>
          <label>
            Fecha de pago
            <input
              type="date"
              value={formGasto.fechaPago}
              onChange={(e) => {
                setFormGasto({ ...formGasto, fechaPago: e.target.value });
              }}
            />
          </label>
          <label className="linea">
            <input
              type="checkbox"
              checked={formGasto.estimado}
              onChange={(e) => {
                setFormGasto({ ...formGasto, estimado: e.target.checked });
              }}
            />
            Estimado (no entra en el real)
          </label>
          <label>
            Total de reparto (opcional)
            <input
              inputMode="decimal"
              value={formGasto.totalReferencia}
              onChange={(e) => {
                setFormGasto({ ...formGasto, totalReferencia: e.target.value });
              }}
            />
          </label>
          <label>
            Motivo del reparto
            <input
              value={formGasto.motivoReparto}
              onChange={(e) => {
                setFormGasto({ ...formGasto, motivoReparto: e.target.value });
              }}
            />
          </label>
          <label className="ancho-completo">
            Notas
            <input
              value={formGasto.notas}
              onChange={(e) => {
                setFormGasto({ ...formGasto, notas: e.target.value });
              }}
            />
          </label>
          <div className="acciones ancho-completo">
            <button type="submit" disabled={ocupado}>
              {editandoId === null ? 'Agregar gasto' : 'Guardar gasto'}
            </button>
            {editandoId !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditandoId(null);
                  setFormGasto(formGastoVacio());
                }}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="solo-impresion" aria-hidden="true">
        <h2>Resumen de compra · {nombreVehiculo(datos.vehiculo)}</h2>
        <p>Referencia: {datos.cotizacion.referencia ?? '—'}</p>
        <p>Importado estimado: {mostrar(resumen.importadoEstimadoHnl)}</p>
        <p>Real total: {mostrar(resumen.realTotalHnl)}</p>
        <p>Presupuesto de reparación: {mostrar(resumen.presupuestoAjustadoHnl)}</p>
        <p>Precio de venta: {mostrar(valorDecimal(compra.precio_venta_hnl))}</p>
        <p>Utilidad estimada: {mostrar(resumen.utilidadEstimadaHnl)}</p>
        <p>Utilidad realizada: {mostrar(resumen.utilidadRealizadaHnl)}</p>
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Descripción</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{CONCEPTO_ETIQUETA[g.concepto]}</td>
                <td>{g.descripcion ?? ''}</td>
                <td>
                  {textoNumero(g.monto)} {g.moneda}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
