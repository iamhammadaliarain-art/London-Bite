-- Final EOD race guard: order insert must acquire the same per-business-day lock
-- before it checks whether the day is open. This prevents an order from passing the
-- open check, waiting behind EOD, and then inserting after the day has closed.

create or replace function public.lb_assign_business_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_next integer;
begin
  v_date := coalesce(new.business_date, public.lb_business_date(coalesce(new.created_at, now())));
  new.business_date := v_date;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lb-order-' || v_date::text, 0)
  );

  insert into public.lb_business_days(business_date, status)
  values(v_date, 'open')
  on conflict (business_date) do nothing;

  if exists(
    select 1
    from public.lb_business_days d
    where d.business_date = v_date and d.status = 'closed'
  ) then
    raise exception 'End of Day is closed for %. New orders start on the next business day.', v_date;
  end if;

  if new.business_order_number is null then
    select coalesce(max(o.business_order_number), 0) + 1
      into v_next
      from public.lb_orders o
     where o.business_date = v_date;
    new.business_order_number := v_next;
  end if;

  return new;
end;
$$;

revoke execute on function public.lb_assign_business_order_number() from public, anon, authenticated;
