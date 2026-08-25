# Academy Kanban

A small Next.js, TypeScript, and shadcn/ui Kanban board. Its starter board uses
Ideas, On deck, In progress, and Done, while the database accepts arbitrary
column keys.

## Getting Started

Install dependencies and run the app:

```bash
pnpm install
pnpm dev
```

Open the local URL reported by Next.js, usually
[http://localhost:3000/dashboard](http://localhost:3000/dashboard).

## Supabase Persistence

The app uses Supabase Postgres when these values are present in `.env.local`:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

To run Supabase locally:

```bash
pnpm supabase:start
pnpm supabase:status
pnpm supabase:reset
```

Copy the `API_URL` from `pnpm supabase:status` into `SUPABASE_URL`, and copy
the `SERVICE_ROLE_KEY` into `SUPABASE_SERVICE_ROLE_KEY`. Restart `pnpm dev`
after changing `.env.local`.

The first migration creates the `Project board` and the initial sample cards.
If Supabase is not configured or reachable, the UI keeps working with browser
`localStorage` as a fallback.

## Useful Commands

```bash
pnpm lint
pnpm build
pnpm supabase:start
pnpm supabase:status
pnpm supabase:reset
pnpm supabase:stop
```

## Notes

This project uses Geist Sans and Geist Mono through `next/font/google`. Keep
font token changes aligned with `AGENTS.md` so shadcn theme values do not fall
back to browser serif fonts.

Future agents should treat `AGENTS.md` as the durable project guide.
