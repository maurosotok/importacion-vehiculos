import { useEffect, useState } from 'react';

export type Ruta =
  | { nombre: 'vehiculos' }
  | { nombre: 'cotizacion'; id: string }
  | { nombre: 'repuestos' }
  | { nombre: 'configuracion' };

export function leerRuta(hash: string): Ruta {
  const limpio = hash.replace(/^#\/?/, '');
  const [seccion, id] = limpio.split('/');
  if (seccion === 'vehiculos' && id) return { nombre: 'cotizacion', id: decodeURIComponent(id) };
  if (seccion === 'repuestos') return { nombre: 'repuestos' };
  if (seccion === 'configuracion') return { nombre: 'configuracion' };
  return { nombre: 'vehiculos' };
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(() => leerRuta(window.location.hash));
  useEffect(() => {
    const alCambiar = () => {
      setRuta(leerRuta(window.location.hash));
    };
    window.addEventListener('hashchange', alCambiar);
    return () => {
      window.removeEventListener('hashchange', alCambiar);
    };
  }, []);
  return ruta;
}

export function irA(destino: string): void {
  window.location.hash = destino;
}
