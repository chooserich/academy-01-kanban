"use client"

import * as React from "react"
import Link from "next/link"
import { LoaderCircleIcon, MailCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type AuthMode = "sign-in" | "sign-up"

export function LoginForm({
  configured,
  initialMessage,
}: {
  configured: boolean
  initialMessage?: string
}) {
  const router = useRouter()
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), [])
  const [mode, setMode] = React.useState<AuthMode>("sign-in")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState(initialMessage ?? "")
  const [isError, setIsError] = React.useState(Boolean(initialMessage))
  const [confirmationEmail, setConfirmationEmail] = React.useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) {
      setMessage("Supabase Auth is not configured for this environment.")
      setIsError(true)
      return
    }

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")

    setIsSubmitting(true)
    setMessage("")
    setIsError(false)

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setMessage(error.message)
        setIsError(true)
        setIsSubmitting(false)
        return
      }

      router.replace("/dashboard")
      router.refresh()
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    if (error) {
      setMessage(error.message)
      setIsError(true)
      setIsSubmitting(false)
      return
    }

    if (data.session) {
      router.replace("/dashboard")
      router.refresh()
      return
    }

    setConfirmationEmail(email)
    setIsSubmitting(false)
  }

  if (confirmationEmail) {
    return (
      <div aria-live="polite" className="grid gap-5 py-2" role="status">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
          <MailCheckIcon className="size-5" />
        </div>
        <div className="grid gap-2">
          <h2 className="font-heading text-lg font-semibold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to
          </p>
          <p className="break-all text-sm font-medium text-foreground">
            {confirmationEmail}
          </p>
          <p className="text-sm text-muted-foreground">
            Open the link to confirm your account and continue to your private board.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            setConfirmationEmail("")
            setMode("sign-in")
            setMessage("")
            setIsError(false)
          }}
          type="button"
          variant="outline"
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <Tabs
      onValueChange={(value) => {
        if (value === "sign-in" || value === "sign-up") {
          setMode(value)
          setMessage("")
          setIsError(false)
        }
      }}
      value={mode}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sign-in">Sign in</TabsTrigger>
        <TabsTrigger value="sign-up">Create account</TabsTrigger>
      </TabsList>
      <TabsContent value="sign-in">
        <AuthFields
          configured={configured}
          isSubmitting={isSubmitting}
          message={message}
          isError={isError}
          mode="sign-in"
          onSubmit={handleSubmit}
        />
      </TabsContent>
      <TabsContent value="sign-up">
        <AuthFields
          configured={configured}
          isSubmitting={isSubmitting}
          message={message}
          isError={isError}
          mode="sign-up"
          onSubmit={handleSubmit}
        />
      </TabsContent>
    </Tabs>
  )
}

function AuthFields({
  configured,
  isError,
  isSubmitting,
  message,
  mode,
  onSubmit,
}: {
  configured: boolean
  isError: boolean
  isSubmitting: boolean
  message: string
  mode: AuthMode
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input
          autoComplete="email"
          disabled={!configured || isSubmitting}
          id={`${mode}-email`}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${mode}-password`}>Password</Label>
          {mode === "sign-in" ? (
            <Link
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <Input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          disabled={!configured || isSubmitting}
          id={`${mode}-password`}
          minLength={8}
          name="password"
          required
          type="password"
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
      {!configured ? (
        <p className="text-sm text-destructive">
          Add the public Supabase URL and publishable key to enable sign in.
        </p>
      ) : null}
      <Button className="w-full" disabled={!configured || isSubmitting} type="submit">
        {isSubmitting ? <LoaderCircleIcon className="animate-spin" /> : null}
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  )
}
