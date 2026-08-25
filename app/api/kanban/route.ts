import { getSupabaseConfigStatus } from "@/lib/supabase/server"
import {
  SupabaseConfigurationError,
  listBoardFromSupabase,
} from "@/lib/kanban/supabase-store"

export async function GET() {
  const config = getSupabaseConfigStatus()

  if (!config.isConfigured) {
    return Response.json({
      configured: false,
      message:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable database persistence.",
    })
  }

  try {
    const board = await listBoardFromSupabase()

    return Response.json({
      board,
      configured: true,
    })
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return Response.json(
        {
          configured: false,
          message: error.message,
        },
        { status: 503 }
      )
    }

    console.error("Failed to load Supabase board", error)

    return Response.json(
      {
        configured: true,
        message: "Failed to load the Supabase board.",
      },
      { status: 500 }
    )
  }
}
