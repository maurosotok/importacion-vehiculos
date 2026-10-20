import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import Decimal from 'decimal.js';
import { supabase } from '../lib/supabase';
import { aCsv } from '../motor/csv';
import { filtrarPorBusqueda } from '../motor/busqueda';
import { valorDecimal } from '../motor/calculo';
import { borradorGastoDesdeOferta, ofertasYaConvertidas, type OfertaParaGasto } from '../motor/compra';
import {
  construirMatriz,
  type CeldaRepuesto,
  type FilaRepuesto,
  type OfertaRepuesto,
} from '../motor/repuestos';
import { moverPosicion, type Posicion } from '../lib/navegacion';

type Proveedor = {
  id: string;
  nombre: string;
  clasificacion: string | null;
  pais: string | null;
  telefono_proporcionado: string | null;
  telefono_verificado: boolean;
};

type Pieza = {
  id: string;
  pieza: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
};

type OfertaFila = {
  id: string;
  item_id: string;
  supplier_id: string;
  estado: 'cotizado' | 'no_disponible' | 'sin_consultar';
  precio: string | null;
  moneda: 'USD' | 'HNL';
  cantidad: string;
  disponibilidad: string | null;
  fecha_oferta: string | null;
  condicion: string | null;
  notas: string | null;
};

type CompraFila = {
  id: string;
  quotes: {
    referencia: string | null;
    vehicles: { marca: string | null; modelo: string | null; anio: number | null } | null;
  } | null;
};

type Compra = { id: string; etiqueta: string };

type Seleccion = { itemId: string; supplierId: string };

type BorradorOferta = {
  estado: OfertaFila['estado'];
  precio: string;
  moneda: 'USD' | 'HNL';
  cantidad: string;
  disponibilidad: string;
  fecha: string;
  condicion: string;
  notas: string;
};

const ETIQUETA_CLASIFICACION: Record<string, string> = { china: 'China', yonker: 'Yonker', otro: 'Otro' };
const TECLAS_MATRIZ = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function borradorVacio(): BorradorOferta {
  return {
    estado: 'cotizado',
    precio: '',
    moneda: 'USD',
    cantidad: '1',
    disponibilidad: '',
    fecha: '',
    condicion: '',
    notas: '',
  };
}

function borradorDesde(oferta: OfertaFila | undefined): BorradorOferta {
  if (oferta === undefined) return borradorVacio();
  return {
    estado: oferta.estado,
    precio: oferta.precio ?? '',
    moneda: oferta.moneda,
    cantidad: oferta.cantidad,
    disponibilidad: oferta.disponibilidad ?? '',
    fecha: oferta.fecha_oferta ?? '',
    condicion: oferta.condicion ?? '',
    notas: oferta.notas ?? '',
  };
}

function aMotor(oferta: OfertaFila): OfertaRepuesto {
  return {
    id: oferta.id,
    itemId: oferta.item_id,
    supplierId: oferta.supplier_id,
    estado: oferta.estado,
    precio: oferta.precio,
    moneda: oferta.moneda,
    cantidad: oferta.cantidad,
    disponibilidad: oferta.disponibilidad,
    fechaOferta: oferta.fecha_oferta,
    condicion: oferta.condicion,
    notas: oferta.notas,
  };
}

function textoCelda(celda: CeldaRepuesto | undefined): string {
  if (celda === undefined) return '';
  switch (celda.estado) {
    case 'vacia':
      return '';
    case 'no_disponible':
      return 'No';
    case 'sin_precio':
      return 'Sin precio';
    case 'precio_cero':
      return 'Cero (no comparable)';
    case 'cotizado': {
      const precio = celda.precio?.toFixed(2, Decimal.ROUND_HALF_UP) ?? '';
      const cantidad = celda.cantidad !== null && !celda.cantidad.eq(1) ? ` x${celda.cantidad.toString()}` : '';
      const mejor = celda.destacada ? ' (más bajo)' : '';
      return `${precio} ${celda.moneda ?? ''}${cantidad}${mejor}`;
    }
  }
}

function claseCelda(celda: CeldaRepuesto | undefined): string {
  const base = 'celda';
  if (celda === undefined) return base;
  if (celda.destacada) return `${base} celda-mejor`;
  if (celda.estado === 'no_disponible') return `${base} celda-no`;
  if (celda.estado === 'precio_cero' || celda.estado === 'sin_precio') return `${base} celda-aviso`;
  if (celda.estado === 'vacia') return `${base} celda-vacia`;
  return base;
}

export function Repuestos() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [ofertas, setOfertas] = useState<OfertaFila[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [convertidas, setConvertidas] = useState<Set<string>>(new Set());
  const [cargado, setCargado] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [consulta, setConsulta] = useState('');
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [borrador, setBorrador] = useState<BorradorOferta>(borradorVacio());
  const [compraElegida, setCompraElegida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [foco, setFoco] = useState<Posicion>({ fila: 0, columna: 0 });
  const matrizRef = useRef<HTMLDivElement>(null);

  const [nuevaPieza, setNuevaPieza] = useState({ pieza: '', marca: '', modelo: '', anio: '' });

  useEffect(() => {
    let vigente = true;
    void Promise.all([
      supabase
        .from('suppliers')
        .select('id, nombre, clasificacion, pais, telefono_proporcionado, telefono_verificado')
        .order('nombre'),
      supabase.from('part_quote_items').select('id, pieza, marca, modelo, anio').order('created_at'),
      supabase
        .from('part_supplier_offers')
        .select('id, item_id, supplier_id, estado, precio, moneda, cantidad, disponibilidad, fecha_oferta, condicion, notas'),
      supabase.from('purchases').select('id, quotes(referencia, vehicles(marca, modelo, anio))'),
      supabase.from('purchase_expenses').select('oferta_repuesto_id').not('oferta_repuesto_id', 'is', null),
    ]).then(([prov, pie, ofe, comp, gas]) => {
      if (!vigente) return;
      const fallo = prov.error ?? pie.error ?? ofe.error ?? comp.error ?? gas.error;
      if (fallo) {
        setError('No se pudieron cargar los datos de repuestos.');
        setCargado(true);
        return;
      }
      setProveedores(prov.data ?? []);
      setPiezas(pie.data ?? []);
      setOfertas(ofe.data ?? []);
      const filasCompra = (comp.data ?? []) as unknown as CompraFila[];
      setCompras(
        filasCompra.map((c) => {
          const v = c.quotes?.vehicles;
          const partes = [v?.marca, v?.modelo, v?.anio?.toString(), c.quotes?.referencia].filter(Boolean);
          return { id: c.id, etiqueta: partes.length > 0 ? partes.join(' · ') : c.id };
        }),
      );
      const gastos = (gas.data ?? []) as { oferta_repuesto_id: string | null }[];
      setConvertidas(ofertasYaConvertidas(gastos.map((g) => ({ ofertaRepuestoId: g.oferta_repuesto_id }))));
      setCargado(true);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  const proveedoresPorId = useMemo(() => new Map(proveedores.map((p) => [p.id, p])), [proveedores]);

  const piezasVisibles = useMemo(
    () =>
      filtrarPorBusqueda(piezas, consulta, (p) => [
        p.pieza,
        p.marca,
        p.modelo,
        p.anio?.toString(),
        ...ofertas
          .filter((o) => o.item_id === p.id)
          .flatMap((o) => {
            const prov = proveedoresPorId.get(o.supplier_id);
            return [prov?.nombre, prov?.pais];
          }),
      ]),
    [piezas, consulta, ofertas, proveedoresPorId],
  );

  const matriz: FilaRepuesto[] = useMemo(
    () =>
      construirMatriz(
        piezasVisibles.map((p) => p.id),
        proveedores.map((p) => p.id),
        ofertas.map(aMotor),
      ),
    [piezasVisibles, proveedores, ofertas],
  );

  const celdaPara = (itemId: string, proveedorId: string): CeldaRepuesto | undefined =>
    matrizPorPieza.get(itemId)?.celdas.get(proveedorId);

  const matrizPorPieza = new Map(matriz.map((f) => [f.itemId, f] as const));

  const ofertaSeleccionada = seleccion
    ? ofertas.find((o) => o.item_id === seleccion.itemId && o.supplier_id === seleccion.supplierId)
    : undefined;
  const piezaSeleccionada = seleccion ? piezas.find((p) => p.id === seleccion.itemId) : undefined;
  const proveedorSeleccionado = seleccion ? proveedoresPorId.get(seleccion.supplierId) : undefined;

  function abrirEditor(itemId: string, supplierId: string) {
    const existente = ofertas.find((o) => o.item_id === itemId && o.supplier_id === supplierId);
    setSeleccion({ itemId, supplierId });
    setBorrador(borradorDesde(existente));
    setCompraElegida(compras[0]?.id ?? '');
    setMensaje(null);
    setError(null);
  }

  function abrirDesdeTeclado(fila: number, columna: number) {
    const pieza = piezasVisibles[fila];
    const proveedor = proveedores[columna];
    if (!pieza || !proveedor) return;
    setFoco({ fila, columna });
    abrirEditor(pieza.id, proveedor.id);
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (!TECLAS_MATRIZ.includes(evento.key)) return;
    evento.preventDefault();
    const nuevo = moverPosicion(foco, { filas: piezasVisibles.length, columnas: proveedores.length }, evento.key);
    setFoco(nuevo);
    matrizRef.current
      ?.querySelector<HTMLButtonElement>(`[data-pos="${String(nuevo.fila)}-${String(nuevo.columna)}"]`)
      ?.focus();
  }

  async function guardarOferta(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!seleccion || enviando) return;
    const precioTexto = borrador.precio.trim();
    const precio = valorDecimal(precioTexto === '' ? null : precioTexto);
    const cantidad = valorDecimal(borrador.cantidad.trim());
    if (borrador.estado === 'cotizado' && precioTexto !== '' && (precio === null || precio.lt(0))) {
      setError('El precio debe ser un número igual o mayor que cero.');
      return;
    }
    if (cantidad === null || !cantidad.gt(0)) {
      setError('La cantidad debe ser mayor que cero.');
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: fallo } = await supabase.from('part_supplier_offers').upsert(
      {
        item_id: seleccion.itemId,
        supplier_id: seleccion.supplierId,
        estado: borrador.estado,
        precio: borrador.estado === 'cotizado' && precio !== null ? precio.toString() : null,
        moneda: borrador.moneda,
        cantidad: cantidad.toString(),
        disponibilidad: borrador.disponibilidad.trim() || null,
        fecha_oferta: borrador.fecha || null,
        condicion: borrador.condicion.trim() || null,
        notas: borrador.notas.trim() || null,
      },
      { onConflict: 'item_id,supplier_id' },
    );
    setEnviando(false);
    if (fallo) {
      setError('No se pudo guardar la oferta.');
      return;
    }
    setMensaje('Oferta guardada.');
    setVersion((v) => v + 1);
  }

  async function convertirEnGasto() {
    if (!ofertaSeleccionada || !compraElegida || enviando) return;
    const oferta: OfertaParaGasto = {
      id: ofertaSeleccionada.id,
      estado: ofertaSeleccionada.estado,
      precio: ofertaSeleccionada.precio,
      cantidad: ofertaSeleccionada.cantidad,
      moneda: ofertaSeleccionada.moneda,
      pieza: piezaSeleccionada?.pieza ?? '',
      proveedor: proveedorSeleccionado?.nombre ?? '',
    };
    const resultado = borradorGastoDesdeOferta(oferta);
    if (!resultado.ok) {
      setError(`La oferta no se puede convertir (${resultado.motivo.replace('_', ' ')}).`);
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: fallo } = await supabase.from('purchase_expenses').insert({
      purchase_id: compraElegida,
      concepto: 'repuesto',
      descripcion: resultado.borrador.descripcion,
      lugar: resultado.borrador.lugar,
      monto: resultado.borrador.monto,
      moneda: resultado.borrador.moneda,
      estimado: false,
      oferta_repuesto_id: resultado.borrador.ofertaRepuestoId,
    });
    setEnviando(false);
    if (fallo) {
      setError(
        fallo.code === '23505'
          ? 'Esta oferta ya tiene un gasto. No se duplica.'
          : 'No se pudo crear el gasto desde la oferta.',
      );
      return;
    }
    setMensaje('Gasto creado en la compra. La oferta no cambió.');
    setVersion((v) => v + 1);
  }

  async function agregarPieza(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const pieza = nuevaPieza.pieza.trim();
    if (pieza === '') {
      setError('Escriba el nombre de la pieza.');
      return;
    }
    const anio = nuevaPieza.anio.trim() === '' ? null : Number(nuevaPieza.anio);
    if (anio !== null && (!Number.isInteger(anio) || anio < 1900 || anio > 2100)) {
      setError('El año debe estar entre 1900 y 2100.');
      return;
    }
    const { error: fallo } = await supabase.from('part_quote_items').insert({
      pieza,
      marca: nuevaPieza.marca.trim() || null,
      modelo: nuevaPieza.modelo.trim() || null,
      anio,
    });
    if (fallo) {
      setError('No se pudo agregar la pieza.');
      return;
    }
    setNuevaPieza({ pieza: '', marca: '', modelo: '', anio: '' });
    setError(null);
    setVersion((v) => v + 1);
  }

  async function cambiarClasificacion(proveedorId: string, valor: string) {
    const { error: fallo } = await supabase
      .from('suppliers')
      .update({ clasificacion: valor === '' ? null : valor })
      .eq('id', proveedorId);
    if (fallo) {
      setError('No se pudo cambiar la clasificación.');
      return;
    }
    setVersion((v) => v + 1);
  }

  function exportarCsv() {
    const cabecera = ['Pieza', 'Marca', 'Modelo', 'Año', ...proveedores.map((p) => p.nombre)];
    const filas = piezasVisibles.map((p) => [
      p.pieza,
      p.marca,
      p.modelo,
      p.anio,
      ...proveedores.map((prov) => textoCelda(celdaPara(p.id, prov.id))),
    ]);
    const blob = new Blob([aCsv([cabecera, ...filas])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'repuestos.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  if (!cargado) return <p>Cargando…</p>;

  return (
    <section>
      <div className="encabezado-seccion">
        <h1>Repuestos</h1>
        <button type="button" onClick={exportarCsv} disabled={piezasVisibles.length === 0}>
          Exportar CSV
        </button>
      </div>
      <p className="nota">
        Nombres y contactos de proveedores tal como se aportaron; no verificados. "No" significa no disponible;
        celda vacía significa sin consultar. Los precios se comparan solo con ofertas de la misma moneda y cantidad.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}

      <div className="barra-herramientas">
        <label>
          Buscar pieza, vehículo o proveedor
          <input
            type="search"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
            }}
          />
        </label>
      </div>

      {piezas.length === 0 && <p>No hay piezas. Agregue una para empezar a comparar ofertas.</p>}

      {piezasVisibles.length > 0 && (
        <>
          <div className="matriz-contenedor solo-escritorio" ref={matrizRef} onKeyDown={alTeclear}>
            <table className="matriz" aria-label="Ofertas por pieza y proveedor">

              <thead>
                <tr>
                  <th scope="col">Pieza</th>
                  {proveedores.map((p) => (
                    <th scope="col" key={p.id}>
                      {p.nombre}
                      {p.clasificacion && <small> · {ETIQUETA_CLASIFICACION[p.clasificacion] ?? p.clasificacion}</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {piezasVisibles.map((pieza, fila) => (
                  <tr key={pieza.id}>
                    <th scope="row">
                      {pieza.pieza}
                      <small>
                        {' '}
                        {[pieza.marca, pieza.modelo, pieza.anio].filter((x) => x !== null && x !== '').join(' ')}
                      </small>
                    </th>
                    {proveedores.map((prov, columna) => {
                      const celda = celdaPara(pieza.id, prov.id);
                      const enFoco = foco.fila === fila && foco.columna === columna;
                      return (
                        <td key={prov.id} className={claseCelda(celda)}>
                          <button
                            type="button"
                            data-pos={`${String(fila)}-${String(columna)}`}
                            tabIndex={enFoco ? 0 : -1}
                          aria-label={`${pieza.pieza}, ${prov.nombre}: ${textoCelda(celda) || 'sin consultar'}`}
                            onFocus={() => {
                              setFoco({ fila, columna });
                            }}
                            onClick={() => {
                              abrirDesdeTeclado(fila, columna);
                            }}
                          >
                            {textoCelda(celda) || '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="lista-piezas solo-movil">
            {piezasVisibles.map((pieza) => (
              <li key={pieza.id}>
                <h2>{pieza.pieza}</h2>
                <ul>
                  {proveedores.map((prov) => {
                    const celda = celdaPara(pieza.id, prov.id);
                    return (
                      <li key={prov.id} className={claseCelda(celda)}>
                        <button
                          type="button"
                          onClick={() => {
                            abrirEditor(pieza.id, prov.id);
                          }}
                        >
                          {prov.nombre}: {textoCelda(celda) || 'Sin consultar'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {seleccion && piezaSeleccionada && proveedorSeleccionado && (
        <section className="panel" aria-label="Editar oferta">
          <h2>
            {piezaSeleccionada.pieza} · {proveedorSeleccionado.nombre}
          </h2>
          <form onSubmit={(e) => void guardarOferta(e)} className="formulario-cuadricula">
            <label>
              Estado
              <select
                value={borrador.estado}
                onChange={(e) => {
                  setBorrador({ ...borrador, estado: e.target.value as OfertaFila['estado'] });
                }}
              >
                <option value="cotizado">Cotizado</option>
                <option value="no_disponible">No disponible</option>
                <option value="sin_consultar">Sin consultar</option>
              </select>
            </label>
            <label>
              Precio unitario
              <input
                inputMode="decimal"
                value={borrador.precio}
                disabled={borrador.estado !== 'cotizado'}
                onChange={(e) => {
                  setBorrador({ ...borrador, precio: e.target.value });
                }}
              />
            </label>
            <label>
              Moneda
              <select
                value={borrador.moneda}
                onChange={(e) => {
                  setBorrador({ ...borrador, moneda: e.target.value as 'USD' | 'HNL' });
                }}
              >
                <option value="USD">USD</option>
                <option value="HNL">HNL</option>
              </select>
            </label>
            <label>
              Cantidad
              <input
                inputMode="decimal"
                value={borrador.cantidad}
                onChange={(e) => {
                  setBorrador({ ...borrador, cantidad: e.target.value });
                }}
              />
            </label>
            <label>
              Disponibilidad
              <input
                value={borrador.disponibilidad}
                onChange={(e) => {
                  setBorrador({ ...borrador, disponibilidad: e.target.value });
                }}
              />
            </label>
            <label>
              Fecha de oferta
              <input
                type="date"
                value={borrador.fecha}
                onChange={(e) => {
                  setBorrador({ ...borrador, fecha: e.target.value });
                }}
              />
            </label>
            <label>
              Condición
              <input
                value={borrador.condicion}
                onChange={(e) => {
                  setBorrador({ ...borrador, condicion: e.target.value });
                }}
              />
            </label>
            <label className="ancho-completo">
              Notas
              <input
                value={borrador.notas}
                onChange={(e) => {
                  setBorrador({ ...borrador, notas: e.target.value });
                }}
              />
            </label>
            <div className="acciones ancho-completo">
              <button type="submit" disabled={enviando}>
                Guardar oferta
              </button>
              <button
                type="button"
                onClick={() => {
                  setSeleccion(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </form>

          {ofertaSeleccionada && ofertaSeleccionada.estado === 'cotizado' && (
            <div className="convertir">
              {convertidas.has(ofertaSeleccionada.id) ? (
                <p>Esta oferta ya es un gasto de compra. Edítelo desde la compra correspondiente.</p>
              ) : compras.length === 0 ? (
                <p>Para convertir en gasto primero marque un vehículo como comprado.</p>
              ) : (
                <>
                  <label>
                    Compra
                    <select
                      value={compraElegida}
                      onChange={(e) => {
                        setCompraElegida(e.target.value);
                      }}
                    >
                      {compras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => void convertirEnGasto()} disabled={enviando}>
                    Convertir en gasto (una sola vez)
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <form className="formulario-linea" onSubmit={(e) => void agregarPieza(e)}>
        <h2>Agregar pieza</h2>
        <input
          aria-label="Pieza"
          placeholder="Pieza"
          value={nuevaPieza.pieza}
          onChange={(e) => {
            setNuevaPieza({ ...nuevaPieza, pieza: e.target.value });
          }}
        />
        <input
          aria-label="Marca del vehículo"
          placeholder="Marca"
          value={nuevaPieza.marca}
          onChange={(e) => {
            setNuevaPieza({ ...nuevaPieza, marca: e.target.value });
          }}
        />
        <input
          aria-label="Modelo del vehículo"
          placeholder="Modelo"
          value={nuevaPieza.modelo}
          onChange={(e) => {
            setNuevaPieza({ ...nuevaPieza, modelo: e.target.value });
          }}
        />
        <input
          aria-label="Año del vehículo"
          placeholder="Año"
          inputMode="numeric"
          value={nuevaPieza.anio}
          onChange={(e) => {
            setNuevaPieza({ ...nuevaPieza, anio: e.target.value });
          }}
        />
        <button type="submit">Agregar</button>
      </form>

      <details>
        <summary>Clasificación de proveedores</summary>
        <p className="nota">La clasificación la asigna el usuario; no se infiere del nombre.</p>
        <table className="tabla">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Clasificación</th>
              <th>País</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>
                  <select
                    aria-label={`Clasificación de ${p.nombre}`}
                    value={p.clasificacion ?? ''}
                    onChange={(e) => {
                      void cambiarClasificacion(p.id, e.target.value);
                    }}
                  >
                    <option value="">Sin clasificar</option>
                    <option value="china">China</option>
                    <option value="yonker">Yonker</option>
                    <option value="otro">Otro</option>
                  </select>
                </td>
                <td>{p.pais ?? 'Pendiente'}</td>
                <td>
                  {p.telefono_proporcionado ?? <span className="pendiente">Pendiente</span>}
                  {p.telefono_proporcionado && !p.telefono_verificado && <small> (no verificado)</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
