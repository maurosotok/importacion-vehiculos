import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { supabase } from '../lib/supabase';
import { formatearMonto, valorDecimal } from '../motor/calculo';
import { calcularMercado, sugerirPrecioObjetivoHnl, type CriteriosMercado, type ObservacionMercado } from '../motor/mercado';
import type { Numero } from '../lib/formulario';

type ObsDb = {
  id: string;
  marca: string;
  modelo: string;
  alias_modelo: string | null;
  version: string | null;
  anio: number | null;
  precio_usd: Numero;
  motor: string | null;
  traccion: string | null;
  millas: number | null;
  fecha_consulta: string | null;
  enlace: string | null;
  recien_ingreso: boolean;
  ubicacion: string | null;
};

type ObjetivoDb = {
  id: string;
  marca: string;
  modelo: string;
  anio: number | null;
  precio_objetivo: Numero;
  moneda: 'USD' | 'HNL';
  fecha: string | null;
  origen: 'manual' | 'sugerido_media';
};

type FormObs = {
  marca: string;
  modelo: string;
  alias: string;
  version: string;
  anio: string;
  precio: string;
  motor: string;
  traccion: string;
  millas: string;
  fecha: string;
  ubicacion: string;
  enlace: string;
  recienIngreso: boolean;
};

type FormCriterio = {
  marca: string;
  modelo: string;
  anioDesde: string;
  anioHasta: string;
  version: string;
  modo: 'agrupar' | 'aislar';
  especiales: string;
  tipoCambio: string;
};

const ORIGEN_ETIQUETA: Record<ObjetivoDb['origen'], string> = {
  manual: 'Manual',
  sugerido_media: 'Sugerido desde la media',
};

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Tegucigalpa' });
}

function formObsVacio(): FormObs {
  return {
    marca: '',
    modelo: '',
    alias: '',
    version: '',
    anio: '',
    precio: '',
    motor: '',
    traccion: '',
    millas: '',
    fecha: hoy(),
    ubicacion: '',
    enlace: '',
    recienIngreso: false,
  };
}

const FORM_CRITERIO_VACIO: FormCriterio = {
  marca: '',
  modelo: '',
  anioDesde: '',
  anioHasta: '',
  version: '',
  modo: 'agrupar',
  especiales: '',
  tipoCambio: '',
};

function textoOpcional(texto: string): string | null {
  const limpio = texto.trim();
  return limpio === '' ? null : limpio;
}

function enteroOpcional(texto: string, min: number, max: number): { ok: true; valor: number | null } | { ok: false } {
  const limpio = texto.trim();
  if (limpio === '') return { ok: true, valor: null };
  const numero = Number(limpio);
  if (!Number.isInteger(numero) || numero < min || numero > max) return { ok: false };
  return { ok: true, valor: numero };
}

function aObservacion(o: ObsDb): ObservacionMercado {
  return {
    id: o.id,
    marca: o.marca,
    modelo: o.modelo,
    alias: o.alias_modelo,
    version: o.version,
    anio: o.anio,
    precioUsd: o.precio_usd,
    motor: o.motor,
    traccion: o.traccion,
    millas: o.millas,
    fechaConsulta: o.fecha_consulta,
    recienIngreso: o.recien_ingreso,
    ubicacion: o.ubicacion,
  };
}

function criterioDesde(f: FormCriterio): CriteriosMercado | string {
  const marca = f.marca.trim();
  const modelo = f.modelo.trim();
  if (marca === '' || modelo === '') return 'Indique marca y modelo para calcular el promedio.';
  const desde = enteroOpcional(f.anioDesde, 1900, 2100);
  const hasta = enteroOpcional(f.anioHasta, 1900, 2100);
  if (!desde.ok || !hasta.ok) return 'Los años deben estar entre 1900 y 2100.';
  if (desde.valor !== null && hasta.valor !== null && desde.valor > hasta.valor) {
    return 'El año inicial no puede ser mayor que el final.';
  }
  return {
    marca,
    modelo,
    anioDesde: desde.valor,
    anioHasta: hasta.valor,
    version: textoOpcional(f.version),
    modoVersiones: f.modo,
    versionesEspeciales: f.especiales
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== ''),
  };
}

function mostrarUsd(valor: Parameters<typeof formatearMonto>[0]): string {
  return valor === null ? 'Sin comparables con precio' : `USD ${formatearMonto(valor)}`;
}

export function Mercado() {
  const [observaciones, setObservaciones] = useState<ObsDb[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoDb[]>([]);
  const [cargado, setCargado] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [formObs, setFormObs] = useState<FormObs>(formObsVacio);
  const [criterio, setCriterio] = useState<FormCriterio>(FORM_CRITERIO_VACIO);
  const [objetivoMarca, setObjetivoMarca] = useState('');
  const [objetivoModelo, setObjetivoModelo] = useState('');
  const [objetivoPrecio, setObjetivoPrecio] = useState('');
  const enCurso = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vigente = true;
    void Promise.all([
      supabase.from('market_observations').select('*').order('created_at', { ascending: false }),
      supabase.from('sale_price_targets').select('*').order('created_at', { ascending: false }),
    ]).then(([obs, obj]) => {
      if (!vigente) return;
      if (obs.error || obj.error) {
        setError('No se pudieron cargar los datos de mercado.');
      } else {
        setObservaciones(obs.data);
        setObjetivos(obj.data);
      }
      setCargado(true);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  const criterioValido = useMemo(() => criterioDesde(criterio), [criterio]);
  const tipoCambio = valorDecimal(criterio.tipoCambio.trim() === '' ? null : criterio.tipoCambio.trim());
  const resultado = useMemo(
    () =>
      typeof criterioValido === 'string'
        ? null
        : calcularMercado(observaciones.map(aObservacion), criterioValido),
    [criterioValido, observaciones],
  );
  const sugerido = resultado ? sugerirPrecioObjetivoHnl(resultado.promedioUsd, tipoCambio) : null;

  async function escribir(
    operacion: () => PromiseLike<{ error: { code?: string } | null }>,
    exito: string,
    fallo: string,
  ): Promise<boolean> {
    if (enCurso.current) return false;
    enCurso.current = true;
    setOcupado(true);
    const resultadoOperacion = await operacion();
    enCurso.current = false;
    setOcupado(false);
    if (resultadoOperacion.error) {
      setError(fallo);
      return false;
    }
    setError(null);
    setMensaje(exito);
    setVersion((v) => v + 1);
    return true;
  }

  async function guardarObservacion(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const marca = formObs.marca.trim();
    const modelo = formObs.modelo.trim();
    if (marca === '' || modelo === '') {
      setError('Marca y modelo son obligatorios.');
      return;
    }
    const anio = enteroOpcional(formObs.anio, 1900, 2100);
    const millas = enteroOpcional(formObs.millas, 0, 99999999);
    if (!anio.ok || !millas.ok) {
      setError('Revise el año (1900–2100) y las millas (0 o mayores).');
      return;
    }
    const precioTexto = formObs.precio.trim();
    const precio = precioTexto === '' ? null : valorDecimal(precioTexto);
    if (precioTexto !== '' && (precio === null || !precio.gt(0))) {
      setError('El precio debe ser mayor que cero. Deje el campo vacío si no se conoce.');
      return;
    }
    const exito = await escribir(
      () =>
        supabase.from('market_observations').insert({
          marca,
          modelo,
          alias_modelo: textoOpcional(formObs.alias),
          version: textoOpcional(formObs.version),
          anio: anio.valor,
          precio_usd: precio === null ? null : precio.toString(),
          motor: textoOpcional(formObs.motor),
          traccion: textoOpcional(formObs.traccion),
          millas: millas.valor,
          fecha_consulta: formObs.fecha || null,
          enlace: textoOpcional(formObs.enlace),
          recien_ingreso: formObs.recienIngreso,
          ubicacion: textoOpcional(formObs.ubicacion),
        }),
      'Observación guardada.',
      'No se pudo guardar la observación.',
    );
    if (exito) setFormObs(formObsVacio());
  }

  async function eliminarObservacion(id: string) {
    if (!window.confirm('¿Eliminar esta observación de mercado?')) return;
    await escribir(
      () => supabase.from('market_observations').delete().eq('id', id),
      'Observación eliminada.',
      'No se pudo eliminar la observación.',
    );
  }

  async function usarMediaComoSugerencia() {
    if (resultado === null || sugerido === null || typeof criterioValido === 'string') return;
    await escribir(
      () =>
        supabase.from('sale_price_targets').insert({
          marca: criterioValido.marca,
          modelo: criterioValido.modelo,
          anio: null,
          precio_objetivo: sugerido.toFixed(2),
          moneda: 'HNL',
          fecha: hoy(),
          origen: 'sugerido_media',
        }),
      'Precio objetivo sugerido guardado. Puede editarlo.',
      'No se pudo guardar el precio objetivo.',
    );
  }

  async function agregarObjetivoManual(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const precio = valorDecimal(objetivoPrecio.trim());
    if (objetivoMarca.trim() === '' || objetivoModelo.trim() === '' || precio === null || precio.lt(0)) {
      setError('Marca, modelo y un precio objetivo válido son obligatorios.');
      return;
    }
    const exito = await escribir(
      () =>
        supabase.from('sale_price_targets').insert({
          marca: objetivoMarca.trim(),
          modelo: objetivoModelo.trim(),
          anio: null,
          precio_objetivo: precio.toString(),
          moneda: 'HNL',
          fecha: hoy(),
          origen: 'manual',
        }),
      'Precio objetivo guardado.',
      'No se pudo guardar el precio objetivo.',
    );
    if (exito) {
      setObjetivoMarca('');
      setObjetivoModelo('');
      setObjetivoPrecio('');
    }
  }

  if (!cargado) return <p>Cargando…</p>;

  const incluidas = new Set(resultado?.incluidas ?? []);

  return (
    <section>
      <div className="encabezado-seccion">
        <h1>Mercado</h1>
      </div>
      <p className="nota">
        Captura manual de anuncios y precios de referencia. Un anuncio no es una venta realizada. Los precios vacíos o
        cero no cuentan en el promedio.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}

      <section className="panel" aria-label="Criterios de comparación">
        <h2>Criterios</h2>
        <div className="formulario-cuadricula">
          <label>
            Marca
            <input
              value={criterio.marca}
              onChange={(e) => {
                setCriterio({ ...criterio, marca: e.target.value });
              }}
            />
          </label>
          <label>
            Modelo
            <input
              value={criterio.modelo}
              onChange={(e) => {
                setCriterio({ ...criterio, modelo: e.target.value });
              }}
            />
          </label>
          <label>
            Año desde
            <input
              inputMode="numeric"
              value={criterio.anioDesde}
              onChange={(e) => {
                setCriterio({ ...criterio, anioDesde: e.target.value });
              }}
            />
          </label>
          <label>
            Año hasta
            <input
              inputMode="numeric"
              value={criterio.anioHasta}
              onChange={(e) => {
                setCriterio({ ...criterio, anioHasta: e.target.value });
              }}
            />
          </label>
          <label>
            Versión (opcional)
            <input
              value={criterio.version}
              onChange={(e) => {
                setCriterio({ ...criterio, version: e.target.value });
              }}
            />
          </label>
          <label>
            Versiones
            <select
              value={criterio.modo}
              onChange={(e) => {
                setCriterio({ ...criterio, modo: e.target.value as 'agrupar' | 'aislar' });
              }}
            >
              <option value="agrupar">Agrupar todas las versiones</option>
              <option value="aislar">Aislar versiones especiales</option>
            </select>
          </label>
          <label>
            Versiones especiales (separadas por coma)
            <input
              value={criterio.especiales}
              onChange={(e) => {
                setCriterio({ ...criterio, especiales: e.target.value });
              }}
            />
          </label>
          <label>
            Tipo de cambio para convertir a HNL
            <input
              inputMode="decimal"
              value={criterio.tipoCambio}
              onChange={(e) => {
                setCriterio({ ...criterio, tipoCambio: e.target.value });
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel" aria-label="Resultado de mercado">
        <h2>Promedio de comparables</h2>
        {typeof criterioValido === 'string' ? (
          <p>{criterioValido}</p>
        ) : resultado === null ? null : (
          <>
            <dl className="resumen-compra">
              <dt>Promedio</dt>
              <dd>{mostrarUsd(resultado.promedioUsd)}</dd>
              <dt>Promedio en HNL</dt>
              <dd>
                {resultado.promedioUsd !== null && tipoCambio !== null
                  ? `L ${formatearMonto(resultado.promedioUsd.times(tipoCambio))}`
                  : 'Requiere tipo de cambio'}
              </dd>
              <dt>Muestras con precio</dt>
              <dd>{resultado.muestras}</dd>
              <dt>Sin precio (excluidas)</dt>
              <dd>{resultado.sinPrecio}</dd>
              <dt>Versiones especiales aisladas</dt>
              <dd>
                {resultado.aisladas} · {mostrarUsd(resultado.promedioAisladasUsd)}
              </dd>
              <dt>Fecha más antigua</dt>
              <dd>{resultado.fechaMasAntigua ?? '—'}</dd>
              <dt>Fecha más reciente</dt>
              <dd>{resultado.fechaMasReciente ?? '—'}</dd>
            </dl>
            <p className="nota">Criterios aplicados: {resultado.criterios.join(' · ') || 'ninguno'}</p>
            <button
              type="button"
              onClick={() => {
                void usarMediaComoSugerencia();
              }}
              disabled={sugerido === null || ocupado}
            >
              Usar la media como precio objetivo sugerido
            </button>
            {sugerido === null && <small> Requiere promedio y tipo de cambio.</small>}
          </>
        )}
      </section>

      <section className="panel" aria-label="Precios objetivo">
        <h2>Precio final objetivo</h2>
        {objetivos.length === 0 ? (
          <p>No hay precios objetivo.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Precio objetivo (HNL)</th>
                <th>Origen</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {objetivos.map((o) => (
                <FilaObjetivo
                  key={`${o.id}-${String(o.precio_objetivo)}`}
                  objetivo={o}
                  deshabilitado={ocupado}
                  alGuardar={(precio) =>
                    escribir(
                      () =>
                        supabase
                          .from('sale_price_targets')
                          .update({ precio_objetivo: precio, origen: 'manual' })
                          .eq('id', o.id),
                      'Precio objetivo actualizado.',
                      'No se pudo actualizar el precio objetivo.',
                    )
                  }
                  alEliminar={() =>
                    escribir(
                      () => supabase.from('sale_price_targets').delete().eq('id', o.id),
                      'Precio objetivo eliminado.',
                      'No se pudo eliminar el precio objetivo.',
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        )}
        <form className="formulario-linea" onSubmit={(e) => void agregarObjetivoManual(e)}>
          <input
            aria-label="Marca del precio objetivo"
            placeholder="Marca"
            value={objetivoMarca}
            onChange={(e) => {
              setObjetivoMarca(e.target.value);
            }}
          />
          <input
            aria-label="Modelo del precio objetivo"
            placeholder="Modelo"
            value={objetivoModelo}
            onChange={(e) => {
              setObjetivoModelo(e.target.value);
            }}
          />
          <input
            aria-label="Precio objetivo en HNL"
            placeholder="Precio HNL"
            inputMode="decimal"
            value={objetivoPrecio}
            onChange={(e) => {
              setObjetivoPrecio(e.target.value);
            }}
          />
          <button type="submit" disabled={ocupado}>
            Agregar precio objetivo
          </button>
        </form>
      </section>

      <section className="panel" aria-label="Captura de observación">
        <h2>Nueva observación</h2>
        <form className="formulario-cuadricula" onSubmit={(e) => void guardarObservacion(e)}>
          <label>
            Marca
            <input
              value={formObs.marca}
              onChange={(e) => {
                setFormObs({ ...formObs, marca: e.target.value });
              }}
            />
          </label>
          <label>
            Modelo
            <input
              value={formObs.modelo}
              onChange={(e) => {
                setFormObs({ ...formObs, modelo: e.target.value });
              }}
            />
          </label>
          <label>
            Alias de modelo (opcional)
            <input
              value={formObs.alias}
              onChange={(e) => {
                setFormObs({ ...formObs, alias: e.target.value });
              }}
            />
          </label>
          <label>
            Versión
            <input
              value={formObs.version}
              onChange={(e) => {
                setFormObs({ ...formObs, version: e.target.value });
              }}
            />
          </label>
          <label>
            Año
            <input
              inputMode="numeric"
              value={formObs.anio}
              onChange={(e) => {
                setFormObs({ ...formObs, anio: e.target.value });
              }}
            />
          </label>
          <label>
            Precio (USD, vacío si se desconoce)
            <input
              inputMode="decimal"
              value={formObs.precio}
              onChange={(e) => {
                setFormObs({ ...formObs, precio: e.target.value });
              }}
            />
          </label>
          <label>
            Motor
            <input
              value={formObs.motor}
              onChange={(e) => {
                setFormObs({ ...formObs, motor: e.target.value });
              }}
            />
          </label>
          <label>
            Tracción
            <input
              value={formObs.traccion}
              onChange={(e) => {
                setFormObs({ ...formObs, traccion: e.target.value });
              }}
            />
          </label>
          <label>
            Millas
            <input
              inputMode="numeric"
              value={formObs.millas}
              onChange={(e) => {
                setFormObs({ ...formObs, millas: e.target.value });
              }}
            />
          </label>
          <label>
            Fecha de consulta
            <input
              type="date"
              value={formObs.fecha}
              onChange={(e) => {
                setFormObs({ ...formObs, fecha: e.target.value });
              }}
            />
          </label>
          <label>
            Ubicación
            <input
              value={formObs.ubicacion}
              onChange={(e) => {
                setFormObs({ ...formObs, ubicacion: e.target.value });
              }}
            />
          </label>
          <label>
            Enlace de referencia
            <input
              type="url"
              value={formObs.enlace}
              onChange={(e) => {
                setFormObs({ ...formObs, enlace: e.target.value });
              }}
            />
          </label>
          <label className="linea">
            <input
              type="checkbox"
              checked={formObs.recienIngreso}
              onChange={(e) => {
                setFormObs({ ...formObs, recienIngreso: e.target.checked });
              }}
            />
            Recién ingresado
          </label>
          <div className="acciones ancho-completo">
            <button type="submit" disabled={ocupado}>
              Guardar observación
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-label="Observaciones">
        <h2>Observaciones ({observaciones.length})</h2>
        {observaciones.length === 0 ? (
          <p>No hay observaciones capturadas.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Versión</th>
                <th>Precio USD</th>
                <th>Fecha</th>
                <th>En el promedio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {observaciones.map((o) => {
                const precio = valorDecimal(o.precio_usd);
                return (
                  <tr key={o.id}>
                    <td>
                      {[o.marca, o.modelo, o.anio].filter((x) => x !== null && x !== '').join(' ')}
                      {o.recien_ingreso && <small> · recién ingresado</small>}
                    </td>
                    <td>{o.version ?? '—'}</td>
                    <td>{precio === null || precio.lte(0) ? 'Sin precio' : formatearMonto(precio)}</td>
                    <td>{o.fecha_consulta ?? '—'}</td>
                    <td>{resultado === null ? '—' : incluidas.has(o.id) ? 'Sí' : 'No'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          void eliminarObservacion(o.id);
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
      </section>
    </section>
  );
}

function FilaObjetivo({
  objetivo,
  deshabilitado,
  alGuardar,
  alEliminar,
}: {
  objetivo: ObjetivoDb;
  deshabilitado: boolean;
  alGuardar: (precio: string) => Promise<boolean>;
  alEliminar: () => Promise<boolean>;
}) {
  const [precio, setPrecio] = useState(objetivo.precio_objetivo === null ? '' : String(objetivo.precio_objetivo));
  const [local, setLocal] = useState<string | null>(null);

  async function guardar() {
    const valor = valorDecimal(precio.trim());
    if (valor === null || valor.lt(0)) {
      setLocal('El precio debe ser un número igual o mayor que cero.');
      return;
    }
    setLocal(null);
    await alGuardar(valor.toString());
  }

  return (
    <tr>
      <td>{objetivo.marca}</td>
      <td>{objetivo.modelo}</td>
      <td>
        <input
          aria-label={`Precio objetivo de ${objetivo.marca} ${objetivo.modelo}`}
          inputMode="decimal"
          value={precio}
          onChange={(e) => {
            setPrecio(e.target.value);
          }}
        />
        {local && <small role="alert"> {local}</small>}
      </td>
      <td>{ORIGEN_ETIQUETA[objetivo.origen]}</td>
      <td>{objetivo.fecha ?? '—'}</td>
      <td>
        <button
          type="button"
          onClick={() => {
            void guardar();
          }}
          disabled={deshabilitado}
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => {
            void alEliminar();
          }}
          disabled={deshabilitado}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}
