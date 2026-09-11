import { deleteTaskFromSupabase } from "@/lib/kanban/supabase-store"
import { kanbanErrorResponse } from "@/lib/kanban/api"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params

  try {
    const board = await deleteTaskFromSupabase(taskId)

    return Response.json({ board })
  } catch (error) {
    return kanbanErrorResponse(
      error,
      "Failed to delete Supabase task",
      "Failed to delete the task in Supabase."
    )
  }
}
