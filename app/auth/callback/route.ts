import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = safeNextPath(requestUrl.searchParams.get("next"))
  const supabase = await createSupabaseServerClient()

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  const errorType = next === "/update-password" ? "recovery" : "confirmation"
  return NextResponse.redirect(new URL(`/login?error=${errorType}`, requestUrl.origin))
}
