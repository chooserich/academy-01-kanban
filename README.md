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

## Supabase Authentication and Persistence

Each signed-in user gets a private board backed by Supabase Postgres. The first
board is copied from the starter template; future board-creation support can
create additional empty boards. Set these values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted for local and older Supabase
projects. The service-role key is not used by the app.

To run Supabase locally:

```bash
pnpm supabase:start
pnpm supabase:status
pnpm supabase:reset
```

Copy the `API_URL` from `pnpm supabase:status` into
`NEXT_PUBLIC_SUPABASE_URL`. If local status reports `ANON_KEY`, copy it into
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Restart `pnpm dev` after changing
`.env.local`.

The migrations keep the original `Project board` as a hidden template and add
row-level security for user-owned boards, columns, and tasks. If Supabase
becomes temporarily unreachable after a user has signed in, the UI uses an
account-scoped browser fallback.

For hosted Supabase, configure **Authentication > URL Configuration** with the
production site URL and add this app's callback URLs to the redirect allow
list, including Preview URLs if they should support sign-in:

```text
http://localhost:3000/auth/callback
https://academy-01-kanban.vercel.app/auth/callback
https://academy-01-kanban-*-nick-oneills-projects.vercel.app/**
```

Set the hosted Supabase **Site URL** to
`https://academy-01-kanban.vercel.app`. Supabase falls back to this URL when a
requested redirect is not allowlisted, so leaving it set to localhost will
send production confirmation links back to a local server.

Hosted projects normally require email confirmation. Configure custom SMTP
before relying on confirmation and password-reset email in production.

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

Add the public Supabase URL and publishable key to both Vercel Preview and
Production environments. A service-role key is neither required nor read by
the deployed application.

## Notes

This project uses Geist Sans and Geist Mono through `next/font/google`. Keep
font token changes aligned with `AGENTS.md` so shadcn theme values do not fall
back to browser serif fonts.

Future agents should treat `AGENTS.md` as the durable project guide.
