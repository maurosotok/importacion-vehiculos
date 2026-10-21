import { type SyntheticEvent, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type PerfilFees = { clave: string; etiqueta: string; estado_tabla: string; seleccionable: boolean; es_predeterminado: boolean };
type Proveedor = { clave: string; nombre: string };
type Ajustes = {
  perfil_fees_clave: string;
  proveedor_clave: string;
  gastos_locales_referencia_min_hnl: string;
  gastos_locales_referencia_max_hnl: string;
  gastos_locales_predeterminado_hnl: string;
  papeleria_predeterminada_usd: string;
  tipo_cambio_predeterminado_hnl_por_usd: string;
};

const AJUSTES_VACIOS: Ajustes = {
  perfil_fees_clave: '',
  proveedor_clave: '',
  gastos_locales_referencia_min_hnl: '',
  gastos_locales_referencia_max_hnl: '',
  gastos_locales_predeterminado_hnl: '',
  papeleria_predeterminada_usd: '',
  tipo_cambio_predeterminado_hnl_por_usd: '',
};

const PATRON_MONTO = /^\d+(\.\d{1,4})?$/;
const PATRON_TIPO_CAMBIO = /^\d+(\.\d{1,6})?$/;

function aTexto(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';
}

function aNulo(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

export function Configuracion({ usuarioId }: { usuarioId: string }) {
  const [perfiles, setPerfiles] = useState<PerfilFees[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_VACIOS);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void Promise.all([
      supabase.from('fee_profiles').select('clave, etiqueta, estado_tabla, seleccionable, es_predeterminado').order('etiqueta'),
      supabase.from('logistics_providers').select('clave, nombre').order('nombre'),
      supabase
        .from('user_settings')
        .select(
          'perfil_fees_clave, proveedor_clave, gastos_locales_referencia_min_hnl, gastos_locales_referencia_max_hnl, gastos_locales_predeterminado_hnl, papeleria_predeterminada_usd, tipo_cambio_predeterminado_hnl_por_usd',
        )
        .maybeSingle(),
    ]).then(([resPerfiles, resProveedores, resAjustes]) => {
      if (!vigente) return;
      if (resPerfiles.error || resProveedores.error || resAjustes.error) {
        setError('No se pudo cargar la configuración.');
        return;
      }
      setPerfiles(resPerfiles.data);
      setProveedores(resProveedores.data);
      const fila = resAjustes.data;
      if (fila) {
        setAjustes({
          perfil_fees_clave: aTexto(fila.perfil_fees_clave),
          proveedor_clave: aTexto(fila.proveedor_clave),
          gastos_locales_referencia_min_hnl: aTexto(fila.gastos_locales_referencia_min_hnl),
          gastos_locales_referencia_max_hnl: aTexto(fila.gastos_locales_referencia_max_hnl),
          gastos_locales_predeterminado_hnl: aTexto(fila.gastos_locales_predeterminado_hnl),
          papeleria_predeterminada_usd: aTexto(fila.papeleria_predeterminada_usd),
          tipo_cambio_predeterminado_hnl_por_usd: aTexto(fila.tipo_cambio_predeterminado_hnl_por_usd),
        });
      }
    });
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  const guardar = async (evento: { preventDefault: () => void }) => {
    evento.preventDefault();
    setMensaje(null);
    setError(null);

    const montos = [
      ajustes.gastos_locales_referencia_min_hnl,
      ajustes.gastos_locales_referencia_max_hnl,
      ajustes.gastos_locales_predeterminado_hnl,
      ajustes.papeleria_predeterminada_usd,
    ];
    if (montos.some((valor) => valor.trim() !== '' && !PATRON_MONTO.test(valor.trim()))) {
      setError('Los montos deben ser números positivos, con hasta 4 decimales.');
      return;
    }
    const tipoCambio = ajustes.tipo_cambio_predeterminado_hnl_por_usd.trim();
    if (tipoCambio !== '' && (!PATRON_TIPO_CAMBIO.test(tipoCambio) || Number(tipoCambio) <= 0)) {
      setError('El tipo de cambio debe ser un número mayor que cero, con hasta 6 decimales.');
      return;
    }

    setGuardando(true);
    const { error: fallo } = await supabase.from('user_settings').upsert(
      {
        owner_id: usuarioId,
        perfil_fees_clave: aNulo(ajustes.perfil_fees_clave),
        proveedor_clave: aNulo(ajustes.proveedor_clave),
        gastos_locales_referencia_min_hnl: aNulo(ajustes.gastos_locales_referencia_min_hnl),
        gastos_locales_referencia_max_hnl: aNulo(ajustes.gastos_locales_referencia_max_hnl),
        gastos_locales_predeterminado_hnl: aNulo(ajustes.gastos_locales_predeterminado_hnl),
        papeleria_predeterminada_usd: aNulo(ajustes.papeleria_predeterminada_usd),
        tipo_cambio_predeterminado_hnl_por_usd: aNulo(ajustes.tipo_cambio_predeterminado_hnl_por_usd),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' },
    );
    setGuardando(false);
    if (fallo) {
      setError(
        'No se pudo guardar. Revise el perfil, el proveedor, los rangos de gastos y los valores predeterminados; los gastos locales y la papelería predeterminados no pueden quedar vacíos.',
      );
      return;
    }
    setMensaje('Configuración guardada.');
  };

  const perfilPredeterminado = perfiles?.find((perfil) => perfil.es_predeterminado && perfil.seleccionable)?.clave ?? '';
  const perfilEfectivo = ajustes.perfil_fees_clave || perfilPredeterminado;
  const perfilSeleccionado = perfiles?.find((perfil) => perfil.clave === perfilEfectivo);

  return (
    <section>
      <div className="encabezado-seccion">
        <h1>Configuración</h1>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="exito">
          {mensaje}
        </p>
      )}
      {perfiles === null && !error && <p>Cargando…</p>}
      {perfiles && (
        <form
          className="formulario configuracion"
          onSubmit={(evento: SyntheticEvent<HTMLFormElement>) => {
            void guardar(evento);
          }}
        >
          <fieldset>
            <legend>Fees de subasta</legend>
            <div className="rejilla">
              <label className="ancho-2">
                Perfil favorito
                <select
                  value={perfilEfectivo}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, perfil_fees_clave: evento.target.value });
                  }}
                >
                  {!perfilEfectivo && <option value="">Sin perfil disponible</option>}
                  {perfiles
                    .filter((perfil) => perfil.seleccionable)
                    .map((perfil) => (
                      <option key={perfil.clave} value={perfil.clave}>
                        {perfil.etiqueta}
                      </option>
                    ))}
                </select>
              </label>
              {perfilSeleccionado && perfilSeleccionado.estado_tabla !== 'verificada' && (
                <p className="nota ancho-2">
                  La tabla de fees de este perfil no está incluida. Use el importe manual de fees en cada cotización.
                </p>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Proveedor logístico predeterminado</legend>
            <div className="rejilla">
              <label className="ancho-2">
                Proveedor
                <select
                  value={ajustes.proveedor_clave}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, proveedor_clave: evento.target.value });
                  }}
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map((proveedor) => (
                    <option key={proveedor.clave} value={proveedor.clave}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Impuestos y gastos locales (HNL)</legend>
            <div className="rejilla">
              <label>
                Gastos locales, mínimo de referencia
                <input
                  inputMode="decimal"
                  value={ajustes.gastos_locales_referencia_min_hnl}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, gastos_locales_referencia_min_hnl: evento.target.value });
                  }}
                />
              </label>
              <label>
                Gastos locales, máximo de referencia
                <input
                  inputMode="decimal"
                  value={ajustes.gastos_locales_referencia_max_hnl}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, gastos_locales_referencia_max_hnl: evento.target.value });
                  }}
                />
              </label>
            </div>
            <p className="nota">Son referencias manuales. No cambian impuestos ya capturados en ninguna cotización.</p>
          </fieldset>

          <fieldset>
            <legend>Valores predeterminados de cotización nueva</legend>
            <div className="rejilla">
              <label>
                Gastos locales y salida (HNL)
                <input
                  inputMode="decimal"
                  value={ajustes.gastos_locales_predeterminado_hnl}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, gastos_locales_predeterminado_hnl: evento.target.value });
                  }}
                />
              </label>
              <label>
                Papelería general (USD)
                <input
                  inputMode="decimal"
                  value={ajustes.papeleria_predeterminada_usd}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, papeleria_predeterminada_usd: evento.target.value });
                  }}
                />
              </label>
              <label>
                Tipo de cambio (HNL por USD)
                <input
                  inputMode="decimal"
                  value={ajustes.tipo_cambio_predeterminado_hnl_por_usd}
                  onChange={(evento) => {
                    setAjustes({ ...ajustes, tipo_cambio_predeterminado_hnl_por_usd: evento.target.value });
                  }}
                />
              </label>
            </div>
            <p className="nota">
              Se copian a cada cotización nueva al crearla. Cambiarlos después no modifica cotizaciones existentes.
            </p>
          </fieldset>

          <div>
            <button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
