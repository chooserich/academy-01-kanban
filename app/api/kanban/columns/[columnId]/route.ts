import {
  ColumnMutationError,
  deleteColumnFromSupabase,
} from "@/lib/kanban/supabase-store"

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

    console.error("Failed to delete Supabase column", error)
    return Response.json(
      { message: "Failed to delete the column in Supabase." },
      { status: 500 }
    )
  }
}
