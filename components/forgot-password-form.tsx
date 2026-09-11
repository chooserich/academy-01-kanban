"use client"

import * as React from "react"
import Link from "next/link"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [isError, setIsError] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) {
      setMessage("Supabase Auth is not configured for this environment.")
      setIsError(true)
      return
    }

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    setIsSubmitting(true)
    setMessage("")
    setIsError(false)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    })

    if (error) {
      setMessage(error.message)
      setIsError(true)
    } else {
      setMessage("If an account exists for that email, a reset link is on its way.")
    }

    setIsSubmitting(false)
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          autoComplete="email"
          disabled={!configured || isSubmitting}
          id="recovery-email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      {message ? (
        <p
          aria-live="polite"
          className={isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message}
        </p>
      ) : null}
      <Button className="w-full" disabled={!configured || isSubmitting} type="submit">
        {isSubmitting ? <LoaderCircleIcon className="animate-spin" /> : null}
        Send reset link
      </Button>
      <Button className="w-full" render={<Link href="/login" />} variant="ghost">
        Back to sign in
      </Button>
    </form>
  )
}
