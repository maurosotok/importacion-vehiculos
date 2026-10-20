import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { VERSION_CONSTRUIDA } from './build.ts';

const cabeceras = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function respuesta(cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

Deno.serve(async (peticion) => {
  const autorizacion = peticion.headers.get('authorization') ?? '';
  if (!autorizacion.startsWith('Bearer ')) return respuesta({ error: 'no_autenticado' }, 401);
  const token = autorizacion.slice('Bearer '.length);

  const url = Deno.env.get('SUPABASE_URL');
  const claveAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !claveAnon) return respuesta({ error: 'configuracion_incompleta' }, 500);

  const cliente = createClient(url, claveAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usuario, error: errorUsuario } = await cliente.auth.getUser(token);
  if (errorUsuario || !usuario.user) return respuesta({ error: 'no_autenticado' }, 401);

  const { data: propietario, error: errorPropietario } = await cliente
    .from('app_owner')
    .select('user_id')
    .eq('user_id', usuario.user.id)
    .maybeSingle();
  if (errorPropietario) return respuesta({ error: 'fallo_consulta' }, 500);
  if (!propietario) return respuesta({ error: 'sin_acceso' }, 403);

  return respuesta({ version: VERSION_CONSTRUIDA }, 200);
});
