export type Task = {
  id: string
  title: string
  description: string
  createdAt: string
}

export type BoardColumn = {
  id: string
  key: string
  title: string
  tasks: Task[]
}

export type BoardState = {
  id: string
  name: string
  columns: BoardColumn[]
}

export type MovePlacement = "start" | "end" | "before"

export type MoveTaskInput = {
  taskId: string
  targetColumnId: string
  placement: MovePlacement
  beforeTaskId?: string | null
}

export const KANBAN_STORAGE_KEY = "kanban-board:v2"
export const LEGACY_KANBAN_STORAGE_KEY = "kanban-board:v1"

export const DEFAULT_BOARD_ID = "00000000-0000-4000-8000-000000000001"
export const DEFAULT_BOARD_NAME = "Project board"

export const DEFAULT_COLUMNS = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    key: "ideas",
    title: "Ideas",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    key: "on-deck",
    title: "On deck",
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    key: "in-progress",
    title: "In progress",
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    key: "done",
    title: "Done",
  },
] as const

const INITIAL_TASKS_BY_COLUMN_KEY: Record<string, Task[]> = {
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

export const initialBoard: BoardState = {
  id: DEFAULT_BOARD_ID,
  name: DEFAULT_BOARD_NAME,
  columns: DEFAULT_COLUMNS.map((column) => ({
    ...column,
    tasks: INITIAL_TASKS_BY_COLUMN_KEY[column.key] ?? [],
  })),
}

export function cloneInitialBoard(): BoardState {
  return {
    ...initialBoard,
    columns: initialBoard.columns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) => ({ ...task })),
    })),
  }
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

function normalizeColumn(value: unknown): BoardColumn | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const column = value as Record<string, unknown>

  if (
    typeof column.id !== "string" ||
    !column.id ||
    typeof column.key !== "string" ||
    !column.key ||
    typeof column.title !== "string" ||
    !column.title.trim() ||
    !Array.isArray(column.tasks)
  ) {
    return null
  }

  return {
    id: column.id,
    key: column.key,
    title: column.title,
    tasks: column.tasks.filter(isTask),
  }
}

function normalizeLegacyBoard(value: Record<string, unknown>): BoardState | null {
  const hasLegacyColumn = DEFAULT_COLUMNS.some((column) =>
    Array.isArray(value[column.key])
  )

  if (!hasLegacyColumn) {
    return null
  }

  return {
    id: DEFAULT_BOARD_ID,
    name: DEFAULT_BOARD_NAME,
    columns: DEFAULT_COLUMNS.map((column) => {
      const legacyTasks = value[column.key]

      return {
        ...column,
        tasks: Array.isArray(legacyTasks) ? legacyTasks.filter(isTask) : [],
      }
    }),
  }
}

export function normalizeBoard(value: unknown): BoardState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const parsed = value as Record<string, unknown>

  if (!Array.isArray(parsed.columns)) {
    return normalizeLegacyBoard(parsed)
  }

  const columns = parsed.columns.map(normalizeColumn)

  if (!columns.length || columns.some((column) => !column)) {
    return null
  }

  const normalizedColumns = columns as BoardColumn[]
  const columnIds = new Set(normalizedColumns.map((column) => column.id))
  const columnKeys = new Set(normalizedColumns.map((column) => column.key))

  if (
    columnIds.size !== normalizedColumns.length ||
    columnKeys.size !== normalizedColumns.length
  ) {
    return null
  }

  return {
    id: typeof parsed.id === "string" ? parsed.id : DEFAULT_BOARD_ID,
    name:
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name
        : DEFAULT_BOARD_NAME,
    columns: normalizedColumns,
  }
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

export function findColumn(
  board: BoardState,
  columnId: string
): BoardColumn | null {
  return board.columns.find((column) => column.id === columnId) ?? null
}

export function findColumnForTask(
  board: BoardState,
  taskId: string
): string | null {
  return (
    board.columns.find((column) =>
      column.tasks.some((task) => task.id === taskId)
    )?.id ?? null
  )
}

export function findTask(board: BoardState, taskId: string): Task | null {
  const columnId = findColumnForTask(board, taskId)
  return columnId
    ? findColumn(board, columnId)?.tasks.find((task) => task.id === taskId) ??
        null
    : null
}

export function addTaskToBoard(board: BoardState, task: Task): BoardState {
  const firstColumn = board.columns[0]

  if (!firstColumn) {
    return board
  }

  return {
    ...board,
    columns: board.columns.map((column) =>
      column.id === firstColumn.id
        ? { ...column, tasks: [task, ...column.tasks] }
        : column
    ),
  }
}

export function deleteTaskFromBoard(
  board: BoardState,
  taskId: string
): BoardState {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => task.id !== taskId),
    })),
  }
}

export function clearColumnFromBoard(
  board: BoardState,
  columnId: string
): BoardState {
  return {
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, tasks: [] } : column
    ),
  }
}

export function addColumnToBoard(
  board: BoardState,
  column: BoardColumn
): BoardState {
  return {
    ...board,
    columns: [...board.columns, column],
  }
}

export function removeColumnFromBoard(
  board: BoardState,
  columnId: string
): BoardState {
  const column = findColumn(board, columnId)

  if (!column || column.tasks.length || board.columns.length <= 1) {
    return board
  }

  return {
    ...board,
    columns: board.columns.filter((item) => item.id !== columnId),
  }
}

export function reorderColumnsInBoard(
  board: BoardState,
  activeColumnId: string,
  overColumnId: string
): BoardState {
  const fromIndex = board.columns.findIndex(
    (column) => column.id === activeColumnId
  )
  const toIndex = board.columns.findIndex((column) => column.id === overColumnId)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return board
  }

  const columns = [...board.columns]
  const [movedColumn] = columns.splice(fromIndex, 1)
  columns.splice(toIndex, 0, movedColumn)

  return { ...board, columns }
}

export function createColumnKey(title: string, existingKeys: string[]): string {
  const baseKey =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "column"
  const keys = new Set(existingKeys)

  if (!keys.has(baseKey)) {
    return baseKey
  }

  let suffix = 2

  while (keys.has(`${baseKey}-${suffix}`)) {
    suffix += 1
  }

  return `${baseKey}-${suffix}`
}

export function moveTaskInBoard(
  board: BoardState,
  { beforeTaskId, placement, targetColumnId, taskId }: MoveTaskInput
): BoardState {
  if (beforeTaskId === taskId) {
    return board
  }

  const sourceColumnId = findColumnForTask(board, taskId)
  const targetColumn = findColumn(board, targetColumnId)

  if (!sourceColumnId || !targetColumn) {
    return board
  }

  const task = findTask(board, taskId)

  if (!task) {
    return board
  }

  const columnsWithoutTask = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((item) => item.id !== taskId),
  }))
  const nextTargetColumn = columnsWithoutTask.find(
    (column) => column.id === targetColumnId
  )

  if (!nextTargetColumn) {
    return board
  }

  let insertAt = 0

  if (placement === "end") {
    insertAt = nextTargetColumn.tasks.length
  } else if (placement === "before" && beforeTaskId) {
    const beforeIndex = nextTargetColumn.tasks.findIndex(
      (item) => item.id === beforeTaskId
    )
    insertAt = beforeIndex >= 0 ? beforeIndex : nextTargetColumn.tasks.length
  }

  const nextTasks = [
    ...nextTargetColumn.tasks.slice(0, insertAt),
    task,
    ...nextTargetColumn.tasks.slice(insertAt),
  ]

  return {
    ...board,
    columns: columnsWithoutTask.map((column) =>
      column.id === targetColumnId ? { ...column, tasks: nextTasks } : column
    ),
  }
}
