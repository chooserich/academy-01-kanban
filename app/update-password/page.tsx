import { AuthShell } from "@/components/auth-shell"
import { UpdatePasswordForm } from "@/components/update-password-form"
import { requirePageUser } from "@/lib/supabase/auth"

export default async function UpdatePasswordPage() {
  await requirePageUser()

  return (
    <AuthShell
      description="Use at least eight characters for your new password."
      title="Choose a new password"
    >
      <UpdatePasswordForm />
    </AuthShell>
  )
}
