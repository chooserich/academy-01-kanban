"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  SidebarGroup,
  SidebarGroupContent,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  CircleCheckIcon,
  CircleHelpIcon,
  CommandIcon,
  DatabaseZapIcon,
  KanbanIcon,
  LightbulbIcon,
  LoaderCircleIcon,
  SearchIcon,
  SquareKanbanIcon,
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "Project board",
      url: "/dashboard",
      icon: <KanbanIcon />,
    },
    {
      title: "Ideas",
      url: "#ideas",
      icon: <LightbulbIcon />,
    },
    {
      title: "On deck",
      url: "#on-deck",
      icon: <SquareKanbanIcon />,
    },
    {
      title: "In progress",
      url: "#in-progress",
      icon: <LoaderCircleIcon />,
    },
    {
      title: "Done",
      url: "#done",
      icon: <CircleCheckIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Help",
      url: "#new-task",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Search",
      url: "#task-title",
      icon: <SearchIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Kanban</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <DatabaseZapIcon className="size-4" />
                No database
              </div>
              Tasks are stored in this browser only.
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
