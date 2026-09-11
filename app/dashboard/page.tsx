import { AppSidebar } from "@/components/app-sidebar"
import { KanbanBoard } from "@/components/kanban-board"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requirePageUser } from "@/lib/supabase/auth"

export default async function Page() {
  const user = await requirePageUser()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={{ email: user.email }} variant="inset" />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <KanbanBoard userId={user.userId} />
      </SidebarInset>
    </SidebarProvider>
  )
}
