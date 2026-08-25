import type { SupabaseClient } from "@supabase/supabase-js"

import {
  COLUMN_ORDER,
  COLUMN_TITLES,
  DEFAULT_BOARD_ID,
  DEFAULT_BOARD_NAME,
  DEFAULT_COLUMN_IDS,
  createEmptyBoard,
  initialBoard,
  isColumnId,
  type BoardState,
  type ColumnId,
  type MovePlacement,
} from "@/lib/kanban/board"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type DbColumn = {
  id: string
  key: string
  title: string
  position: number
}

type DbTask = {
  id: string
  column_id: string
  title: string
  description: string | null
  position: number
  created_at: string
}

type SupabaseMutationResponse = {
  error: unknown | null
}

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    )
  }
}

function getSupabaseOrThrow() {
  const supabase = createSupabaseAdminClient()

  if (!supabase) {
    throw new SupabaseConfigurationError()
  }

  return supabase
}

function defaultTaskRows() {
  return COLUMN_ORDER.flatMap((columnId) =>
    initialBoard[columnId].map((task, position) => ({
      id: task.id,
      board_id: DEFAULT_BOARD_ID,
      column_id: DEFAULT_COLUMN_IDS[columnId],
      title: task.title,
      description: task.description,
      position,
      created_at: task.createdAt,
      updated_at: task.createdAt,
    }))
  )
}

async function throwOnError(
  response: PromiseLike<SupabaseMutationResponse> | SupabaseMutationResponse
) {
  const result = await response

  if (result.error) {
    throw result.error
  }
}

async function ensureDefaultBoard(supabase: SupabaseClient) {
  await throwOnError(
    await supabase.from("boards").upsert(
      {
        id: DEFAULT_BOARD_ID,
        name: DEFAULT_BOARD_NAME,
      },
      { onConflict: "id" }
    )
  )

  await throwOnError(
    await supabase.from("board_columns").upsert(
      COLUMN_ORDER.map((columnId, position) => ({
        id: DEFAULT_COLUMN_IDS[columnId],
        board_id: DEFAULT_BOARD_ID,
        key: columnId,
        title: COLUMN_TITLES[columnId],
        position,
      })),
      { onConflict: "id" }
    )
  )

  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("board_id", DEFAULT_BOARD_ID)

  if (error) {
    throw error
  }

  if (count === 0) {
    await throwOnError(await supabase.from("tasks").insert(defaultTaskRows()))
  }
}

async function getColumnByKey(supabase: SupabaseClient, columnId: ColumnId) {
  const { data, error } = await supabase
    .from("board_columns")
    .select("id, key, title, position")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("key", columnId)
    .single<DbColumn>()

  if (error) {
    throw error
  }

  return data
}

async function compactColumn(supabase: SupabaseClient, columnId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("column_id", columnId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  await Promise.all(
    (data ?? []).map((task, position) =>
      throwOnError(
        supabase.from("tasks").update({ position }).eq("id", task.id)
      )
    )
  )
}

export async function listBoardFromSupabase(): Promise<BoardState> {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const { data: columns, error: columnsError } = await supabase
    .from("board_columns")
    .select("id, key, title, position")
    .eq("board_id", DEFAULT_BOARD_ID)
    .order("position", { ascending: true })
    .returns<DbColumn[]>()

  if (columnsError) {
    throw columnsError
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, column_id, title, description, position, created_at")
    .eq("board_id", DEFAULT_BOARD_ID)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<DbTask[]>()

  if (tasksError) {
    throw tasksError
  }

  const columnKeyById = new Map(
    (columns ?? [])
      .filter((column) => isColumnId(column.key))
      .map((column) => [column.id, column.key as ColumnId])
  )
  const board = createEmptyBoard()

  for (const task of tasks ?? []) {
    const columnId = columnKeyById.get(task.column_id)

    if (!columnId) {
      continue
    }

    board[columnId].push({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      createdAt: task.created_at,
    })
  }

  return board
}

export async function createTaskInSupabase({
  description,
  title,
}: {
  title: string
  description: string
}) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const ideasColumn = await getColumnByKey(supabase, "ideas")
  const { data: latestTask, error: latestTaskError } = await supabase
    .from("tasks")
    .select("position")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("column_id", ideasColumn.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>()

  if (latestTaskError) {
    throw latestTaskError
  }

  await throwOnError(
    await supabase.from("tasks").insert({
      board_id: DEFAULT_BOARD_ID,
      column_id: ideasColumn.id,
      title,
      description,
      position: (latestTask?.position ?? -1) + 1,
    })
  )

  return listBoardFromSupabase()
}

export async function deleteTaskFromSupabase(taskId: string) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("column_id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("id", taskId)
    .maybeSingle<{ column_id: string }>()

  if (taskError) {
    throw taskError
  }

  await throwOnError(
    await supabase
      .from("tasks")
      .delete()
      .eq("board_id", DEFAULT_BOARD_ID)
      .eq("id", taskId)
  )

  if (task?.column_id) {
    await compactColumn(supabase, task.column_id)
  }

  return listBoardFromSupabase()
}

export async function clearDoneTasksInSupabase() {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  await throwOnError(
    await supabase
      .from("tasks")
      .delete()
      .eq("board_id", DEFAULT_BOARD_ID)
      .eq("column_id", DEFAULT_COLUMN_IDS.done)
  )

  return listBoardFromSupabase()
}

export async function resetBoardInSupabase() {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  await throwOnError(
    await supabase.from("tasks").delete().eq("board_id", DEFAULT_BOARD_ID)
  )
  await throwOnError(await supabase.from("tasks").insert(defaultTaskRows()))

  return listBoardFromSupabase()
}

export async function moveTaskInSupabase({
  beforeTaskId,
  placement,
  targetColumnId,
  taskId,
}: {
  taskId: string
  targetColumnId: ColumnId
  placement: MovePlacement
  beforeTaskId?: string | null
}) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const targetColumn = await getColumnByKey(supabase, targetColumnId)
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, column_id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("id", taskId)
    .single<{ id: string; column_id: string }>()

  if (taskError) {
    throw taskError
  }

  const sourceColumnId = task.column_id
  const { data: targetTasks, error: targetTasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("column_id", targetColumn.id)
    .neq("id", taskId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<{ id: string }[]>()

  if (targetTasksError) {
    throw targetTasksError
  }

  const targetTaskIds = (targetTasks ?? []).map((item) => item.id)
  let insertAt = 0

  if (placement === "end") {
    insertAt = targetTaskIds.length
  } else if (placement === "before" && beforeTaskId) {
    const beforeIndex = targetTaskIds.indexOf(beforeTaskId)
    insertAt = beforeIndex >= 0 ? beforeIndex : targetTaskIds.length
  }

  const orderedTargetTaskIds = [
    ...targetTaskIds.slice(0, insertAt),
    taskId,
    ...targetTaskIds.slice(insertAt),
  ]

  await throwOnError(
    await supabase
      .from("tasks")
      .update({ column_id: targetColumn.id })
      .eq("board_id", DEFAULT_BOARD_ID)
      .eq("id", taskId)
  )

  await Promise.all(
    orderedTargetTaskIds.map((id, position) =>
      throwOnError(
        supabase
          .from("tasks")
          .update({ column_id: targetColumn.id, position })
          .eq("board_id", DEFAULT_BOARD_ID)
          .eq("id", id)
      )
    )
  )

  if (sourceColumnId !== targetColumn.id) {
    await compactColumn(supabase, sourceColumnId)
  }

  return listBoardFromSupabase()
}
