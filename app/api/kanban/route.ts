import { getSupabaseConfigStatus } from "@/lib/supabase/server"
import { kanbanErrorResponse } from "@/lib/kanban/api"
import { listBoardFromSupabase } from "@/lib/kanban/supabase-store"

export async function GET() {
  const config = getSupabaseConfigStatus()

  if (!config.isConfigured) {
    return Response.json(
      {
        configured: false,
        message:
          "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      },
      { status: 503 }
    )
  }

  try {
    const board = await listBoardFromSupabase()

    return Response.json({
      board,
      configured: true,
    })
  } catch (error) {
    return kanbanErrorResponse(
      error,
      "Failed to load Supabase board",
      "Failed to load the Supabase board."
    )
  }
}
