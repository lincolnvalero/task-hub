import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios.')
}

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db:   { schema: 'public' },
})
