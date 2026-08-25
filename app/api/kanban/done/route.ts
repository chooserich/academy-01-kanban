import { clearDoneTasksInSupabase } from "@/lib/kanban/supabase-store"

export async function DELETE() {
  try {
    const board = await clearDoneTasksInSupabase()

    return Response.json({ board })
  } catch (error) {
    console.error("Failed to clear done Supabase tasks", error)

    return Response.json(
      { message: "Failed to clear Done tasks in Supabase." },
      { status: 500 }
    )
  }
}
