import { deleteTaskFromSupabase } from "@/lib/kanban/supabase-store"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params

  try {
    const board = await deleteTaskFromSupabase(taskId)

    return Response.json({ board })
  } catch (error) {
    console.error("Failed to delete Supabase task", error)

    return Response.json(
      { message: "Failed to delete the task in Supabase." },
      { status: 500 }
    )
  }
}
