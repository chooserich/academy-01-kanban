import Link from "next/link"
import { CommandIcon } from "lucide-react"

export function AuthShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description: string
  title: string
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold"
          href="/"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CommandIcon className="size-4" />
          </span>
          Kanban
        </Link>
        <div className="rounded-lg border bg-background p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}
