import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { supabase } from '../lib/supabase';
import { irA } from '../lib/ruta';
import { crearCotizacion } from '../lib/nuevaCotizacion';
import {
  FILTROS_INICIALES,
  SIN_FILTROS,
  esBorradorSinDatos,
  formatearFechaCorta,
  hoyEnHonduras,
  listarCotizaciones,
  type FilaListado,
  type FiltrosListado,
} from '../lib/listadoVehiculos';

type FilaBd = {
  id: string;
  estado: string;
  referencia: string | null;
  fecha_negocio: string;
  fecha_subasta: string | null;
  vendido_en_subasta: boolean;
  updated_at: string;
  vehicles: { marca: string | null; modelo: string | null; anio: number | null; vin: string | null } | null;
};

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  comprada: 'Comprada',
  no_ganada: 'No ganada',
};

function aFilaListado(f: FilaBd): FilaListado {
  const v = f.vehicles;
  const vehiculo =
    v && (v.marca || v.modelo) ? [v.marca, v.modelo, v.anio?.toString()].filter(Boolean).join(' ') : '';
  return {
    id: f.id,
    fechaNegocio: f.fecha_negocio,
    fechaSubasta: f.fecha_subasta,
    vendidoEnSubasta: f.vendido_en_subasta,
    vehiculo,
    vin: v?.vin || null,
    referencia: f.referencia || null,
    estado: f.estado,
    updatedAt: f.updated_at,
  };
}

const aFechas = (valor: string): FiltrosListado['fechas'] => (valor === 'todas' ? 'todas' : 'hoy_en_adelante');

const aVendido = (valor: string): FiltrosListado['vendido'] => {
  if (valor === 'si' || valor === 'no') return valor;
  return 'todos';
};

const detenerPropagacion = (evento: MouseEvent): void => {
  evento.stopPropagation();
};

export function Vehiculos() {
  const [filas, setFilas] = useState<FilaListado[] | null>(null);
  const [filtros, setFiltros] = useState<FiltrosListado>(FILTROS_INICIALES);
  const [hoy] = useState(() => hoyEnHonduras());
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [ocupadas, setOcupadas] = useState<ReadonlySet<string>>(() => new Set());
  const enCurso = useRef(new Set<string>());

  useEffect(() => {
    let vigente = true;
    void supabase
      .from('quotes')
      .select(
        'id, estado, referencia, fecha_negocio, fecha_subasta, vendido_en_subasta, updated_at, vehicles(marca, modelo, anio, vin)',
      )
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .then(({ data, error: fallo }) => {
        if (!vigente) return;
        if (fallo) {
          setError('No se pudieron cargar las cotizaciones.');
          return;
        }
        setFilas((data as unknown as FilaBd[]).map(aFilaListado));
      });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (aviso === null) return;
    const temporizador = window.setTimeout(() => {
      setAviso(null);
    }, 2500);
    return () => {
      window.clearTimeout(temporizador);
    };
  }, [aviso]);

  const visibles = useMemo(
    () => (filas === null ? null : listarCotizaciones(filas, filtros, hoy)),
    [filas, filtros, hoy],
  );

  const marcarOcupada = (id: string, ocupada: boolean) => {
    if (ocupada) enCurso.current.add(id);
    else enCurso.current.delete(id);
    setOcupadas(new Set(enCurso.current));
  };

  const nueva = async () => {
    setCreando(true);
    setError(null);
    const resultado = await crearCotizacion(null);
    setCreando(false);
    if ('error' in resultado) {
      setError(resultado.error);
      return;
    }
    irA(`#/vehiculos/${resultado.id}`);
  };

  const cambiarVendido = async (fila: FilaListado, valor: boolean) => {
    if (enCurso.current.has(fila.id)) return;
    marcarOcupada(fila.id, true);
    setError(null);
    const { error: fallo } = await supabase
      .from('quotes')
      .update({ vendido_en_subasta: valor })
      .eq('id', fila.id);
    marcarOcupada(fila.id, false);
    if (fallo) {
      setError('No se pudo guardar el estado vendido. Intente de nuevo.');
      return;
    }
    setFilas((actual) => actual?.map((f) => (f.id === fila.id ? { ...f, vendidoEnSubasta: valor } : f)) ?? null);
    setAviso(valor ? 'Marcado como vendido en subasta.' : 'Marcado como no vendido.');
  };

  const eliminar = async (fila: FilaListado) => {
    if (enCurso.current.has(fila.id)) return;
    const pregunta = esBorradorSinDatos(fila)
      ? '¿Eliminar esta cotización sin datos?'
      : `¿Eliminar la cotización de ${fila.vehiculo || 'este vehículo'}? Las compras y gastos registrados se conservan.`;
    if (!window.confirm(pregunta)) return;
    marcarOcupada(fila.id, true);
    setError(null);
    const respuesta = await supabase.rpc('archivar_cotizacion', { p_id: fila.id });
    const archivada: unknown = respuesta.data;
    marcarOcupada(fila.id, false);
    if (respuesta.error || archivada !== true) {
      setError('No se pudo eliminar la cotización. Intente de nuevo.');
      return;
    }
    setFilas((actual) => actual?.filter((f) => f.id !== fila.id) ?? null);
    setAviso('Cotización eliminada.');
  };

  return (
    <section>
      <div className="encabezado-seccion">
        <h1>Vehículos</h1>
        <button
          type="button"
          onClick={() => {
            void nueva();
          }}
          disabled={creando}
        >
          {creando ? 'Creando…' : 'Nueva cotización'}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="aviso-guardado">
          {aviso}
        </p>
      )}
      {filas === null && !error && <p>Cargando…</p>}
      {filas?.length === 0 && <p>Todavía no hay cotizaciones.</p>}
      {filas && filas.length > 0 && (
        <>
          <div className="listado-filtros">
            <label>
              Fecha
              <select
                value={filtros.fechas}
                onChange={(e) => {
                  setFiltros({ ...filtros, fechas: aFechas(e.target.value) });
                }}
              >
                <option value="hoy_en_adelante">Subastas de hoy en adelante</option>
                <option value="todas">Todas las fechas</option>
              </select>
            </label>
            <label>
              Vendido
              <select
                value={filtros.vendido}
                onChange={(e) => {
                  setFiltros({ ...filtros, vendido: aVendido(e.target.value) });
                }}
              >
                <option value="todos">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="casilla">
              <input
                type="checkbox"
                checked={filtros.mostrarVendidasPasadas}
                onChange={(e) => {
                  setFiltros({ ...filtros, mostrarVendidasPasadas: e.target.checked });
                }}
              />
              Mostrar subastas pasadas vendidas
            </label>
            <button
              type="button"
              onClick={() => {
                setFiltros(SIN_FILTROS);
              }}
            >
              Mostrar todas
            </button>
            <span className="pendiente">
              Mostrando {visibles?.length ?? 0} de {filas.length}
            </span>
          </div>
          {visibles && visibles.length === 0 && <p>No hay cotizaciones con estos filtros.</p>}
          {visibles && visibles.length > 0 && (
            <div className="tabla-contenedor">
              <table className="tabla tabla-compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Vehículo</th>
                    <th>VIN</th>
                    <th>Fecha de subasta</th>
                    <th>Referencia</th>
                    <th>Estado</th>
                    <th title="Subasta en la que el vehículo se vendió. No indica venta en Honduras.">Vendido</th>
                    <th>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((fila) => {
                    const ocupada = ocupadas.has(fila.id);
                    const descripcion = fila.vehiculo || 'Sin datos';
                    return (
                      <tr
                        key={fila.id}
                        className="fila-enlace"
                        onClick={() => {
                          irA(`#/vehiculos/${fila.id}`);
                        }}
                      >
                        <td>{formatearFechaCorta(fila.fechaNegocio)}</td>
                        <td>
                          <a href={`#/vehiculos/${fila.id}`}>{descripcion}</a>
                        </td>
                        <td>{fila.vin ?? <span className="pendiente">Pendiente</span>}</td>
                        <td>{fila.fechaSubasta ? formatearFechaCorta(fila.fechaSubasta) : 'Sin fecha'}</td>
                        <td>{fila.referencia ?? ''}</td>
                        <td>{ETIQUETA_ESTADO[fila.estado] ?? fila.estado}</td>
                        <td onClick={detenerPropagacion}>
                          <label className="casilla">
                            <input
                              type="checkbox"
                              checked={fila.vendidoEnSubasta}
                              disabled={ocupada}
                              aria-label={`Vendido en subasta: ${descripcion}`}
                              onChange={(e) => {
                                void cambiarVendido(fila, e.target.checked);
                              }}
                            />
                            {fila.vendidoEnSubasta ? 'Sí' : 'No'}
                          </label>
                        </td>
                        <td onClick={detenerPropagacion}>
                          <button
                            type="button"
                            className="boton-icono-peligro"
                            disabled={ocupada}
                            title="Eliminar"
                            aria-label={`Eliminar ${descripcion}`}
                            onClick={() => {
                              void eliminar(fila);
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
