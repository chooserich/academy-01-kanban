alter table public.boards
add column owner_id uuid references auth.users(id) on delete cascade,
add column is_template boolean not null default false;

update public.boards
set is_template = true
where id = '00000000-0000-4000-8000-000000000001';

alter table public.boards
add constraint boards_owner_or_template_check
check (
  (is_template and owner_id is null)
  or (not is_template and owner_id is not null)
);

create index boards_owner_created_at_idx
on public.boards (owner_id, created_at)
where owner_id is not null;

alter table public.board_columns
add constraint board_columns_id_board_id_key unique (id, board_id);

alter table public.tasks
drop constraint if exists tasks_column_id_fkey;

alter table public.tasks
add constraint tasks_column_board_id_fkey
foreign key (column_id, board_id)
references public.board_columns(id, board_id)
on delete restrict;

revoke all on public.boards from anon, authenticated;
revoke all on public.board_columns from anon, authenticated;
revoke all on public.tasks from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.board_columns to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

create policy boards_select_owned
on public.boards
for select
to authenticated
using (owner_id = (select auth.uid()) and not is_template);

create policy boards_insert_owned
on public.boards
for insert
to authenticated
with check (owner_id = (select auth.uid()) and not is_template);

create policy boards_update_owned
on public.boards
for update
to authenticated
using (owner_id = (select auth.uid()) and not is_template)
with check (owner_id = (select auth.uid()) and not is_template);

create policy boards_delete_owned
on public.boards
for delete
to authenticated
using (owner_id = (select auth.uid()) and not is_template);

create policy board_columns_select_owned
on public.board_columns
for select
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_columns.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy board_columns_insert_owned
on public.board_columns
for insert
to authenticated
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_columns.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy board_columns_update_owned
on public.board_columns
for update
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_columns.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
)
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_columns.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy board_columns_delete_owned
on public.board_columns
for delete
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_columns.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy tasks_select_owned
on public.tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = tasks.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy tasks_insert_owned
on public.tasks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.boards
    where boards.id = tasks.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy tasks_update_owned
on public.tasks
for update
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = tasks.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
)
with check (
  exists (
    select 1
    from public.boards
    where boards.id = tasks.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create policy tasks_delete_owned
on public.tasks
for delete
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = tasks.board_id
      and boards.owner_id = (select auth.uid())
      and not boards.is_template
  )
);

create or replace function public.ensure_user_board()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_column record;
  template_id uuid;
  template_name text;
  user_board_id uuid;
  user_id uuid := auth.uid();
  user_column_id uuid;
begin
  if user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(user_id::text, 0));

  select id
  into user_board_id
  from public.boards
  where owner_id = user_id
    and not is_template
  order by created_at, id
  limit 1;

  if user_board_id is not null then
    return user_board_id;
  end if;

  select id, name
  into template_id, template_name
  from public.boards
  where is_template
  order by created_at, id
  limit 1;

  if template_id is null then
    raise exception 'The starter board template is missing.' using errcode = '55000';
  end if;

  insert into public.boards (name, owner_id, is_template)
  values (template_name, user_id, false)
  returning id into user_board_id;

  for template_column in
    select id, key, title, position
    from public.board_columns
    where board_id = template_id
    order by position, created_at, id
  loop
    insert into public.board_columns (board_id, key, title, position)
    values (
      user_board_id,
      template_column.key,
      template_column.title,
      template_column.position
    )
    returning id into user_column_id;

    insert into public.tasks (
      board_id,
      column_id,
      title,
      description,
      position,
      created_at,
      updated_at
    )
    select
      user_board_id,
      user_column_id,
      title,
      description,
      position,
      created_at,
      updated_at
    from public.tasks
    where board_id = template_id
      and column_id = template_column.id
    order by position, created_at, id;
  end loop;

  return user_board_id;
end;
$$;

create or replace function public.reset_user_board(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_column record;
  template_id uuid;
  user_column_id uuid;
  user_id uuid := auth.uid();
begin
  if user_id is null or not exists (
    select 1
    from public.boards
    where id = p_board_id
      and owner_id = user_id
      and not is_template
  ) then
    raise exception 'Board not found.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_board_id::text, 0));

  select id
  into template_id
  from public.boards
  where is_template
  order by created_at, id
  limit 1;

  if template_id is null then
    raise exception 'The starter board template is missing.' using errcode = '55000';
  end if;

  delete from public.tasks where board_id = p_board_id;
  delete from public.board_columns where board_id = p_board_id;

  for template_column in
    select id, key, title, position
    from public.board_columns
    where board_id = template_id
    order by position, created_at, id
  loop
    insert into public.board_columns (board_id, key, title, position)
    values (
      p_board_id,
      template_column.key,
      template_column.title,
      template_column.position
    )
    returning id into user_column_id;

    insert into public.tasks (
      board_id,
      column_id,
      title,
      description,
      position,
      created_at,
      updated_at
    )
    select
      p_board_id,
      user_column_id,
      title,
      description,
      position,
      created_at,
      updated_at
    from public.tasks
    where board_id = template_id
      and column_id = template_column.id
    order by position, created_at, id;
  end loop;
end;
$$;

create or replace function public.reorder_board_columns(
  p_board_id uuid,
  p_column_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  existing_count integer;
  supplied_count integer;
  user_id uuid := auth.uid();
begin
  if user_id is null or not exists (
    select 1
    from public.boards
    where id = p_board_id
      and owner_id = user_id
      and not is_template
  ) then
    raise exception 'Board not found.' using errcode = '42501';
  end if;

  select count(*)
  into existing_count
  from public.board_columns
  where board_id = p_board_id;

  select count(distinct column_id)
  into supplied_count
  from unnest(p_column_ids) as supplied(column_id);

  if existing_count = 0
    or coalesce(array_length(p_column_ids, 1), 0) <> existing_count
    or supplied_count <> existing_count
    or exists (
      select 1
      from unnest(p_column_ids) as supplied(column_id)
      where not exists (
        select 1
        from public.board_columns
        where board_id = p_board_id
          and id = supplied.column_id
      )
    )
  then
    raise exception 'Column order must include every board column exactly once.'
      using errcode = '22023';
  end if;

  update public.board_columns
  set position = -position - 1
  where board_id = p_board_id;

  update public.board_columns as column_to_order
  set position = supplied.ordinality - 1
  from unnest(p_column_ids) with ordinality as supplied(column_id, ordinality)
  where column_to_order.board_id = p_board_id
    and column_to_order.id = supplied.column_id;
end;
$$;

revoke all on function public.ensure_user_board() from public, anon;
revoke all on function public.reset_user_board(uuid) from public, anon;
revoke all on function public.reorder_board_columns(uuid, uuid[]) from public, anon;

grant execute on function public.ensure_user_board() to authenticated;
grant execute on function public.reset_user_board(uuid) to authenticated;
grant execute on function public.reorder_board_columns(uuid, uuid[]) to authenticated;
