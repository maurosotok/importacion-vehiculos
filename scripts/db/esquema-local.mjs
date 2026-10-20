import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CARPETA_MIGRACIONES, listarMigraciones } from './verificar-migraciones.mjs';

export const STUB_AUTH = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''),
    ''
  )::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
`;

export async function aplicarMigraciones(cliente) {
  await cliente.query(STUB_AUTH);
  const { nombres, problemas } = await listarMigraciones();
  if (problemas.length > 0) throw new Error(problemas.join('\n'));
  for (const nombre of nombres) {
    await cliente.query(await readFile(path.join(CARPETA_MIGRACIONES, nombre), 'utf8'));
  }
  return nombres;
}
