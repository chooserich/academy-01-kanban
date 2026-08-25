import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DEFAULT_BOARD_ID,
  DEFAULT_BOARD_NAME,
  DEFAULT_COLUMNS,
  createColumnKey,
  initialBoard,
  type BoardState,
  type MovePlacement,
} from "@/lib/kanban/board"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type DbBoard = {
  id: string
  name: string
}

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

export class ColumnMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function getSupabaseOrThrow() {
  const supabase = createSupabaseAdminClient()

  if (!supabase) {
    throw new SupabaseConfigurationError()
  }

  return supabase
}

function defaultColumnRows() {
  return DEFAULT_COLUMNS.map((column, position) => ({
    ...column,
    board_id: DEFAULT_BOARD_ID,
    position,
  }))
}

function defaultTaskRows() {
  return initialBoard.columns.flatMap((column) =>
    column.tasks.map((task, position) => ({
      id: task.id,
      board_id: DEFAULT_BOARD_ID,
      column_id: column.id,
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

async function ensureDefaultBoard(supabase: SupabaseClient): Promise<DbBoard> {
  const { data: existingBoard, error: boardLookupError } = await supabase
    .from("boards")
    .select("id, name")
    .eq("id", DEFAULT_BOARD_ID)
    .maybeSingle<DbBoard>()

  if (boardLookupError) {
    throw boardLookupError
  }

  let board = existingBoard

  if (!board) {
    const { data, error } = await supabase
      .from("boards")
      .insert({ id: DEFAULT_BOARD_ID, name: DEFAULT_BOARD_NAME })
      .select("id, name")
      .single<DbBoard>()

    if (error) {
      throw error
    }

    board = data
  }

  const { count: columnCount, error: columnCountError } = await supabase
    .from("board_columns")
    .select("id", { count: "exact", head: true })
    .eq("board_id", DEFAULT_BOARD_ID)

  if (columnCountError) {
    throw columnCountError
  }

  if (columnCount === 0) {
    await throwOnError(await supabase.from("board_columns").insert(defaultColumnRows()))
    await throwOnError(await supabase.from("tasks").insert(defaultTaskRows()))
  }

  return board
}

async function getColumnById(supabase: SupabaseClient, columnId: string) {
  const { data, error } = await supabase
    .from("board_columns")
    .select("id, key, title, position")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("id", columnId)
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

async function compactBoardColumns(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .order("position", { ascending: true })

  if (error) {
    throw error
  }

  for (const [position, column] of (data ?? []).entries()) {
    await throwOnError(
      supabase
        .from("board_columns")
        .update({ position })
        .eq("board_id", DEFAULT_BOARD_ID)
        .eq("id", column.id)
    )
  }
}

export async function listBoardFromSupabase(): Promise<BoardState> {
  const supabase = getSupabaseOrThrow()
  const board = await ensureDefaultBoard(supabase)

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

  const tasksByColumnId = new Map<string, DbTask[]>()

  for (const task of tasks ?? []) {
    const columnTasks = tasksByColumnId.get(task.column_id) ?? []
    columnTasks.push(task)
    tasksByColumnId.set(task.column_id, columnTasks)
  }

  return {
    id: board.id,
    name: board.name,
    columns: (columns ?? []).map((column) => ({
      id: column.id,
      key: column.key,
      title: column.title,
      tasks: (tasksByColumnId.get(column.id) ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description ?? "",
        createdAt: task.created_at,
      })),
    })),
  }
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

  const { data: firstColumn, error: firstColumnError } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .order("position", { ascending: true })
    .limit(1)
    .single<{ id: string }>()

  if (firstColumnError) {
    throw firstColumnError
  }

  const { data: latestTask, error: latestTaskError } = await supabase
    .from("tasks")
    .select("position")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("column_id", firstColumn.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>()

  if (latestTaskError) {
    throw latestTaskError
  }

  await throwOnError(
    await supabase.from("tasks").insert({
      board_id: DEFAULT_BOARD_ID,
      column_id: firstColumn.id,
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

export async function clearColumnTasksInSupabase(columnId: string) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)
  await getColumnById(supabase, columnId)

  await throwOnError(
    await supabase
      .from("tasks")
      .delete()
      .eq("board_id", DEFAULT_BOARD_ID)
      .eq("column_id", columnId)
  )

  return listBoardFromSupabase()
}

export async function resetBoardInSupabase() {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  await throwOnError(
    await supabase.from("tasks").delete().eq("board_id", DEFAULT_BOARD_ID)
  )
  await throwOnError(
    await supabase.from("board_columns").delete().eq("board_id", DEFAULT_BOARD_ID)
  )
  await throwOnError(await supabase.from("board_columns").insert(defaultColumnRows()))
  await throwOnError(await supabase.from("tasks").insert(defaultTaskRows()))

  return listBoardFromSupabase()
}

export async function createColumnInSupabase(title: string) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const { data: columns, error } = await supabase
    .from("board_columns")
    .select("key, position")
    .eq("board_id", DEFAULT_BOARD_ID)
    .order("position", { ascending: true })
    .returns<Array<{ key: string; position: number }>>()

  if (error) {
    throw error
  }

  const key = createColumnKey(
    title,
    (columns ?? []).map((column) => column.key)
  )
  const position = columns?.length ?? 0

  await throwOnError(
    await supabase.from("board_columns").insert({
      board_id: DEFAULT_BOARD_ID,
      key,
      title,
      position,
    })
  )

  return listBoardFromSupabase()
}

export async function deleteColumnFromSupabase(columnId: string) {
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

  const column = columns?.find((item) => item.id === columnId)

  if (!column) {
    throw new ColumnMutationError("Column not found.", 404)
  }

  if ((columns?.length ?? 0) <= 1) {
    throw new ColumnMutationError("A board must keep at least one column.", 409)
  }

  const { data: firstTask, error: taskLookupError } = await supabase
    .from("tasks")
    .select("id")
    .eq("board_id", DEFAULT_BOARD_ID)
    .eq("column_id", columnId)
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (taskLookupError) {
    throw taskLookupError
  }

  if (firstTask) {
    throw new ColumnMutationError(
      "Move or delete this column's tasks before removing it.",
      409
    )
  }

  await throwOnError(
    await supabase
      .from("board_columns")
      .delete()
      .eq("board_id", DEFAULT_BOARD_ID)
      .eq("id", columnId)
  )
  await compactBoardColumns(supabase)

  return listBoardFromSupabase()
}

export async function reorderColumnsInSupabase(columnIds: string[]) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const { error } = await supabase.rpc("reorder_board_columns", {
    p_board_id: DEFAULT_BOARD_ID,
    p_column_ids: columnIds,
  })

  if (error) {
    throw error
  }

  return listBoardFromSupabase()
}

export async function moveTaskInSupabase({
  beforeTaskId,
  placement,
  targetColumnId,
  taskId,
}: {
  taskId: string
  targetColumnId: string
  placement: MovePlacement
  beforeTaskId?: string | null
}) {
  const supabase = getSupabaseOrThrow()
  await ensureDefaultBoard(supabase)

  const targetColumn = await getColumnById(supabase, targetColumnId)
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
