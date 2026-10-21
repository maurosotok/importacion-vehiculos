-- Corrección de nueve tarifas de grúa según el PDF North Atlantic (decisión del usuario, 2026-10-21).
-- Idempotente: solo cambia filas que aún tienen el importe anterior del Excel. Si el usuario editó
-- una tarifa a mano, la fila no coincide y se avisa en lugar de sobrescribirla.
-- No modifica cotizaciones: cada cotización conserva su grua_usd y grua_referencia_clave guardados.

alter table public.towing_rates
  add column if not exists alias_sedes jsonb not null default '[]'::jsonb,
  add column if not exists monto_usd_anterior numeric(18,4),
  add column if not exists fuente_tarifa text,
  add column if not exists pdf_pagina integer,
  add column if not exists version_tarifa text;

update public.towing_rates t
set monto_usd = c.nuevo,
    monto_usd_anterior = c.anterior,
    fuente_tarifa = 'pdf_north_atlantic',
    pdf_pagina = c.pagina,
    version_tarifa = '2026-10-21-pdf'
from (values
  ('NA-XLSX-GRUAS-0056', 165.00::numeric, 275.00::numeric, 4),
  ('NA-XLSX-GRUAS-0078', 200.00::numeric, 225.00::numeric, 7),
  ('NA-XLSX-GRUAS-0079', 200.00::numeric, 210.00::numeric, 7),
  ('NA-XLSX-GRUAS-0089', 220.00::numeric, 225.00::numeric, 7),
  ('NA-XLSX-GRUAS-0093', 225.00::numeric, 350.00::numeric, 7),
  ('NA-XLSX-GRUAS-0095', 225.00::numeric, 265.00::numeric, 7),
  ('NA-XLSX-GRUAS-0101', 250.00::numeric, 200.00::numeric, 7),
  ('NA-XLSX-GRUAS-0121', 270.00::numeric, 325.00::numeric, 6),
  ('NA-XLSX-GRUAS-0165', 350.00::numeric, 500.00::numeric, 6)
) as c(clave, anterior, nuevo, pagina)
where t.clave = c.clave
  and t.monto_usd = c.anterior;

do $$
declare
  r record;
begin
  for r in
    select c.clave
    from (values
      ('NA-XLSX-GRUAS-0056', 165.00::numeric, 275.00::numeric),
      ('NA-XLSX-GRUAS-0078', 200.00::numeric, 225.00::numeric),
      ('NA-XLSX-GRUAS-0079', 200.00::numeric, 210.00::numeric),
      ('NA-XLSX-GRUAS-0089', 220.00::numeric, 225.00::numeric),
      ('NA-XLSX-GRUAS-0093', 225.00::numeric, 350.00::numeric),
      ('NA-XLSX-GRUAS-0095', 225.00::numeric, 265.00::numeric),
      ('NA-XLSX-GRUAS-0101', 250.00::numeric, 200.00::numeric),
      ('NA-XLSX-GRUAS-0121', 270.00::numeric, 325.00::numeric),
      ('NA-XLSX-GRUAS-0165', 350.00::numeric, 500.00::numeric)
    ) as c(clave, anterior, nuevo)
    where not exists (
      select 1 from public.towing_rates t
      where t.clave = c.clave and t.monto_usd in (c.anterior, c.nuevo)
    )
  loop
    raise notice 'towing_rates %: no coincide con el importe esperado; revisar a mano sin sobrescribir', r.clave;
  end loop;
end $$;

update public.towing_rates
set alias_sedes = '[{"sede":"NASHVILLE","estado":"TN","subastas":["IAA","COPART"],"fuente":"confirmacion_usuario_2026-10-21"}]'::jsonb
where clave = 'NA-XLSX-GRUAS-0238'
  and alias_sedes = '[]'::jsonb;
