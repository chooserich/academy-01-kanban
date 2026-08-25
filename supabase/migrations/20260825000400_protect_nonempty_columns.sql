alter table public.tasks
drop constraint if exists tasks_column_id_fkey;

alter table public.tasks
add constraint tasks_column_id_fkey
foreign key (column_id)
references public.board_columns(id)
on delete restrict;
