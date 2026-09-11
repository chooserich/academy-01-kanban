import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { getSupabaseConfigStatus } from "@/lib/supabase/server"

export async function refreshSupabaseSession(request: NextRequest) {
  const { isConfigured, publishableKey, url } = getSupabaseConfigStatus()
  let response = NextResponse.next({ request })

  if (!isConfigured || !url || !publishableKey) {
    return response
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.getClaims()

  return response
}
