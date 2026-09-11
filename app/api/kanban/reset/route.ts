import { resetBoardInSupabase } from "@/lib/kanban/supabase-store"
import { kanbanErrorResponse } from "@/lib/kanban/api"

export async function POST() {
  try {
    const board = await resetBoardInSupabase()

    return Response.json({ board })
  } catch (error) {
    return kanbanErrorResponse(
      error,
      "Failed to reset Supabase board",
      "Failed to reset the Supabase board."
    )
  }
}
