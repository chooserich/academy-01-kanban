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
begin
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

revoke all on function public.reorder_board_columns(uuid, uuid[]) from public;
revoke all on function public.reorder_board_columns(uuid, uuid[]) from anon;
revoke all on function public.reorder_board_columns(uuid, uuid[]) from authenticated;
grant execute on function public.reorder_board_columns(uuid, uuid[]) to service_role;
