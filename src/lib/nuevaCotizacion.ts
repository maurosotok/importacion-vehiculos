import { GASTOS_LOCALES_PREDETERMINADOS_HNL } from '../motor/predeterminados';
import { supabase } from './supabase';

const PAPELERIA_PREDETERMINADA_USD = '15';

export type ResultadoNuevaCotizacion = { id: string } | { error: string };

export async function crearCotizacion(vin: string | null): Promise<ResultadoNuevaCotizacion> {
  const [{ data: ajustes }, { data: predeterminado }] = await Promise.all([
    supabase
      .from('user_settings')
      .select(
        'perfil_fees_clave, gastos_locales_predeterminado_hnl, papeleria_predeterminada_usd, tipo_cambio_predeterminado_hnl_por_usd',
      )
      .maybeSingle(),
    supabase.from('fee_profiles').select('clave').eq('es_predeterminado', true).eq('seleccionable', true).maybeSingle(),
  ]);
  const { data: vehiculo, error: errorVehiculo } = await supabase.from('vehicles').insert({ vin }).select('id').single();
  if (errorVehiculo) return { error: 'No se pudo crear el vehículo.' };
  const { data: cotizacion, error: errorCotizacion } = await supabase
    .from('quotes')
    .insert({
      vehicle_id: vehiculo.id,
      subasta: 'IAA',
      perfil_fees_clave: ajustes?.perfil_fees_clave ?? predeterminado?.clave ?? null,
      modo_fees: 'tabla',
      modo_impuestos: 'desglose',
      gastos_locales_hnl: ajustes?.gastos_locales_predeterminado_hnl ?? GASTOS_LOCALES_PREDETERMINADOS_HNL,
      papeleria_usd: ajustes?.papeleria_predeterminada_usd ?? PAPELERIA_PREDETERMINADA_USD,
      tipo_cambio_hnl_por_usd: ajustes?.tipo_cambio_predeterminado_hnl_por_usd ?? null,
    })
    .select('id')
    .single();
  if (errorCotizacion) return { error: 'No se pudo crear la cotización.' };
  return { id: cotizacion.id as string };
}
