export const COLUMN_ORDER = ["ideas", "on-deck", "in-progress", "done"] as const

export type ColumnId = (typeof COLUMN_ORDER)[number]

export type Task = {
  id: string
  title: string
  description: string
  createdAt: string
}

export type BoardState = Record<ColumnId, Task[]>

export type MovePlacement = "start" | "end" | "before"

export type MoveTaskInput = {
  taskId: string
  targetColumnId: ColumnId
  placement: MovePlacement
  beforeTaskId?: string | null
}

export const KANBAN_STORAGE_KEY = "kanban-board:v1"

export const DEFAULT_BOARD_ID = "00000000-0000-4000-8000-000000000001"
export const DEFAULT_BOARD_NAME = "Project board"

export const DEFAULT_COLUMN_IDS: Record<ColumnId, string> = {
  ideas: "00000000-0000-4000-8000-000000000101",
  "on-deck": "00000000-0000-4000-8000-000000000102",
  "in-progress": "00000000-0000-4000-8000-000000000103",
  done: "00000000-0000-4000-8000-000000000104",
}

export const COLUMN_TITLES: Record<ColumnId, string> = {
  ideas: "Ideas",
  "on-deck": "On deck",
  "in-progress": "In progress",
  done: "Done",
}

export const initialBoard: BoardState = {
  ideas: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      title: "Collect feature ideas",
      description: "Capture rough product ideas before choosing what matters.",
      createdAt: "2026-08-18T14:00:00.000Z",
    },
  ],
  "on-deck": [
    {
      id: "00000000-0000-4000-8000-000000000202",
      title: "Shape the first task flow",
      description: "Decide what fields a lightweight task really needs.",
      createdAt: "2026-08-18T14:05:00.000Z",
    },
  ],
  "in-progress": [
    {
      id: "00000000-0000-4000-8000-000000000203",
      title: "Build the board shell",
      description: "Use the shadcn dashboard layout as the workspace frame.",
      createdAt: "2026-08-18T14:10:00.000Z",
    },
  ],
  done: [
    {
      id: "00000000-0000-4000-8000-000000000204",
      title: "Start without a database",
      description: "Keep everything in local browser state for now.",
      createdAt: "2026-08-18T14:15:00.000Z",
    },
  ],
}

export function createEmptyBoard(): BoardState {
  return {
    ideas: [],
    "on-deck": [],
    "in-progress": [],
    done: [],
  }
}

export function cloneInitialBoard(): BoardState {
  return {
    ideas: [...initialBoard.ideas],
    "on-deck": [...initialBoard["on-deck"]],
    "in-progress": [...initialBoard["in-progress"]],
    done: [...initialBoard.done],
  }
}

export function isColumnId(value: string): value is ColumnId {
  return COLUMN_ORDER.includes(value as ColumnId)
}

export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false
  }

  const task = value as Record<string, unknown>

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.description === "string" &&
    typeof task.createdAt === "string"
  )
}

export function normalizeBoard(value: unknown): BoardState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const parsed = value as Partial<Record<ColumnId, unknown>>
  const nextBoard = createEmptyBoard()

  for (const columnId of COLUMN_ORDER) {
    const tasks = parsed[columnId]
    nextBoard[columnId] = Array.isArray(tasks) ? tasks.filter(isTask) : []
  }

  return nextBoard
}

export function parseStoredBoard(value: string | null): BoardState | null {
  if (!value) {
    return null
  }

  try {
    return normalizeBoard(JSON.parse(value))
  } catch {
    return null
  }
}

export function findColumnForTask(
  board: BoardState,
  taskId: string
): ColumnId | null {
  return (
    COLUMN_ORDER.find((columnId) =>
      board[columnId].some((task) => task.id === taskId)
    ) ?? null
  )
}

export function findTask(board: BoardState, taskId: string): Task | null {
  const columnId = findColumnForTask(board, taskId)

  if (!columnId) {
    return null
  }

  return board[columnId].find((task) => task.id === taskId) ?? null
}

export function addTaskToBoard(board: BoardState, task: Task): BoardState {
  return {
    ...board,
    ideas: [task, ...board.ideas],
  }
}

export function deleteTaskFromBoard(board: BoardState, taskId: string): BoardState {
  const nextBoard = createEmptyBoard()

  for (const columnId of COLUMN_ORDER) {
    nextBoard[columnId] = board[columnId].filter((task) => task.id !== taskId)
  }

  return nextBoard
}

export function clearDoneFromBoard(board: BoardState): BoardState {
  return {
    ...board,
    done: [],
  }
}

export function moveTaskInBoard(
  board: BoardState,
  { beforeTaskId, placement, targetColumnId, taskId }: MoveTaskInput
): BoardState {
  if (beforeTaskId === taskId) {
    return board
  }

  const sourceColumnId = findColumnForTask(board, taskId)

  if (!sourceColumnId) {
    return board
  }

  const task = board[sourceColumnId].find((item) => item.id === taskId)

  if (!task) {
    return board
  }

  const nextBoard = {
    ...board,
    [sourceColumnId]: board[sourceColumnId].filter((item) => item.id !== taskId),
    [targetColumnId]: board[targetColumnId].filter((item) => item.id !== taskId),
  }

  const targetTasks = nextBoard[targetColumnId]
  let insertAt = 0

  if (placement === "end") {
    insertAt = targetTasks.length
  } else if (placement === "before" && beforeTaskId) {
    const beforeIndex = targetTasks.findIndex((item) => item.id === beforeTaskId)
    insertAt = beforeIndex >= 0 ? beforeIndex : targetTasks.length
  }

  return {
    ...nextBoard,
    [targetColumnId]: [
      ...targetTasks.slice(0, insertAt),
      task,
      ...targetTasks.slice(insertAt),
    ],
  }
}
