import { AuthShell } from "@/components/auth-shell"
import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { getSupabaseConfigStatus } from "@/lib/supabase/server"

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="We will email you a secure link to choose a new password."
      title="Reset your password"
    >
      <ForgotPasswordForm configured={getSupabaseConfigStatus().isConfigured} />
    </AuthShell>
  )
}
