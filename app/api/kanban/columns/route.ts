import { createColumnInSupabase } from "@/lib/kanban/supabase-store"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    title?: unknown
  } | null
  const title = typeof body?.title === "string" ? body.title.trim() : ""

  if (!title) {
    return Response.json(
      { message: "Column name is required." },
      { status: 400 }
    )
  }

  if (title.length > 50) {
    return Response.json(
      { message: "Column names must be 50 characters or fewer." },
      { status: 400 }
    )
  }

  try {
    const board = await createColumnInSupabase(title)
    return Response.json({ board })
  } catch (error) {
    console.error("Failed to create Supabase column", error)
    return Response.json(
      { message: "Failed to create the column in Supabase." },
      { status: 500 }
    )
  }
}
