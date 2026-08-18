<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions

## Agent File Standard

Use `AGENTS.md` as the shared instruction file for coding agents in this
project. `CLAUDE.md` intentionally points here, so keep durable project
guidance in this file rather than duplicating it elsewhere.

Update this file whenever the project gains a new convention, tool, data store,
or verification requirement.

## Stack Defaults

- Use `pnpm` for package management.
- Use TypeScript for application code.
- Use Next.js App Router conventions.
- Prefer Server Components by default; add `"use client"` only for components
  that need browser state, effects, drag/drop, local storage, or event handlers.
- Before changing Next.js routing, layouts, metadata, caching, or other
  framework behavior, read the matching local docs under
  `node_modules/next/dist/docs/`.

## shadcn/ui Usage

- This project uses shadcn/ui with Tailwind v4 and the `base-nova` style.
- Add shadcn components with `pnpm dlx shadcn@latest add <component> --yes`.
- Keep generated shadcn components under `components/ui/`.
- Prefer composing local product components from `components/ui/*` instead of
  editing generated UI primitives unless the primitive itself is wrong.
- This shadcn version uses Base UI composition. Follow the generated `render`
  prop pattern already present in the UI files instead of assuming older
  `asChild` examples apply.
- Wrap tooltip-using surfaces with `TooltipProvider`; the root layout already
  does this.
- Use Lucide icons for UI actions and navigation when an icon is needed.

## Font Requirements

- The app should use Geist Sans for normal text and headings, and Geist Mono for
  monospace text.
- Fonts are loaded in `app/layout.tsx` with `next/font/google`.
- `app/globals.css` must map Tailwind font tokens to the Next font variables:

  ```css
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-geist-sans);
  ```

- Do not set `--font-sans: var(--font-sans);`. That self-reference causes the
  browser to fall back to a serif font such as Times.
- After touching fonts or theme tokens, verify the live computed font family in
  the browser. `html`, `body`, and app headings should compute to Geist, not
  Times.

## Current Data Model

- There is no database, API route, SQL store, Prisma schema, Supabase project,
  or server-side persistence in this version.
- Kanban data is stored in the browser using `localStorage`.
- The storage key is `kanban-board:v1`.
- The local data shape is:

  ```ts
  type BoardState = Record<ColumnId, Task[]>

  type Task = {
    id: string
    title: string
    description: string
    createdAt: string
  }
  ```

- Columns are defined by `COLUMN_ORDER` in `components/kanban-board.tsx`:
  `ideas`, `on-deck`, `in-progress`, and `done`.
- Any future database migration should preserve this product model first, then
  add persistence deliberately.

## Kanban Product Rules

- New tasks start in `Ideas`.
- Users can move cards by drag/drop or by the card action menu.
- Keep no-database behavior explicit in the UI until a real persistence layer is
  introduced.
- If local storage parsing fails, the app should fall back safely to the sample
  board rather than crashing.

## Verification

- Run `pnpm lint` before handoff after code changes.
- Run `pnpm build` before handoff after code changes.
- For UI changes, open the local app and verify the actual browser behavior,
  not just TypeScript compilation.
- When testing the current app locally, use the dev server URL reported by
  Next.js. If port `3000` is occupied, Next may use another port such as `3001`.
