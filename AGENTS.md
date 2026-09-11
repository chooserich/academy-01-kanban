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
- Theme selection uses `next-themes` with the `class` attribute and defaults to
  the system preference. Keep Light, Dark, and System available from the user
  menu, and keep `suppressHydrationWarning` on the root `<html>` element.

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

- Supabase-backed Postgres is the intended persistence layer for this project.
- The app uses Next.js API routes under `app/api/kanban/` for all writes and
  reads. Requests use the signed-in user's cookie session and database RLS;
  the application does not use a service-role key.
- The required environment variables are `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The legacy
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` name is supported for local and older
  Supabase projects.
- Supabase Auth uses email/password with SSR cookie sessions from
  `@supabase/ssr`. Validate server identities with `auth.getClaims()` rather
  than trusting `auth.getSession()`.
- Hosted Supabase Auth uses `https://academy-01-kanban.vercel.app` as its Site
  URL. Keep the canonical `/auth/callback`, the Vercel Preview wildcard, and
  `http://localhost:3000/**` in the redirect allowlist so confirmation and
  recovery links return to the environment that initiated them.
- The initial schema, hidden starter template, and ownership policies live in
  `supabase/migrations/`.
- Local Supabase uses the `565xx` port block in `supabase/config.toml` to avoid
  colliding with other local Supabase projects. Analytics is disabled locally
  because this Kanban app does not use it and the local health check can slow
  startup.
- When Supabase is temporarily unreachable for an authenticated user, the board
  falls back to browser `localStorage` under `kanban-board:v2:<user-id>`. The
  first authenticated user on an existing browser claims and removes the old
  unscoped `kanban-board:v2` or `kanban-board:v1` record.
- The product-level board shape is:

  ```ts
  type BoardState = {
    id: string
    name: string
    columns: BoardColumn[]
  }

  type BoardColumn = {
    id: string
    key: string
    title: string
    tasks: Task[]
  }

  type Task = {
    id: string
    title: string
    description: string
    createdAt: string
  }
  ```

- Database column keys are arbitrary non-null text values and must only be
  unique within their board. Do not add a fixed-name check constraint.
- `ideas`, `on-deck`, `in-progress`, and `done` are the current starter-board
  template in `lib/kanban/board.ts`, not database-enforced column names.
- Column array order is product state and maps to `board_columns.position` in
  Postgres. Reorder all columns atomically through `reorder_board_columns`.
- Keep database, API, and local fallback behavior mapped to this ordered model.
- Boards are private to `boards.owner_id`. Columns and tasks inherit ownership
  through `board_id`, and database RLS is the final authorization boundary.
- The original fixed board row is a hidden template. `ensure_user_board`
  snapshots it only for a user's first board. Future additional boards should
  start empty rather than cloning the template.

## Kanban Product Rules

- New tasks start in the board's first column.
- Users can add columns and reorder them by drag/drop or the column action menu.
- Remove only empty columns, and always keep at least one column. Postgres uses
  a restrictive task foreign key as the final guard against task loss.
- Users can move cards by drag/drop or by the card action menu.
- Keep persistence state explicit in the UI: Supabase when configured, browser
  fallback otherwise.
- If local storage parsing fails, the app should fall back safely to the sample
  board rather than crashing.

## Verification

- Run `pnpm lint` before handoff after code changes.
- Run `pnpm build` before handoff after code changes.
- For UI changes, open the local app and verify the actual browser behavior,
  not just TypeScript compilation.
- When testing the current app locally, use the dev server URL reported by
  Next.js. If port `3000` is occupied, Next may use another port such as `3001`.

## Production Releases

- `.github/workflows/production.yml` applies pending Supabase migrations after
  a commit reaches `main`.
- Keep the GitHub check named `Migrate production database` stable and require
  it in Vercel Production Deployment Checks. Without that check, Vercel's Git
  deployment and the migration action race each other.
- Store `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and
  `SUPABASE_PROJECT_ID` as encrypted GitHub Actions secrets. Never commit them
  or expose the Supabase service-role key to browser code.
- Add schema changes as new timestamped migration files. Do not rewrite a
  migration after it has been applied to production.
- Production migrations must remain backward-compatible with the currently
  deployed app because the database updates before the new deployment becomes
  active. Use an expand-and-contract sequence for destructive schema changes.
- Never run `supabase db reset --linked` or `supabase db push --include-seed`
  against production.
- Configure Supabase Auth redirect URLs and the Vercel Preview/Production public
  URL and publishable key before deploying authentication changes.
