import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env'

/**
 * Supabase admin client using Service Role Key — bypasses RLS.
 * Used only for server-side operations that require elevated access
 * (e.g., Storage uploads). Returns null if the key is not configured.
 *
 * LGPD / ISO 27001: this client has full DB access.
 * Use exclusively for trusted server-side code, never in the frontend.
 */
export function getSupabaseAdmin() {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.SUPABASE_URL
  if (!serviceKey || !url) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db:   { schema: 'public' },
  })
}
