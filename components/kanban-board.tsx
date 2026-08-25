"use client"

import * as React from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  COLUMN_ORDER,
  KANBAN_STORAGE_KEY,
  addTaskToBoard,
  clearDoneFromBoard,
  cloneInitialBoard,
  deleteTaskFromBoard,
  findColumnForTask,
  findTask,
  isColumnId,
  moveTaskInBoard,
  normalizeBoard,
  parseStoredBoard,
  type BoardState,
  type ColumnId,
  type MoveTaskInput,
  type Task,
} from "@/lib/kanban/board"
import { cn } from "@/lib/utils"

const COLUMNS: Record<
  ColumnId,
  {
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  ideas: {
    title: "Ideas",
    description: "Raw items worth considering.",
    icon: Lightbulb,
  },
  "on-deck": {
    title: "On deck",
    description: "Ready to pick up next.",
    icon: SquareKanban,
  },
  "in-progress": {
    title: "In progress",
    description: "Actively being worked.",
    icon: LoaderCircle,
  },
  done: {
    title: "Done",
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

function createBrowserTask(title: string, description: string): Task {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `task-${Date.now()}`,
    title,
    description,
    createdAt: new Date().toISOString(),
  }
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
    throw new Error(payload.message ?? "The board could not be synced.")
  }

  const board = normalizeBoard(payload.board)

  if (!board) {
    throw new Error("Supabase returned an unexpected board shape.")
  }

  return board
}

export function KanbanBoard() {
  const [board, setBoard] = React.useState<BoardState>(() => cloneInitialBoard())
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)
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

      const storedBoard = parseStoredBoard(
        window.localStorage.getItem(KANBAN_STORAGE_KEY)
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
        loadBrowserFallback(
          "Using browser storage until Supabase is reachable."
        )
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

  const activeTask = activeTaskId ? findTask(board, activeTaskId) : null
  const totalTasks = COLUMN_ORDER.reduce(
    (total, columnId) => total + board[columnId].length,
    0
  )
  const doneTasks = board.done.length
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
  ) {
    setBoard((currentBoard) => localUpdate(currentBoard))

    if (storageMode !== "supabase") {
      return
    }

    setIsSaving(true)

    try {
      const nextBoard = await request()
      setBoard(nextBoard)
      setStatusMessage("Synced through Supabase Postgres.")
    } catch {
      setStorageMode("browser")
      setStatusMessage(
        "Supabase sync failed. Your latest change is saved in this browser."
      )
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

  function moveTask(taskId: string, targetColumnId: ColumnId) {
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

  function clearDone() {
    void syncBoard(
      (currentBoard) => clearDoneFromBoard(currentBoard),
      () =>
        requestSupabaseBoard("/api/kanban/done", {
          method: "DELETE",
        })
    )
  }

  function handleDragStart(event: DragStartEvent) {
    if (isPending) {
      return
    }

    setActiveTaskId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    setActiveTaskId(null)

    if (!over) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    const sourceColumnId = findColumnForTask(board, activeId)
    const targetColumnId = isColumnId(overId)
      ? overId
      : findColumnForTask(board, overId)

    if (!sourceColumnId || !targetColumnId) {
      return
    }

    const moveInput: MoveTaskInput = {
      beforeTaskId: isColumnId(overId) ? null : overId,
      placement: isColumnId(overId) ? "end" : "before",
      targetColumnId,
      taskId: activeId,
    }

    void syncBoard(
      (currentBoard) => moveTaskInBoard(currentBoard, moveInput),
      () =>
        requestSupabaseBoard(`/api/kanban/tasks/${activeId}/move`, {
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
          doneTasks={doneTasks}
          isBusy={isPending}
          onAddTask={addTask}
          onClearDone={clearDone}
          onResetBoard={resetBoard}
          totalTasks={totalTasks}
        />
        <Card className="min-h-[168px] border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SquareKanban className="size-5 text-muted-foreground" />
              Project board
            </CardTitle>
            <CardDescription>
              Drag cards between columns, reorder work within a column, or use
              each card&apos;s menu to move it without dragging.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">{storageLabel}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {totalTasks}
                </p>
                <p>Total tasks</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {doneTasks}
                </p>
                <p>Done</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {Math.max(totalTasks - doneTasks, 0)}
                </p>
                <p>Still open</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
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
        <div className="grid min-h-[520px] gap-4 xl:grid-cols-4">
          {COLUMN_ORDER.map((columnId) => (
            <KanbanColumn
              columnId={columnId}
              key={columnId}
              tasks={board[columnId]}
            >
              {board[columnId].map((task) => (
                <TaskCard
                  disabled={isPending}
                  columnId={columnId}
                  key={task.id}
                  onDelete={deleteTask}
                  onMove={moveTask}
                  task={task}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function TaskComposer({
  doneTasks,
  isBusy,
  onAddTask,
  onClearDone,
  onResetBoard,
  totalTasks,
}: {
  doneTasks: number
  isBusy: boolean
  onAddTask: (title: string, description: string) => void
  onClearDone: () => void
  onResetBoard: () => void
  totalTasks: number
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
          New tasks start in Ideas. Move them when they are ready.
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
            disabled={isBusy || !doneTasks}
            onClick={onClearDone}
            type="button"
            variant="outline"
          >
            <CircleCheck />
            Clear done
          </Button>
          <Button
            disabled={isBusy || !totalTasks}
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
  columnId,
  tasks,
}: {
  children: React.ReactNode
  columnId: ColumnId
  tasks: Task[]
}) {
  const column = COLUMNS[columnId]
  const Icon = column.icon
  const { isOver, setNodeRef } = useDroppable({
    id: columnId,
  })

  return (
    <section
      aria-labelledby={`${columnId}-title`}
      className={cn(
        "flex min-h-[360px] flex-col rounded-xl border bg-muted/30 p-3 transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
      id={columnId}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className="flex items-center gap-2 text-sm font-semibold"
            id={`${columnId}-title`}
          >
            <Icon className="size-4 text-muted-foreground" />
            {column.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {column.description}
          </p>
        </div>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <SortableContext
        id={columnId}
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid flex-1 content-start gap-3">
          {tasks.length ? (
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

function TaskCard({
  columnId,
  disabled,
  onDelete,
  onMove,
  task,
}: {
  columnId: ColumnId
  disabled: boolean
  onDelete: (taskId: string) => void
  onMove: (taskId: string, columnId: ColumnId) => void
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
    disabled,
    id: task.id,
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
  columnId,
  disabled,
  onDelete,
  onMove,
  task,
}: {
  columnId: ColumnId
  disabled: boolean
  onDelete: (taskId: string) => void
  onMove: (taskId: string, columnId: ColumnId) => void
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
          {COLUMN_ORDER.map((targetColumnId) => (
            <DropdownMenuItem
              key={targetColumnId}
              onClick={() => onMove(task.id, targetColumnId)}
              disabled={disabled || targetColumnId === columnId}
            >
              <ArrowRight />
              {COLUMNS[targetColumnId].title}
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
