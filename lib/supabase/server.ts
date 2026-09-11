import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function getSupabaseConfigStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return {
    isConfigured: Boolean(url && publishableKey),
    hasPublishableKey: Boolean(publishableKey),
    hasUrl: Boolean(url),
    publishableKey,
    url,
  }
}

export async function createSupabaseServerClient() {
  const { isConfigured, publishableKey, url } = getSupabaseConfigStatus()

  if (!isConfigured || !url || !publishableKey) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes them.
        }
      },
    },
  })
}
