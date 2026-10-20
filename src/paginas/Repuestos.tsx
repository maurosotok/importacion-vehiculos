import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Proveedor = {
  id: string;
  nombre: string;
  clasificacion: string | null;
  pais: string | null;
  telefono_proporcionado: string | null;
  telefono_verificado: boolean;
};

const ETIQUETA_CLASIFICACION: Record<string, string> = { china: 'China', yonker: 'Yonker', otro: 'Otro' };

export function Repuestos() {
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void supabase
      .from('suppliers')
      .select('id, nombre, clasificacion, pais, telefono_proporcionado, telefono_verificado')
      .order('nombre')
      .then(({ data, error: fallo }) => {
        if (!vigente) return;
        if (fallo) {
          setError('No se pudieron cargar los proveedores.');
          return;
        }
        setProveedores(data);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <section>
      <div className="encabezado-seccion">
        <h1>Repuestos</h1>
      </div>
      <p className="nota">
        Cotización de repuestos llega en una entrega posterior. Aquí se muestra el catálogo de proveedores.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {proveedores === null && !error && <p>Cargando…</p>}
      {proveedores && proveedores.length === 0 && <p>No hay proveedores cargados.</p>}
      {proveedores && proveedores.length > 0 && (
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
            {proveedores.map((proveedor) => (
              <tr key={proveedor.id}>
                <td>{proveedor.nombre}</td>
                <td>{proveedor.clasificacion ? (ETIQUETA_CLASIFICACION[proveedor.clasificacion] ?? proveedor.clasificacion) : 'Pendiente'}</td>
                <td>{proveedor.pais ?? 'Pendiente'}</td>
                <td>
                  {proveedor.telefono_proporcionado ?? <span className="pendiente">Pendiente</span>}
                  {proveedor.telefono_proporcionado && !proveedor.telefono_verificado && (
                    <small> (no verificado)</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
