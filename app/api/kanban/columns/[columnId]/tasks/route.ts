import { clearColumnTasksInSupabase } from "@/lib/kanban/supabase-store"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ columnId: string }> }
) {
  const { columnId } = await params

  try {
    const board = await clearColumnTasksInSupabase(columnId)
    return Response.json({ board })
  } catch (error) {
    console.error("Failed to clear Supabase column", error)
    return Response.json(
      { message: "Failed to clear the column in Supabase." },
      { status: 500 }
    )
  }
}
