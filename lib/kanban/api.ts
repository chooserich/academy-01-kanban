import {
  AuthenticationRequiredError,
  SupabaseConfigurationError,
} from "@/lib/supabase/auth"

export function kanbanErrorResponse(
  error: unknown,
  logMessage: string,
  publicMessage: string
) {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ message: error.message }, { status: 401 })
  }

  if (error instanceof SupabaseConfigurationError) {
    return Response.json({ message: error.message }, { status: 503 })
  }

  console.error(logMessage, error)
  return Response.json({ message: publicMessage }, { status: 500 })
}
