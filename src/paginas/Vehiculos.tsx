import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { irA } from '../lib/ruta';

type FilaListado = {
  id: string;
  estado: string;
  referencia: string | null;
  fecha_negocio: string;
  updated_at: string;
  vehicles: { marca: string | null; modelo: string | null; anio: number | null; vin: string | null } | null;
};

const GASTOS_LOCALES_PREDETERMINADOS_HNL = '13557';
const PAPELERIA_PREDETERMINADA_USD = '15';

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  comprada: 'Comprada',
  no_ganada: 'No ganada',
};

export function Vehiculos() {
  const [filas, setFilas] = useState<FilaListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void supabase
      .from('quotes')
      .select('id, estado, referencia, fecha_negocio, updated_at, vehicles(marca, modelo, anio, vin)')
      .order('updated_at', { ascending: false })
      .then(({ data, error: fallo }) => {
        if (!vigente) return;
        if (fallo) {
          setError('No se pudieron cargar las cotizaciones.');
          return;
        }
        setFilas(data as unknown as FilaListado[]);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const nueva = async () => {
    setCreando(true);
    setError(null);
    const [{ data: ajustes }, { data: predeterminado }] = await Promise.all([
      supabase
        .from('user_settings')
        .select(
          'perfil_fees_clave, gastos_locales_predeterminado_hnl, papeleria_predeterminada_usd, tipo_cambio_predeterminado_hnl_por_usd',
        )
        .maybeSingle(),
      supabase.from('fee_profiles').select('clave').eq('es_predeterminado', true).eq('seleccionable', true).maybeSingle(),
    ]);
    const { data: vehiculo, error: errorVehiculo } = await supabase.from('vehicles').insert({}).select('id').single();
    if (errorVehiculo) {
      setCreando(false);
      setError('No se pudo crear el vehículo.');
      return;
    }
    const { data: cotizacion, error: errorCotizacion } = await supabase
      .from('quotes')
      .insert({
        vehicle_id: vehiculo.id,
        subasta: 'IAA',
        perfil_fees_clave: ajustes?.perfil_fees_clave ?? predeterminado?.clave ?? null,
        modo_fees: 'tabla',
        modo_impuestos: 'desglose',
        gastos_locales_hnl: ajustes?.gastos_locales_predeterminado_hnl ?? GASTOS_LOCALES_PREDETERMINADOS_HNL,
        papeleria_usd: ajustes?.papeleria_predeterminada_usd ?? PAPELERIA_PREDETERMINADA_USD,
        tipo_cambio_hnl_por_usd: ajustes?.tipo_cambio_predeterminado_hnl_por_usd ?? null,
      })
      .select('id')
      .single();
    setCreando(false);
    if (errorCotizacion) {
      setError('No se pudo crear la cotización.');
      return;
    }
    irA(`#/vehiculos/${cotizacion.id as string}`);
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
      {filas === null && !error && <p>Cargando…</p>}
      {filas?.length === 0 && <p>Todavía no hay cotizaciones.</p>}
      {filas && filas.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Vehículo</th>
              <th>VIN</th>
              <th>Referencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const v = fila.vehicles;
              const descripcion =
                v && (v.marca || v.modelo)
                  ? [v.marca, v.modelo, v.anio?.toString()].filter(Boolean).join(' ')
                  : 'Sin datos';
              return (
                <tr
                  key={fila.id}
                  className="fila-enlace"
                  onClick={() => {
                    irA(`#/vehiculos/${fila.id}`);
                  }}
                >
                  <td>{fila.fecha_negocio}</td>
                  <td>
                    <a href={`#/vehiculos/${fila.id}`}>{descripcion}</a>
                  </td>
                  <td>{v?.vin ?? <span className="pendiente">Pendiente</span>}</td>
                  <td>{fila.referencia ?? ''}</td>
                  <td>{ETIQUETA_ESTADO[fila.estado] ?? fila.estado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
