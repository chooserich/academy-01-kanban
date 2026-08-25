"use client"

import * as React from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  GripVertical,
  Lightbulb,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  SquareKanban,
  Trash2,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  KANBAN_STORAGE_KEY,
  LEGACY_KANBAN_STORAGE_KEY,
  addColumnToBoard,
  addTaskToBoard,
  clearColumnFromBoard,
  cloneInitialBoard,
  createColumnKey,
  deleteTaskFromBoard,
  findColumn,
  findTask,
  moveTaskInBoard,
  normalizeBoard,
  parseStoredBoard,
  removeColumnFromBoard,
  reorderColumnsInBoard,
  type BoardColumn,
  type BoardState,
  type MoveTaskInput,
  type Task,
} from "@/lib/kanban/board"
import { cn } from "@/lib/utils"

const DEFAULT_COLUMN_PRESENTATION: Record<
  string,
  {
    description: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  ideas: {
    description: "Raw items worth considering.",
    icon: Lightbulb,
  },
  "on-deck": {
    description: "Ready to pick up next.",
    icon: SquareKanban,
  },
  "in-progress": {
    description: "Actively being worked.",
    icon: LoaderCircle,
  },
  done: {
    description: "Completed and parked.",
    icon: CircleCheck,
  },
}

type StorageMode = "loading" | "supabase" | "browser"

type KanbanApiResponse = {
  board?: unknown
  configured?: boolean
  message?: string
}

type DragData =
  | { type: "column"; columnId: string }
  | { type: "task"; taskId: string; columnId: string }

class KanbanRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function createId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}`
}

function createBrowserTask(title: string, description: string): Task {
  return {
    id: createId("task"),
    title,
    description,
    createdAt: new Date().toISOString(),
  }
}

function createBrowserColumn(board: BoardState, title: string): BoardColumn {
  return {
    id: createId("column"),
    key: createColumnKey(
      title,
      board.columns.map((column) => column.key)
    ),
    title,
    tasks: [],
  }
}

function columnDndId(columnId: string) {
  return `column:${columnId}`
}

function taskDndId(taskId: string) {
  return `task:${taskId}`
}

async function readJsonResponse(response: Response): Promise<KanbanApiResponse> {
  return (await response.json().catch(() => ({}))) as KanbanApiResponse
}

async function requestSupabaseBoard(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<BoardState> {
  const response = await fetch(input, init)
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new KanbanRequestError(
      payload.message ?? "The board could not be synced.",
      response.status
    )
  }

  const board = normalizeBoard(payload.board)

  if (!board) {
    throw new Error("Supabase returned an unexpected board shape.")
  }

  return board
}

export function KanbanBoard() {
  const [board, setBoard] = React.useState<BoardState>(() => cloneInitialBoard())
  const [activeDrag, setActiveDrag] = React.useState<DragData | null>(null)
  const [columnToRemove, setColumnToRemove] =
    React.useState<BoardColumn | null>(null)
  const [storageMode, setStorageMode] = React.useState<StorageMode>("loading")
  const [isSaving, setIsSaving] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState(
    "Connecting to Supabase..."
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  React.useEffect(() => {
    let didCancel = false

    function loadBrowserFallback(message?: string) {
      if (didCancel) {
        return
      }

      const storedBoard =
        parseStoredBoard(window.localStorage.getItem(KANBAN_STORAGE_KEY)) ??
        parseStoredBoard(
          window.localStorage.getItem(LEGACY_KANBAN_STORAGE_KEY)
        )

      setBoard(storedBoard ?? cloneInitialBoard())
      setStorageMode("browser")
      setStatusMessage(
        message ?? "Using browser storage until Supabase is configured."
      )
    }

    async function loadBoard() {
      try {
        const response = await fetch("/api/kanban", { cache: "no-store" })
        const payload = await readJsonResponse(response)

        if (!response.ok) {
          throw new Error(payload.message ?? "Supabase could not be reached.")
        }

        if (!payload.configured) {
          loadBrowserFallback(payload.message)
          return
        }

        const nextBoard = normalizeBoard(payload.board)

        if (!nextBoard) {
          throw new Error("Supabase returned an unexpected board shape.")
        }

        if (!didCancel) {
          setBoard(nextBoard)
          setStorageMode("supabase")
          setStatusMessage("Synced through Supabase Postgres.")
        }
      } catch {
        loadBrowserFallback("Using browser storage until Supabase is reachable.")
      }
    }

    void loadBoard()

    return () => {
      didCancel = true
    }
  }, [])

  React.useEffect(() => {
    if (storageMode === "browser") {
      window.localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(board))
    }
  }, [board, storageMode])

  const activeTask =
    activeDrag?.type === "task" ? findTask(board, activeDrag.taskId) : null
  const activeColumn =
    activeDrag?.type === "column"
      ? findColumn(board, activeDrag.columnId)
      : null
  const firstColumn = board.columns[0]
  const finalColumn = board.columns.at(-1)
  const totalTasks = board.columns.reduce(
    (total, column) => total + column.tasks.length,
    0
  )
  const finalColumnTasks = finalColumn?.tasks.length ?? 0
  const isPending = storageMode === "loading" || isSaving
  const storageLabel =
    storageMode === "supabase"
      ? "Supabase"
      : storageMode === "browser"
        ? "Browser fallback"
        : "Connecting"

  async function syncBoard(
    localUpdate: (currentBoard: BoardState) => BoardState,
    request: () => Promise<BoardState>
  ): Promise<boolean> {
    const previousBoard = board
    const optimisticBoard = localUpdate(board)
    setBoard(optimisticBoard)

    if (storageMode !== "supabase") {
      return true
    }

    setIsSaving(true)

    try {
      const nextBoard = await request()
      setBoard(nextBoard)
      setStatusMessage("Synced through Supabase Postgres.")
      return true
    } catch (error) {
      if (error instanceof KanbanRequestError && error.status < 500) {
        setBoard(previousBoard)
        setStatusMessage(error.message)
        return false
      }

      setStorageMode("browser")
      setStatusMessage(
        "Supabase sync failed. Your latest change is saved in this browser."
      )
      return true
    } finally {
      setIsSaving(false)
    }
  }

  function addTask(title: string, description: string) {
    const task = createBrowserTask(title, description)

    void syncBoard(
      (currentBoard) => addTaskToBoard(currentBoard, task),
      () =>
        requestSupabaseBoard("/api/kanban/tasks", {
          body: JSON.stringify({ description, title }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
    )
  }

  async function addColumn(title: string) {
    const column = createBrowserColumn(board, title)

    return syncBoard(
      (currentBoard) => addColumnToBoard(currentBoard, column),
      () =>
        requestSupabaseBoard("/api/kanban/columns", {
          body: JSON.stringify({ title }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
    )
  }

  function moveTask(taskId: string, targetColumnId: string) {
    const moveInput: MoveTaskInput = {
      placement: "start",
      targetColumnId,
      taskId,
    }

    void syncBoard(
      (currentBoard) => moveTaskInBoard(currentBoard, moveInput),
      () =>
        requestSupabaseBoard(`/api/kanban/tasks/${taskId}/move`, {
          body: JSON.stringify(moveInput),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        })
    )
  }

  function deleteTask(taskId: string) {
    void syncBoard(
      (currentBoard) => deleteTaskFromBoard(currentBoard, taskId),
      () =>
        requestSupabaseBoard(`/api/kanban/tasks/${taskId}`, {
          method: "DELETE",
        })
    )
  }

  function resetBoard() {
    void syncBoard(
      () => cloneInitialBoard(),
      () =>
        requestSupabaseBoard("/api/kanban/reset", {
          method: "POST",
        })
    )
  }

  function clearFinalColumn() {
    if (!finalColumn) {
      return
    }

    void syncBoard(
      (currentBoard) => clearColumnFromBoard(currentBoard, finalColumn.id),
      () =>
        requestSupabaseBoard(
          `/api/kanban/columns/${encodeURIComponent(finalColumn.id)}/tasks`,
          { method: "DELETE" }
        )
    )
  }

  function removeColumn(columnId: string) {
    const column = findColumn(board, columnId)

    if (!column || column.tasks.length || board.columns.length <= 1) {
      return
    }

    setColumnToRemove(null)
    void syncBoard(
      (currentBoard) => removeColumnFromBoard(currentBoard, columnId),
      () =>
        requestSupabaseBoard(
          `/api/kanban/columns/${encodeURIComponent(columnId)}`,
          { method: "DELETE" }
        )
    )
  }

  function reorderColumns(activeColumnId: string, overColumnId: string) {
    const nextBoard = reorderColumnsInBoard(board, activeColumnId, overColumnId)

    if (nextBoard === board) {
      return
    }

    const columnIds = nextBoard.columns.map((column) => column.id)

    void syncBoard(
      (currentBoard) =>
        reorderColumnsInBoard(currentBoard, activeColumnId, overColumnId),
      () =>
        requestSupabaseBoard("/api/kanban/columns/reorder", {
          body: JSON.stringify({ columnIds }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        })
    )
  }

  function moveColumnByOffset(columnId: string, offset: -1 | 1) {
    const currentIndex = board.columns.findIndex(
      (column) => column.id === columnId
    )
    const targetColumn = board.columns[currentIndex + offset]

    if (currentIndex < 0 || !targetColumn) {
      return
    }

    reorderColumns(columnId, targetColumn.id)
  }

  function handleDragStart(event: DragStartEvent) {
    if (isPending) {
      return
    }

    const dragData = event.active.data.current as DragData | undefined
    setActiveDrag(dragData ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const activeData = active.data.current as DragData | undefined
    const overData = over?.data.current as DragData | undefined
    setActiveDrag(null)

    if (!over || !activeData || !overData) {
      return
    }

    if (activeData.type === "column") {
      reorderColumns(activeData.columnId, overData.columnId)
      return
    }

    const targetColumnId = overData.columnId
    const beforeTaskId = overData.type === "task" ? overData.taskId : null
    const moveInput: MoveTaskInput = {
      beforeTaskId,
      placement: beforeTaskId ? "before" : "end",
      targetColumnId,
      taskId: activeData.taskId,
    }

    void syncBoard(
      (currentBoard) => moveTaskInBoard(currentBoard, moveInput),
      () =>
        requestSupabaseBoard(`/api/kanban/tasks/${activeData.taskId}/move`, {
          body: JSON.stringify(moveInput),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        })
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <TaskComposer
          finalColumn={finalColumn}
          firstColumnTitle={firstColumn?.title ?? "the first column"}
          isBusy={isPending}
          onAddTask={addTask}
          onClearFinalColumn={clearFinalColumn}
          onResetBoard={resetBoard}
        />
        <Card className="min-h-[168px] border-dashed bg-muted/30">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <SquareKanban className="size-5 shrink-0 text-muted-foreground" />
                  {board.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  Drag columns into order, then move tasks between the stages
                  that fit your workflow.
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{storageLabel}</Badge>
                <AddColumnDialog
                  disabled={isPending}
                  onAddColumn={addColumn}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {totalTasks}
                </p>
                <p>Total tasks</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {board.columns.length}
                </p>
                <p>Columns</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {finalColumnTasks}
                </p>
                <p className="truncate">In {finalColumn?.title ?? "final stage"}</p>
              </div>
            </div>
            <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">
              {statusMessage}
            </p>
          </CardContent>
        </Card>
      </div>

      <DndContext
        collisionDetection={closestCorners}
        id="kanban-board"
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext
          items={board.columns.map((column) => columnDndId(column.id))}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex min-h-[520px] gap-4 overflow-x-auto pb-3">
            {board.columns.map((column, index) => (
              <KanbanColumn
                column={column}
                disabled={isPending}
                index={index}
                key={column.id}
                onMoveLeft={() => moveColumnByOffset(column.id, -1)}
                onMoveRight={() => moveColumnByOffset(column.id, 1)}
                onRequestRemove={() => setColumnToRemove(column)}
                totalColumns={board.columns.length}
              >
                {column.tasks.map((task) => (
                  <TaskCard
                    columns={board.columns}
                    disabled={isPending}
                    columnId={column.id}
                    key={task.id}
                    onDelete={deleteTask}
                    onMove={moveTask}
                    task={task}
                  />
                ))}
              </KanbanColumn>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeTask ? <TaskPreview task={activeTask} /> : null}
          {activeColumn ? <ColumnPreview column={activeColumn} /> : null}
        </DragOverlay>
      </DndContext>

      <RemoveColumnDialog
        column={columnToRemove}
        onOpenChange={(open) => {
          if (!open) {
            setColumnToRemove(null)
          }
        }}
        onRemove={removeColumn}
        totalColumns={board.columns.length}
      />
    </div>
  )
}

function AddColumnDialog({
  disabled,
  onAddColumn,
}: {
  disabled: boolean
  onAddColumn: (title: string) => Promise<boolean>
}) {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()

    if (!nextTitle) {
      return
    }

    setIsSubmitting(true)
    const didAdd = await onAddColumn(nextTitle)
    setIsSubmitting(false)

    if (didAdd) {
      setTitle("")
      setOpen(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setTitle("")
        }
      }}
      open={open}
    >
      <DialogTrigger
        render={
          <Button disabled={disabled} size="sm" type="button" variant="outline" />
        }
      >
        <Plus />
        Add column
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a column</DialogTitle>
            <DialogDescription>
              The new column will be added to the end of this board.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="column-title">Column name</Label>
            <Input
              autoFocus
              disabled={isSubmitting}
              id="column-title"
              maxLength={50}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Review"
              value={title}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={isSubmitting || !title.trim()} type="submit">
              <Plus />
              {isSubmitting ? "Adding..." : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveColumnDialog({
  column,
  onOpenChange,
  onRemove,
  totalColumns,
}: {
  column: BoardColumn | null
  onOpenChange: (open: boolean) => void
  onRemove: (columnId: string) => void
  totalColumns: number
}) {
  const hasTasks = Boolean(column?.tasks.length)
  const isLastColumn = totalColumns <= 1
  const canRemove = Boolean(column) && !hasTasks && !isLastColumn
  const description = hasTasks
    ? "Move or delete its tasks before removing this column."
    : isLastColumn
      ? "A board must keep at least one column."
      : "This removes the empty column from the board."

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(column)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove {column?.title ?? "column"}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canRemove}
            onClick={() => column && onRemove(column.id)}
            variant="destructive"
          >
            Remove column
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function TaskComposer({
  finalColumn,
  firstColumnTitle,
  isBusy,
  onAddTask,
  onClearFinalColumn,
  onResetBoard,
}: {
  finalColumn?: BoardColumn
  firstColumnTitle: string
  isBusy: boolean
  onAddTask: (title: string, description: string) => void
  onClearFinalColumn: () => void
  onResetBoard: () => void
}) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextTitle = title.trim()
    const nextDescription = description.trim()

    if (!nextTitle) {
      return
    }

    onAddTask(nextTitle, nextDescription)
    setTitle("")
    setDescription("")
  }

  return (
    <Card id="new-task">
      <CardHeader>
        <CardTitle>Add a task</CardTitle>
        <CardDescription>
          New tasks start in {firstColumnTitle}. Move them when they are ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="task-title">Task title</Label>
            <Input
              disabled={isBusy}
              id="task-title"
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Draft launch checklist"
              value={title}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              disabled={isBusy}
              id="task-notes"
              maxLength={220}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context, owner, or acceptance notes."
              value={description}
            />
          </div>
          <Button disabled={isBusy || !title.trim()} type="submit">
            <Plus />
            {isBusy ? "Saving..." : "Add task"}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={isBusy || !finalColumn?.tasks.length}
            onClick={onClearFinalColumn}
            type="button"
            variant="outline"
          >
            <CircleCheck />
            Clear {finalColumn?.title ?? "final column"}
          </Button>
          <Button
            disabled={isBusy}
            onClick={onResetBoard}
            type="button"
            variant="ghost"
          >
            <RefreshCcw />
            Reset sample
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KanbanColumn({
  children,
  column,
  disabled,
  index,
  onMoveLeft,
  onMoveRight,
  onRequestRemove,
  totalColumns,
}: {
  children: React.ReactNode
  column: BoardColumn
  disabled: boolean
  index: number
  onMoveLeft: () => void
  onMoveRight: () => void
  onRequestRemove: () => void
  totalColumns: number
}) {
  const presentation = DEFAULT_COLUMN_PRESENTATION[column.key]
  const Icon = presentation?.icon ?? SquareKanban
  const {
    attributes,
    isDragging,
    isOver,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    data: { type: "column", columnId: column.id } satisfies DragData,
    disabled,
    id: columnDndId(column.id),
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const headingId = `column-${column.id}-title`

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-h-[420px] w-[min(84vw,320px)] shrink-0 flex-col rounded-lg border bg-muted/30 p-3 transition-colors sm:w-[300px]",
        isOver && "border-primary/50 bg-primary/5",
        isDragging && "opacity-40"
      )}
      id={column.key}
      ref={setNodeRef}
      style={style}
    >
      <div className="mb-3 flex items-start gap-2">
        <Button
          aria-label={`Drag ${column.title} column`}
          className="-ml-1 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          disabled={disabled}
          size="icon-sm"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <div className="min-w-0 flex-1">
          <h2
            className="flex items-center gap-2 text-sm font-semibold"
            id={headingId}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{column.title}</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {presentation?.description ?? "Custom workflow stage."}
          </p>
        </div>
        <Badge variant="secondary">{column.tasks.length}</Badge>
        <ColumnActions
          disabled={disabled}
          isFirst={index === 0}
          isLast={index === totalColumns - 1}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          onRequestRemove={onRequestRemove}
        />
      </div>
      <SortableContext
        id={`tasks:${column.id}`}
        items={column.tasks.map((task) => taskDndId(task.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid flex-1 content-start gap-3">
          {column.tasks.length ? (
            children
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-background/60 px-3 text-center text-sm text-muted-foreground">
              Drop a task here
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

function ColumnActions({
  disabled,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  onRequestRemove,
}: {
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onRequestRemove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Column actions"
            className="-mr-1 text-muted-foreground"
            disabled={disabled}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Column order</DropdownMenuLabel>
          <DropdownMenuItem disabled={disabled || isFirst} onClick={onMoveLeft}>
            <ArrowLeft />
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disabled || isLast} onClick={onMoveRight}>
            <ArrowRight />
            Move right
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disabled}
          onClick={onRequestRemove}
          variant="destructive"
        >
          <Trash2 />
          Remove column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskCard({
  columns,
  columnId,
  disabled,
  onDelete,
  onMove,
  task,
}: {
  columns: BoardColumn[]
  columnId: string
  disabled: boolean
  onDelete: (taskId: string) => void
  onMove: (taskId: string, columnId: string) => void
  task: Task
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    data: { type: "task", taskId: task.id, columnId } satisfies DragData,
    disabled,
    id: taskDndId(task.id),
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Card
      className={cn(
        "bg-background shadow-xs transition-shadow hover:shadow-sm",
        isDragging && "opacity-40"
      )}
      ref={setNodeRef}
      size="sm"
      style={style}
    >
      <CardHeader className="gap-2">
        <div className="flex items-start gap-2">
          <Button
            aria-label={`Drag ${task.title}`}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            disabled={disabled}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...attributes}
            {...listeners}
          >
            <GripVertical />
          </Button>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">{task.title}</CardTitle>
            {task.description ? (
              <CardDescription className="mt-1 line-clamp-3">
                {task.description}
              </CardDescription>
            ) : null}
          </div>
          <TaskActions
            columns={columns}
            columnId={columnId}
            disabled={disabled}
            onDelete={onDelete}
            onMove={onMove}
            task={task}
          />
        </div>
      </CardHeader>
    </Card>
  )
}

function TaskActions({
  columns,
  columnId,
  disabled,
  onDelete,
  onMove,
  task,
}: {
  columns: BoardColumn[]
  columnId: string
  disabled: boolean
  onDelete: (taskId: string) => void
  onMove: (taskId: string, columnId: string) => void
  task: Task
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for ${task.title}`}
            className="-mr-1 text-muted-foreground"
            disabled={disabled}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {columns.map((targetColumn) => (
            <DropdownMenuItem
              disabled={disabled || targetColumn.id === columnId}
              key={targetColumn.id}
              onClick={() => onMove(task.id, targetColumn.id)}
            >
              <ArrowRight />
              {targetColumn.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => onDelete(task.id)}
          variant="destructive"
        >
          <Trash2 />
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskPreview({ task }: { task: Task }) {
  return (
    <Card className="w-[280px] bg-background shadow-lg" size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{task.title}</CardTitle>
        {task.description ? (
          <CardDescription className="line-clamp-3">
            {task.description}
          </CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  )
}

function ColumnPreview({ column }: { column: BoardColumn }) {
  return (
    <Card className="w-[300px] bg-background shadow-lg" size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <GripVertical className="size-4 text-muted-foreground" />
          {column.title}
        </CardTitle>
        <CardDescription>
          {column.tasks.length} {column.tasks.length === 1 ? "task" : "tasks"}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
