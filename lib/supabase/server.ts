import { createClient } from "@supabase/supabase-js"

export function getSupabaseConfigStatus() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  return {
    isConfigured: Boolean(url && serviceRoleKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasUrl: Boolean(url),
    url,
  }
}

export function createSupabaseAdminClient() {
  const { isConfigured, serviceRoleKey, url } = {
    ...getSupabaseConfigStatus(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  if (!isConfigured || !url || !serviceRoleKey) {
    return null
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
