create extension if not exists pgcrypto with schema extensions;

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  key text not null,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, key),
  unique (board_id, position)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null references public.board_columns(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 220),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_board_id_idx on public.tasks (board_id);
create index tasks_column_position_idx on public.tasks (column_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger boards_set_updated_at
before update on public.boards
for each row
execute function public.set_updated_at();

create trigger board_columns_set_updated_at
before update on public.board_columns
for each row
execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.boards to service_role;
grant select, insert, update, delete on public.board_columns to service_role;
grant select, insert, update, delete on public.tasks to service_role;

insert into public.boards (id, name, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'Project board',
  '2026-08-18T14:00:00.000Z',
  '2026-08-18T14:00:00.000Z'
)
on conflict (id) do update
set name = excluded.name;

insert into public.board_columns (id, board_id, key, title, position)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'ideas',
    'Ideas',
    0
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'on-deck',
    'On deck',
    1
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000001',
    'in-progress',
    'In progress',
    2
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000001',
    'done',
    'Done',
    3
  )
on conflict (id) do update
set
  key = excluded.key,
  title = excluded.title,
  position = excluded.position;

insert into public.tasks (
  id,
  board_id,
  column_id,
  title,
  description,
  position,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Collect feature ideas',
    'Capture rough product ideas before choosing what matters.',
    0,
    '2026-08-18T14:00:00.000Z',
    '2026-08-18T14:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000102',
    'Shape the first task flow',
    'Decide what fields a lightweight task really needs.',
    0,
    '2026-08-18T14:05:00.000Z',
    '2026-08-18T14:05:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000103',
    'Build the board shell',
    'Use the shadcn dashboard layout as the workspace frame.',
    0,
    '2026-08-18T14:10:00.000Z',
    '2026-08-18T14:10:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000104',
    'Start without a database',
    'Keep everything in local browser state for now.',
    0,
    '2026-08-18T14:15:00.000Z',
    '2026-08-18T14:15:00.000Z'
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  position = excluded.position;
