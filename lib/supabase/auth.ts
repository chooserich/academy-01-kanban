import type { SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    )
  }
}

export class AuthenticationRequiredError extends Error {
  status = 401

  constructor() {
    super("Sign in to access this board.")
  }
}

export type AuthenticatedSupabaseContext = {
  email: string
  supabase: SupabaseClient
  userId: string
}

export async function getAuthenticatedSupabaseContext(): Promise<AuthenticatedSupabaseContext> {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    throw new SupabaseConfigurationError()
  }

  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const userId = typeof claims?.sub === "string" ? claims.sub : ""

  if (error || !userId) {
    throw new AuthenticationRequiredError()
  }

  return {
    email:
      typeof claims?.email === "string" ? claims.email : "Signed-in user",
    supabase,
    userId,
  }
}

export async function requirePageUser() {
  try {
    return await getAuthenticatedSupabaseContext()
  } catch {
    redirect("/login")
  }
}
