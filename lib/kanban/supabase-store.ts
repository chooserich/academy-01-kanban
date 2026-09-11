import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createColumnKey,
  type BoardState,
  type MovePlacement,
} from "@/lib/kanban/board"
import { getAuthenticatedSupabaseContext } from "@/lib/supabase/auth"

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

type BoardContext = {
  board: DbBoard
  supabase: SupabaseClient
}

export class ColumnMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

async function throwOnError(
  response: PromiseLike<SupabaseMutationResponse> | SupabaseMutationResponse
) {
  const result = await response

  if (result.error) {
    throw result.error
  }
}

async function getBoardContext(): Promise<BoardContext> {
  const { supabase } = await getAuthenticatedSupabaseContext()
  const { data: boardId, error: ensureError } = await supabase.rpc(
    "ensure_user_board"
  )

  if (ensureError) {
    throw ensureError
  }

  if (typeof boardId !== "string") {
    throw new Error("Supabase did not return a user board.")
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, name")
    .eq("id", boardId)
    .single<DbBoard>()

  if (boardError) {
    throw boardError
  }

  return { board, supabase }
}

async function getColumnById(
  supabase: SupabaseClient,
  boardId: string,
  columnId: string
) {
  const { data, error } = await supabase
    .from("board_columns")
    .select("id, key, title, position")
    .eq("board_id", boardId)
    .eq("id", columnId)
    .single<DbColumn>()

  if (error) {
    throw error
  }

  return data
}

async function compactColumn(
  supabase: SupabaseClient,
  boardId: string,
  columnId: string
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("board_id", boardId)
    .eq("column_id", columnId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  await Promise.all(
    (data ?? []).map((task, position) =>
      throwOnError(
        supabase
          .from("tasks")
          .update({ position })
          .eq("board_id", boardId)
          .eq("id", task.id)
      )
    )
  )
}

async function compactBoardColumns(
  supabase: SupabaseClient,
  boardId: string
) {
  const { data, error } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", boardId)
    .order("position", { ascending: true })

  if (error) {
    throw error
  }

  for (const [position, column] of (data ?? []).entries()) {
    await throwOnError(
      supabase
        .from("board_columns")
        .update({ position })
        .eq("board_id", boardId)
        .eq("id", column.id)
    )
  }
}

async function listBoard(
  supabase: SupabaseClient,
  board: DbBoard
): Promise<BoardState> {
  const { data: columns, error: columnsError } = await supabase
    .from("board_columns")
    .select("id, key, title, position")
    .eq("board_id", board.id)
    .order("position", { ascending: true })
    .returns<DbColumn[]>()

  if (columnsError) {
    throw columnsError
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, column_id, title, description, position, created_at")
    .eq("board_id", board.id)
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

export async function listBoardFromSupabase(): Promise<BoardState> {
  const { board, supabase } = await getBoardContext()
  return listBoard(supabase, board)
}

export async function createTaskInSupabase({
  description,
  title,
}: {
  title: string
  description: string
}) {
  const { board, supabase } = await getBoardContext()
  const { data: firstColumn, error: firstColumnError } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", board.id)
    .order("position", { ascending: true })
    .limit(1)
    .single<{ id: string }>()

  if (firstColumnError) {
    throw firstColumnError
  }

  const { data: latestTask, error: latestTaskError } = await supabase
    .from("tasks")
    .select("position")
    .eq("board_id", board.id)
    .eq("column_id", firstColumn.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>()

  if (latestTaskError) {
    throw latestTaskError
  }

  await throwOnError(
    supabase.from("tasks").insert({
      board_id: board.id,
      column_id: firstColumn.id,
      title,
      description,
      position: (latestTask?.position ?? -1) + 1,
    })
  )

  return listBoard(supabase, board)
}

export async function deleteTaskFromSupabase(taskId: string) {
  const { board, supabase } = await getBoardContext()
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("column_id")
    .eq("board_id", board.id)
    .eq("id", taskId)
    .maybeSingle<{ column_id: string }>()

  if (taskError) {
    throw taskError
  }

  await throwOnError(
    supabase.from("tasks").delete().eq("board_id", board.id).eq("id", taskId)
  )

  if (task?.column_id) {
    await compactColumn(supabase, board.id, task.column_id)
  }

  return listBoard(supabase, board)
}

export async function clearColumnTasksInSupabase(columnId: string) {
  const { board, supabase } = await getBoardContext()
  await getColumnById(supabase, board.id, columnId)
  await throwOnError(
    supabase
      .from("tasks")
      .delete()
      .eq("board_id", board.id)
      .eq("column_id", columnId)
  )

  return listBoard(supabase, board)
}

export async function resetBoardInSupabase() {
  const { board, supabase } = await getBoardContext()
  const { error } = await supabase.rpc("reset_user_board", {
    p_board_id: board.id,
  })

  if (error) {
    throw error
  }

  return listBoard(supabase, board)
}

export async function createColumnInSupabase(title: string) {
  const { board, supabase } = await getBoardContext()
  const { data: columns, error } = await supabase
    .from("board_columns")
    .select("key, position")
    .eq("board_id", board.id)
    .order("position", { ascending: true })
    .returns<Array<{ key: string; position: number }>>()

  if (error) {
    throw error
  }

  const key = createColumnKey(
    title,
    (columns ?? []).map((column) => column.key)
  )

  await throwOnError(
    supabase.from("board_columns").insert({
      board_id: board.id,
      key,
      title,
      position: columns?.length ?? 0,
    })
  )

  return listBoard(supabase, board)
}

export async function deleteColumnFromSupabase(columnId: string) {
  const { board, supabase } = await getBoardContext()
  const { data: columns, error: columnsError } = await supabase
    .from("board_columns")
    .select("id, key, title, position")
    .eq("board_id", board.id)
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
    .eq("board_id", board.id)
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
    supabase
      .from("board_columns")
      .delete()
      .eq("board_id", board.id)
      .eq("id", columnId)
  )
  await compactBoardColumns(supabase, board.id)

  return listBoard(supabase, board)
}

export async function reorderColumnsInSupabase(columnIds: string[]) {
  const { board, supabase } = await getBoardContext()
  const { error } = await supabase.rpc("reorder_board_columns", {
    p_board_id: board.id,
    p_column_ids: columnIds,
  })

  if (error) {
    throw error
  }

  return listBoard(supabase, board)
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
  const { board, supabase } = await getBoardContext()
  const targetColumn = await getColumnById(supabase, board.id, targetColumnId)
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, column_id")
    .eq("board_id", board.id)
    .eq("id", taskId)
    .single<{ id: string; column_id: string }>()

  if (taskError) {
    throw taskError
  }

  const sourceColumnId = task.column_id
  const { data: targetTasks, error: targetTasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("board_id", board.id)
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
    supabase
      .from("tasks")
      .update({ column_id: targetColumn.id })
      .eq("board_id", board.id)
      .eq("id", taskId)
  )

  await Promise.all(
    orderedTargetTaskIds.map((id, position) =>
      throwOnError(
        supabase
          .from("tasks")
          .update({ column_id: targetColumn.id, position })
          .eq("board_id", board.id)
          .eq("id", id)
      )
    )
  )

  if (sourceColumnId !== targetColumn.id) {
    await compactColumn(supabase, board.id, sourceColumnId)
  }

  return listBoard(supabase, board)
}
