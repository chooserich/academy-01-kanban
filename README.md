# Academy Kanban

A small Next.js, TypeScript, and shadcn/ui Kanban board. Its starter board uses
Ideas, On deck, In progress, and Done, while the database accepts arbitrary
column keys. Columns can be added, removed when empty, and reordered from the
dashboard.

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

The migrations create the `Project board`, its initial sample cards, and the
atomic column-ordering function. If Supabase is not configured or reachable,
the UI keeps working with browser `localStorage` as a fallback.

## Useful Commands

```bash
pnpm lint
pnpm build
pnpm supabase:start
pnpm supabase:status
pnpm supabase:reset
pnpm supabase:stop
```

## Production Deployment

`.github/workflows/production.yml` runs whenever a commit reaches `main`. It
links the production Supabase project, previews pending migrations, and applies
them with `supabase db push`.

Add these encrypted repository secrets in GitHub under **Settings > Secrets and
variables > Actions**:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_ID
```

In Vercel, add the GitHub check named **Migrate production database** as a
required Production Deployment Check. Vercel can build the commit immediately,
but it will not promote that build to the production domain until the migration
check passes. The workflow can also be run manually from GitHub Actions.

Use a fresh hosted Supabase project when possible. If the target project
already has tables created outside these migration files, reconcile its schema
and migration history before merging; the dry run is the checkpoint for that.

Never use `supabase db reset --linked` or `supabase db push --include-seed`
against production.

> **Access warning:** The current API routes do not authenticate visitors. A
> live deployment is one publicly writable shared board. Add authentication or
> Vercel deployment protection before storing private data.

## Notes

This project uses Geist Sans and Geist Mono through `next/font/google`. Keep
font token changes aligned with `AGENTS.md` so shadcn theme values do not fall
back to browser serif fonts.

Future agents should treat `AGENTS.md` as the durable project guide.
