"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export function UpdatePasswordForm() {
  const router = useRouter()
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) {
      setMessage("Supabase Auth is not configured for this environment.")
      return
    }

    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirmation = String(form.get("password-confirmation") ?? "")

    if (password !== confirmation) {
      setMessage("The passwords do not match.")
      return
    }

    setIsSubmitting(true)
    setMessage("")
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(error.message)
      setIsSubmitting(false)
      return
    }

    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          autoComplete="new-password"
          disabled={isSubmitting}
          id="new-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password-confirmation">Confirm new password</Label>
        <Input
          autoComplete="new-password"
          disabled={isSubmitting}
          id="password-confirmation"
          minLength={8}
          name="password-confirmation"
          required
          type="password"
        />
      </div>
      {message ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? <LoaderCircleIcon className="animate-spin" /> : null}
        Save password
      </Button>
    </form>
  )
}
