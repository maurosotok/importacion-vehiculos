import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configuracionCompleta, supabase } from './lib/supabase';
import { useRuta } from './lib/ruta';
import { Acceso } from './paginas/Acceso';
import { Vehiculos } from './paginas/Vehiculos';
import { Mercado } from './paginas/Mercado';
import { EditorCotizacion } from './paginas/EditorCotizacion';
import { Compra } from './paginas/Compra';
import { Repuestos } from './paginas/Repuestos';
import { Configuracion } from './paginas/Configuracion';
import { irA } from './lib/ruta';

type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'sin_sesion' }
  | { tipo: 'sin_permiso'; correo: string }
  | { tipo: 'propietario'; sesion: Session };

export function App() {
  const ruta = useRuta();
  const [estado, setEstado] = useState<EstadoSesion>(() =>
    configuracionCompleta ? { tipo: 'cargando' } : { tipo: 'sin_sesion' },
  );

  useEffect(() => {
    if (!configuracionCompleta) return;
    let vigente = true;
    const verificar = async (sesion: Session | null) => {
      if (!sesion) {
        if (vigente) setEstado({ tipo: 'sin_sesion' });
        return;
      }
      const { data, error } = await supabase
        .from('app_owner')
        .select('user_id')
        .eq('user_id', sesion.user.id)
        .maybeSingle();
      if (!vigente) return;
      if (error || !data) {
        setEstado({ tipo: 'sin_permiso', correo: sesion.user.email ?? '' });
        return;
      }
      setEstado({ tipo: 'propietario', sesion });
    };
    void supabase.auth.getSession().then(({ data }) => verificar(data.session));
    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      void verificar(sesion);
    });
    return () => {
      vigente = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  if (!configuracionCompleta) {
    return (
      <main className="pantalla-central">
        <h1>Cotizador Honduras</h1>
        <p>Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.</p>
      </main>
    );
  }

  if (estado.tipo === 'cargando') return <main className="pantalla-central">Cargando…</main>;
  if (estado.tipo === 'sin_sesion') return <Acceso />;
  if (estado.tipo === 'sin_permiso') {
    return (
      <main className="pantalla-central">
        <h1>Sin acceso</h1>
        <p>La cuenta {estado.correo} no está autorizada para esta aplicación.</p>
        <button
          type="button"
          onClick={() => {
            void supabase.auth.signOut();
          }}
        >
          Cerrar sesión
        </button>
      </main>
    );
  }

  const seccionActiva = ruta.nombre === 'cotizacion' || ruta.nombre === 'compra' || ruta.nombre === 'mercado' ? 'vehiculos' : ruta.nombre;
  const subseccionActiva = ruta.nombre === 'mercado' ? 'mercado' : 'cotizaciones';
  return (
    <div className="aplicacion">
      <header className="barra">
        <strong>Cotizador Honduras</strong>
        <nav aria-label="Principal">
          <button
            type="button"
            aria-current={seccionActiva === 'vehiculos'}
            onClick={() => {
              irA('#/vehiculos');
            }}
          >
            Vehículos
          </button>
          <button
            type="button"
            aria-current={seccionActiva === 'repuestos'}
            onClick={() => {
              irA('#/repuestos');
            }}
          >
            Repuestos
          </button>
          <button
            type="button"
            aria-current={seccionActiva === 'configuracion'}
            onClick={() => {
              irA('#/configuracion');
            }}
          >
            Configuración
          </button>
        </nav>
        <button
          type="button"
          onClick={() => {
            void supabase.auth.signOut();
          }}
        >
          Salir
        </button>
      </header>
      {seccionActiva === 'vehiculos' && (
        <nav className="subnav" aria-label="Vehículos">
          <button
            type="button"
            aria-current={subseccionActiva === 'cotizaciones'}
            onClick={() => {
              irA('#/vehiculos');
            }}
          >
            Cotizaciones
          </button>
          <button
            type="button"
            aria-current={subseccionActiva === 'mercado'}
            onClick={() => {
              irA('#/vehiculos/mercado');
            }}
          >
            Mercado
          </button>
          {ruta.nombre === 'cotizacion' && (
            <>
              <span className="subnav-separador" aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => {
                  irA(`#/vehiculos/${ruta.id}/compra`);
                }}
              >
                Compra
              </button>
            </>
          )}
          {ruta.nombre === 'compra' && (
            <>
              <span className="subnav-separador" aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => {
                  irA(`#/vehiculos/${ruta.id}`);
                }}
              >
                Cotización
              </button>
              <button type="button" aria-current="true">
                Compra
              </button>
            </>
          )}
        </nav>
      )}
      <main className="contenido">
        {ruta.nombre === 'vehiculos' && <Vehiculos />}
        {ruta.nombre === 'mercado' && <Mercado />}
        {ruta.nombre === 'cotizacion' && <EditorCotizacion key={ruta.id} id={ruta.id} />}
        {ruta.nombre === 'compra' && <Compra key={ruta.id} id={ruta.id} />}
        {ruta.nombre === 'repuestos' && <Repuestos />}
        {ruta.nombre === 'configuracion' && <Configuracion usuarioId={estado.sesion.user.id} />}
      </main>
    </div>
  );
}
