import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const missingSupabaseEnv = [
  supabaseUrl ? null : "VITE_SUPABASE_URL",
  supabasePublishableKey ? null : "VITE_SUPABASE_PUBLISHABLE_KEY",
].filter(Boolean) as string[]

export const isSupabaseConfigured = missingSupabaseEnv.length === 0

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      `Chybí Supabase env proměnné: ${missingSupabaseEnv.join(", ")}.`
    )
  }

  return supabase
}
