import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth-shell"
import { LoginForm } from "@/components/login-form"
import { createSupabaseServerClient, getSupabaseConfigStatus } from "@/lib/supabase/server"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const { error: queryError } = await searchParams

  if (supabase) {
    const { data } = await supabase.auth.getClaims()

    if (data?.claims?.sub) {
      redirect("/dashboard")
    }
  }

  return (
    <AuthShell
      description="Use your email and password to open your private board."
      title="Your private board"
    >
      <LoginForm
        configured={getSupabaseConfigStatus().isConfigured}
        initialMessage={
          queryError === "confirmation"
            ? "That confirmation link is invalid or has expired."
            : queryError === "recovery"
              ? "That password reset link is invalid or has expired."
              : undefined
        }
      />
    </AuthShell>
  )
}
