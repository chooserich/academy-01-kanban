import { resetBoardInSupabase } from "@/lib/kanban/supabase-store"

export async function POST() {
  try {
    const board = await resetBoardInSupabase()

    return Response.json({ board })
  } catch (error) {
    console.error("Failed to reset Supabase board", error)

    return Response.json(
      { message: "Failed to reset the Supabase board." },
      { status: 500 }
    )
  }
}
