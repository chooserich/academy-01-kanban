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
  arrayMove,
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
import { cn } from "@/lib/utils"

const COLUMN_ORDER = ["ideas", "on-deck", "in-progress", "done"] as const

type ColumnId = (typeof COLUMN_ORDER)[number]

type Task = {
  id: string
  title: string
  description: string
  createdAt: string
}

type BoardState = Record<ColumnId, Task[]>

const STORAGE_KEY = "kanban-board:v1"

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

const initialBoard: BoardState = {
  ideas: [
    {
      id: "task-ideas-1",
      title: "Collect feature ideas",
      description: "Capture rough product ideas before choosing what matters.",
      createdAt: "2026-08-18T14:00:00.000Z",
    },
  ],
  "on-deck": [
    {
      id: "task-deck-1",
      title: "Shape the first task flow",
      description: "Decide what fields a lightweight task really needs.",
      createdAt: "2026-08-18T14:05:00.000Z",
    },
  ],
  "in-progress": [
    {
      id: "task-progress-1",
      title: "Build the board shell",
      description: "Use the shadcn dashboard layout as the workspace frame.",
      createdAt: "2026-08-18T14:10:00.000Z",
    },
  ],
  done: [
    {
      id: "task-done-1",
      title: "Start without a database",
      description: "Keep everything in local browser state for now.",
      createdAt: "2026-08-18T14:15:00.000Z",
    },
  ],
}

function createEmptyBoard(): BoardState {
  return {
    ideas: [],
    "on-deck": [],
    "in-progress": [],
    done: [],
  }
}

function isColumnId(value: string): value is ColumnId {
  return COLUMN_ORDER.includes(value as ColumnId)
}

function isTask(value: unknown): value is Task {
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

function parseStoredBoard(value: string | null): BoardState | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<Record<ColumnId, unknown>>
    const nextBoard = createEmptyBoard()

    for (const columnId of COLUMN_ORDER) {
      const tasks = parsed[columnId]
      nextBoard[columnId] = Array.isArray(tasks) ? tasks.filter(isTask) : []
    }

    return nextBoard
  } catch {
    return null
  }
}

function findColumnForTask(board: BoardState, taskId: string): ColumnId | null {
  return (
    COLUMN_ORDER.find((columnId) =>
      board[columnId].some((task) => task.id === taskId)
    ) ?? null
  )
}

function findTask(board: BoardState, taskId: string): Task | null {
  const columnId = findColumnForTask(board, taskId)

  if (!columnId) {
    return null
  }

  return board[columnId].find((task) => task.id === taskId) ?? null
}

function cloneInitialBoard(): BoardState {
  return {
    ideas: [...initialBoard.ideas],
    "on-deck": [...initialBoard["on-deck"]],
    "in-progress": [...initialBoard["in-progress"]],
    done: [...initialBoard.done],
  }
}

export function KanbanBoard() {
  const [board, setBoard] = React.useState<BoardState>(() => cloneInitialBoard())
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)
  const [hasLoadedStorage, setHasLoadedStorage] = React.useState(false)

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
    queueMicrotask(() => {
      const storedBoard = parseStoredBoard(
        window.localStorage.getItem(STORAGE_KEY)
      )

      if (storedBoard) {
        setBoard(storedBoard)
      }

      setHasLoadedStorage(true)
    })
  }, [])

  React.useEffect(() => {
    if (hasLoadedStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
    }
  }, [board, hasLoadedStorage])

  const activeTask = activeTaskId ? findTask(board, activeTaskId) : null
  const totalTasks = COLUMN_ORDER.reduce(
    (total, columnId) => total + board[columnId].length,
    0
  )
  const doneTasks = board.done.length

  function addTask(title: string, description: string) {
    const task: Task = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `task-${Date.now()}`,
      title,
      description,
      createdAt: new Date().toISOString(),
    }

    setBoard((currentBoard) => ({
      ...currentBoard,
      ideas: [task, ...currentBoard.ideas],
    }))
  }

  function moveTask(taskId: string, targetColumnId: ColumnId) {
    setBoard((currentBoard) => {
      const sourceColumnId = findColumnForTask(currentBoard, taskId)

      if (!sourceColumnId || sourceColumnId === targetColumnId) {
        return currentBoard
      }

      const task = currentBoard[sourceColumnId].find((item) => item.id === taskId)

      if (!task) {
        return currentBoard
      }

      return {
        ...currentBoard,
        [sourceColumnId]: currentBoard[sourceColumnId].filter(
          (item) => item.id !== taskId
        ),
        [targetColumnId]: [task, ...currentBoard[targetColumnId]],
      }
    })
  }

  function deleteTask(taskId: string) {
    setBoard((currentBoard) => {
      const nextBoard = createEmptyBoard()

      for (const columnId of COLUMN_ORDER) {
        nextBoard[columnId] = currentBoard[columnId].filter(
          (task) => task.id !== taskId
        )
      }

      return nextBoard
    })
  }

  function resetBoard() {
    setBoard(cloneInitialBoard())
  }

  function clearDone() {
    setBoard((currentBoard) => ({
      ...currentBoard,
      done: [],
    }))
  }

  function handleDragStart(event: DragStartEvent) {
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

    setBoard((currentBoard) => {
      const sourceColumnId = findColumnForTask(currentBoard, activeId)
      const targetColumnId = isColumnId(overId)
        ? overId
        : findColumnForTask(currentBoard, overId)

      if (!sourceColumnId || !targetColumnId) {
        return currentBoard
      }

      const activeTask = currentBoard[sourceColumnId].find(
        (task) => task.id === activeId
      )

      if (!activeTask) {
        return currentBoard
      }

      if (sourceColumnId === targetColumnId) {
        const oldIndex = currentBoard[sourceColumnId].findIndex(
          (task) => task.id === activeId
        )
        const newIndex = currentBoard[targetColumnId].findIndex(
          (task) => task.id === overId
        )

        if (newIndex === -1 || oldIndex === newIndex) {
          return currentBoard
        }

        return {
          ...currentBoard,
          [sourceColumnId]: arrayMove(
            currentBoard[sourceColumnId],
            oldIndex,
            newIndex
          ),
        }
      }

      const targetIndex = isColumnId(overId)
        ? currentBoard[targetColumnId].length
        : currentBoard[targetColumnId].findIndex((task) => task.id === overId)
      const insertAt =
        targetIndex >= 0 ? targetIndex : currentBoard[targetColumnId].length

      return {
        ...currentBoard,
        [sourceColumnId]: currentBoard[sourceColumnId].filter(
          (task) => task.id !== activeId
        ),
        [targetColumnId]: [
          ...currentBoard[targetColumnId].slice(0, insertAt),
          activeTask,
          ...currentBoard[targetColumnId].slice(insertAt),
        ],
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <TaskComposer
          doneTasks={doneTasks}
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
              <Badge variant="outline">Browser only</Badge>
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
  onAddTask,
  onClearDone,
  onResetBoard,
  totalTasks,
}: {
  doneTasks: number
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
              id="task-notes"
              maxLength={220}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context, owner, or acceptance notes."
              value={description}
            />
          </div>
          <Button disabled={!title.trim()} type="submit">
            <Plus />
            Add task
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!doneTasks}
            onClick={onClearDone}
            type="button"
            variant="outline"
          >
            <CircleCheck />
            Clear done
          </Button>
          <Button
            disabled={!totalTasks}
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
  onDelete,
  onMove,
  task,
}: {
  columnId: ColumnId
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
  onDelete,
  onMove,
  task,
}: {
  columnId: ColumnId
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
              disabled={targetColumnId === columnId}
            >
              <ArrowRight />
              {COLUMNS[targetColumnId].title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
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
