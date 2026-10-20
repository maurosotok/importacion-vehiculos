alter table public.part_supplier_offers
  add column cantidad numeric(12,3) not null default 1 check (cantidad > 0),
  add column condicion text;

alter table public.purchase_expenses
  add column lugar text,
  add column notas text;

alter table public.purchase_expenses drop constraint purchase_expenses_concepto_check;
alter table public.purchase_expenses add constraint purchase_expenses_concepto_check check (concepto in (
  'grua', 'barco', 'papeleria', 'carro', 'buyer_fee', 'bac_fees', 'paypal_fee',
  'bank_receiver_fee', 'impuestos_salida', 'repuesto', 'servicio', 'gasolina_aceite',
  'mano_obra', 'pintura', 'otro'
));

alter table public.purchase_expenses
  add constraint gasto_reparto_con_motivo check (monto_total_referencia is null or motivo_reparto is not null),
  add constraint gasto_reparto_no_excede check (monto_total_referencia is null or monto <= monto_total_referencia);

alter table public.purchases
  add column presupuesto_reparacion_hnl numeric(18,4) check (presupuesto_reparacion_hnl is null or presupuesto_reparacion_hnl >= 0),
  add column contingencia_hnl numeric(18,4) check (contingencia_hnl is null or contingencia_hnl >= 0),
  add column redondear_presupuesto_5000 boolean not null default false,
  add column tipo_cambio_origen_hnl_por_usd numeric(12,6) check (tipo_cambio_origen_hnl_por_usd is null or tipo_cambio_origen_hnl_por_usd >= 0);

create unique index compra_unica_por_cotizacion on public.purchases (quote_id);

create or replace function public.marcar_comprado(p_quote_id uuid, p_motor_version text, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_compra uuid;
  v_revision uuid;
  v_numero integer;
begin
  if auth.uid() is null or not public.es_propietario() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select q.owner_id into v_owner
    from public.quotes q
    where q.id = p_quote_id and q.owner_id = auth.uid()
    for update;
  if not found then
    raise exception 'Cotización no encontrada' using errcode = 'P0002';
  end if;

  select c.id into v_compra from public.purchases c where c.quote_id = p_quote_id;
  if found then
    return v_compra;
  end if;

  if jsonb_typeof(p_snapshot) is distinct from 'object' or p_snapshot ->> 'version' is distinct from '1' then
    raise exception 'Revisión inválida' using errcode = '22023';
  end if;

  select coalesce(max(r.numero), 0) + 1 into v_numero
    from public.quote_revisions r
    where r.quote_id = p_quote_id;

  insert into public.quote_revisions (
    owner_id, quote_id, numero, motor_version, snapshot,
    tipo_cambio_hnl_por_usd, total_importado_hnl, total_importado_usd_equivalente, utilidad_estimada_hnl
  ) values (
    v_owner, p_quote_id, v_numero, p_motor_version, p_snapshot,
    (p_snapshot #>> '{entradas,tipoCambioHnlPorUsd}')::numeric,
    (p_snapshot #>> '{resultado,importadoHnl}')::numeric,
    (p_snapshot #>> '{resultado,importadoUsdEquivalente}')::numeric,
    (p_snapshot #>> '{resultado,utilidadHnl}')::numeric
  ) returning id into v_revision;

  insert into public.purchases (
    owner_id, quote_id, revision_id, presupuesto_reparacion_hnl, tipo_cambio_origen_hnl_por_usd
  ) values (
    v_owner, p_quote_id, v_revision,
    (p_snapshot #>> '{entradas,reparacionHnl}')::numeric,
    (p_snapshot #>> '{entradas,tipoCambioHnlPorUsd}')::numeric
  ) returning id into v_compra;

  update public.quotes set estado = 'comprada' where id = p_quote_id;

  return v_compra;
end;
$$;

revoke all on function public.marcar_comprado(uuid, text, jsonb) from public, anon;
grant execute on function public.marcar_comprado(uuid, text, jsonb) to authenticated;
