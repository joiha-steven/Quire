-- Migration: transactional restore. `restore_tables(payload, table_names)` clears
-- and re-inserts the given content tables in ONE transaction, so a mid-restore
-- failure rolls back cleanly instead of leaving the site half-restored (the old
-- per-table clear+insert loop had no cross-table atomicity). Idempotent (CREATE OR
-- REPLACE). Blobs stay a separate best-effort step in the app (filesystem, not in
-- this txn). Run on the live DB, then reload the PostgREST schema cache.

create or replace function public.restore_tables(payload jsonb, table_names text[])
returns void
language plpgsql
as $$
declare
  t text;
  cols text;
  has_identity boolean;
  seqname text;
begin
  -- No FK constraints exist between these tables (comments.parent_id is a plain
  -- self-reference with NO constraint, by design), so delete order is unconstrained.
  foreach t in array table_names loop
    execute format('delete from public.%I', t);
  end loop;

  foreach t in array table_names loop
    if (payload ? t) and jsonb_typeof(payload -> t) = 'array' and jsonb_array_length(payload -> t) > 0 then
      -- Every real column EXCEPT generated ones (posts.search tsvector). Identity ids
      -- ARE included and preserved (OVERRIDING SYSTEM VALUE) so comments.parent_id links
      -- survive the restore; a faithful copy, not a re-key.
      select string_agg(quote_ident(column_name), ', ')
        into cols
        from information_schema.columns
        where table_schema = 'public' and table_name = t and is_generated <> 'ALWAYS';

      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and is_identity = 'YES'
      ) into has_identity;

      execute format(
        'insert into public.%I (%s) %s select %s from jsonb_populate_recordset(null::public.%I, $1 -> %L)',
        t, cols,
        case when has_identity then 'overriding system value' else '' end,
        cols, t, t
      ) using payload;

      -- Advance the identity sequence past the restored max id so later inserts don't collide.
      seqname := pg_get_serial_sequence('public.' || t, 'id');
      if seqname is not null then
        execute format('select setval(%L, (select coalesce(max(id), 1) from public.%I))', seqname, t);
      end if;
    end if;
  end loop;
end;
$$;
