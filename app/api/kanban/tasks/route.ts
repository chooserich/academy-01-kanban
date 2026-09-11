import { createTaskInSupabase } from "@/lib/kanban/supabase-store"
import { kanbanErrorResponse } from "@/lib/kanban/api"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    description?: unknown
    title?: unknown
  } | null
  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const description =
    typeof body?.description === "string" ? body.description.trim() : ""

  if (!title) {
    return Response.json({ message: "Task title is required." }, { status: 400 })
  }

  try {
    const board = await createTaskInSupabase({ description, title })

    return Response.json({ board })
  } catch (error) {
    return kanbanErrorResponse(
      error,
      "Failed to create Supabase task",
      "Failed to create the task in Supabase."
    )
  }
}
