import {
  isColumnId,
  type MovePlacement,
} from "@/lib/kanban/board"
import { moveTaskInSupabase } from "@/lib/kanban/supabase-store"

function isMovePlacement(value: unknown): value is MovePlacement {
  return value === "start" || value === "end" || value === "before"
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params
  const body = (await request.json().catch(() => null)) as {
    beforeTaskId?: unknown
    placement?: unknown
    targetColumnId?: unknown
  } | null
  const targetColumnId =
    typeof body?.targetColumnId === "string" && isColumnId(body.targetColumnId)
      ? body.targetColumnId
      : null
  const placement = isMovePlacement(body?.placement) ? body.placement : "start"
  const beforeTaskId =
    typeof body?.beforeTaskId === "string" ? body.beforeTaskId : null

  if (!targetColumnId) {
    return Response.json(
      { message: "A valid target column is required." },
      { status: 400 }
    )
  }

  try {
    const board = await moveTaskInSupabase({
      beforeTaskId,
      placement,
      targetColumnId,
      taskId,
    })

    return Response.json({ board })
  } catch (error) {
    console.error("Failed to move Supabase task", error)

    return Response.json(
      { message: "Failed to move the task in Supabase." },
      { status: 500 }
    )
  }
}
