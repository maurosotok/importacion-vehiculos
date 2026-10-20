import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const clavePublicable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const configuracionCompleta = Boolean(url && clavePublicable);

export const supabase = createClient(url || 'https://sin-configurar.invalid', clavePublicable || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
});
