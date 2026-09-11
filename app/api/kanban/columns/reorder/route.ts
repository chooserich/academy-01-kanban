import { reorderColumnsInSupabase } from "@/lib/kanban/supabase-store"
import { kanbanErrorResponse } from "@/lib/kanban/api"

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    columnIds?: unknown
  } | null
  const rawColumnIds = body?.columnIds
  const columnIds = Array.isArray(rawColumnIds)
    ? rawColumnIds.filter((value): value is string => typeof value === "string")
    : []

  if (
    !columnIds.length ||
    columnIds.length !== (Array.isArray(rawColumnIds) ? rawColumnIds.length : 0) ||
    new Set(columnIds).size !== columnIds.length
  ) {
    return Response.json(
      { message: "A complete, unique column order is required." },
      { status: 400 }
    )
  }

  try {
    const board = await reorderColumnsInSupabase(columnIds)
    return Response.json({ board })
  } catch (error) {
    return kanbanErrorResponse(
      error,
      "Failed to reorder Supabase columns",
      "Failed to reorder the columns in Supabase."
    )
  }
}
