import {
  ColumnMutationError,
  deleteColumnFromSupabase,
} from "@/lib/kanban/supabase-store"
import { kanbanErrorResponse } from "@/lib/kanban/api"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ columnId: string }> }
) {
  const { columnId } = await params

  try {
    const board = await deleteColumnFromSupabase(columnId)
    return Response.json({ board })
  } catch (error) {
    if (error instanceof ColumnMutationError) {
      return Response.json({ message: error.message }, { status: error.status })
    }

    return kanbanErrorResponse(
      error,
      "Failed to delete Supabase column",
      "Failed to delete the column in Supabase."
    )
  }
}
