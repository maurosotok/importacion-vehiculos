import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Acceso() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (evento: { preventDefault: () => void }) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    const { error: fallo } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (fallo) setError('No se pudo iniciar sesión. Revise correo y clave.');
  };

  return (
    <main className="pantalla-central">
      <form
        className="acceso"
        onSubmit={(evento) => {
          void entrar(evento);
        }}
      >
        <h1>Cotizador Honduras</h1>
        <label>
          Correo
          <input
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value);
            }}
            required
            autoFocus
          />
        </label>
        <label>
          Clave
          <input
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => {
              setClave(e.target.value);
            }}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
