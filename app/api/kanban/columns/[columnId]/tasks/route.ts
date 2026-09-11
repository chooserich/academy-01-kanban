import { clearColumnTasksInSupabase } from "@/lib/kanban/supabase-store"
import { kanbanErrorResponse } from "@/lib/kanban/api"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ columnId: string }> }
) {
  const { columnId } = await params

  try {
    const board = await clearColumnTasksInSupabase(columnId)
    return Response.json({ board })
  } catch (error) {
    return kanbanErrorResponse(
      error,
      "Failed to clear Supabase column",
      "Failed to clear the column in Supabase."
    )
  }
}
