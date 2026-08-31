-- Follow-up hardening for London Bite iPOS business-day handling.
-- Operational rules:
--   * Expense sheet opens at 14:00 and accepts entries until 03:00 Asia/Karachi.
--   * Orders for the evening shift and after-midnight close belong to the same business date.
--   * EOD can be closed from 02:00 through 03:30.
--   * Once EOD is closed, the UI advances immediately to a fresh next-day sheet.
--   * Visible LBSAG numbering restarts at 0001 for each business date.

create or replace function public.lb_business_date(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when (p_at at time zone 'Asia/Karachi')::time < time '14:00'
      then (p_at at time zone 'Asia/Karachi')::date - 1
    else (p_at at time zone 'Asia/Karachi')::date
  end;
$$;

-- Re-key any rows backfilled by the earlier migration so the whole evening / after-midnight
-- shift stays together. Drop the uniqueness index during the deterministic rebuild to avoid
-- transient collisions while rows move between business dates.
drop index if exists public.lb_orders_business_number_uidx;

with ranked as (
  select
    id,
    public.lb_business_date(created_at) as business_date,
    row_number() over (
      partition by public.lb_business_date(created_at)
      order by created_at, id
    )::integer as business_order_number
  from public.lb_orders
)
update public.lb_orders o
set business_date = r.business_date,
    business_order_number = r.business_order_number
from ranked r
where r.id = o.id;

create unique index if not exists lb_orders_business_number_uidx
  on public.lb_orders(business_date, business_order_number);

create or replace function public.lb_ipos_visible_date(p_at timestamptz default now())
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date := public.lb_business_date(p_at);
begin
  if exists(
    select 1
    from public.lb_business_days d
    where d.business_date = v_date and d.status = 'closed'
  ) then
    return v_date + 1;
  end if;
  return v_date;
end;
$$;

create or replace function public.lb_ipos_daily_summary(p_business_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_date date;
  v_status text;
  v_closed_at timestamptz;
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager','counter') then
    raise exception 'Counter or management access required';
  end if;

  v_date := coalesce(p_business_date, public.lb_ipos_visible_date(now()));
  select d.status, d.closed_at into v_status, v_closed_at
    from public.lb_business_days d
   where d.business_date = v_date;
  v_status := coalesce(v_status, 'open');

  return jsonb_build_object(
    'business_date', v_date,
    'status', v_status,
    'closed_at', v_closed_at,
    'order_count', (
      select count(*) from public.lb_orders o
      where o.business_date = v_date and o.order_status <> 'cancelled'
    ),
    'paid_sales', (
      select coalesce(sum(o.total),0) from public.lb_orders o
      where o.business_date = v_date and o.order_status <> 'cancelled' and o.payment_status = 'paid'
    ),
    'cash_sales', (
      select coalesce(sum(o.total),0) from public.lb_orders o
      where o.business_date = v_date and o.order_status <> 'cancelled'
        and o.payment_status = 'paid' and o.payment_method = 'cash'
    ),
    'online_sales', (
      select coalesce(sum(o.total),0) from public.lb_orders o
      where o.business_date = v_date and o.order_status <> 'cancelled'
        and o.payment_status = 'paid' and o.payment_method = 'online'
    ),
    'unpaid_count', (
      select count(*) from public.lb_orders o
      where o.business_date = v_date and o.order_status <> 'cancelled' and o.payment_status <> 'paid'
    ),
    'unpaid_total', (
      select coalesce(sum(o.total),0) from public.lb_orders o
      where o.business_date = v_date and o.order_status <> 'cancelled' and o.payment_status <> 'paid'
    ),
    'expense_total', (
      select coalesce(sum(e.amount),0) from public.lb_expenses e where e.business_date = v_date
    ),
    'net_after_expenses', (
      (select coalesce(sum(o.total),0) from public.lb_orders o
        where o.business_date = v_date and o.order_status <> 'cancelled' and o.payment_status = 'paid')
      -
      (select coalesce(sum(e.amount),0) from public.lb_expenses e where e.business_date = v_date)
    ),
    'next_order_number', (
      select coalesce(max(o.business_order_number),0) + 1
      from public.lb_orders o where o.business_date = v_date
    ),
    'expenses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'business_date', e.business_date,
        'category', e.category,
        'detail', e.detail,
        'amount', e.amount,
        'payment_method', e.payment_method,
        'created_at', e.created_at
      ) order by e.created_at desc), '[]'::jsonb)
      from public.lb_expenses e
      where e.business_date = v_date
    )
  );
end;
$$;

create or replace function public.lb_ipos_add_expense(
  p_category text,
  p_detail text,
  p_amount numeric,
  p_payment_method text default 'cash'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_date date;
  v_local_time time;
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager','counter') then
    raise exception 'Counter or management access required';
  end if;

  v_date := public.lb_business_date(now());
  v_local_time := (now() at time zone 'Asia/Karachi')::time;

  if not (v_local_time >= time '14:00' or v_local_time < time '03:00') then
    raise exception 'Expense entry opens at 2:00 PM and closes at 3:00 AM.';
  end if;

  if length(trim(coalesce(p_category,''))) < 2 or length(trim(coalesce(p_category,''))) > 60 then
    raise exception 'Choose a valid expense category';
  end if;
  if length(coalesce(p_detail,'')) > 300 then
    raise exception 'Expense detail is too long';
  end if;
  if coalesce(p_amount,0) <= 0 or p_amount > 1000000 then
    raise exception 'Enter a valid expense amount';
  end if;
  if p_payment_method not in ('cash','online','bank','other') then
    raise exception 'Invalid expense payment method';
  end if;

  -- Same transaction lock as order-number allocation and EOD closure. This prevents an
  -- expense from committing between the closing snapshot and the day being marked closed.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lb-order-' || v_date::text, 0));

  insert into public.lb_business_days(business_date, status)
  values(v_date, 'open')
  on conflict (business_date) do nothing;

  if exists(
    select 1 from public.lb_business_days d
    where d.business_date = v_date and d.status = 'closed'
  ) then
    raise exception 'End of day is closed. This expense sheet is locked.';
  end if;

  insert into public.lb_expenses(business_date, category, detail, amount, payment_method, created_by_user)
  values(v_date, trim(p_category), trim(coalesce(p_detail,'')), p_amount, p_payment_method, auth.uid());

  insert into public.lb_audit_events(actor_type, actor_id, action, entity_type, entity_id, metadata)
  values('staff', auth.uid()::text, 'expense_added', 'business_day', v_date::text,
    jsonb_build_object('category',trim(p_category),'amount',p_amount,'payment_method',p_payment_method));

  return public.lb_ipos_daily_summary(v_date);
end;
$$;

create or replace function public.lb_ipos_close_day()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_date date;
  v_local_time time;
  v_snapshot jsonb;
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager') then
    raise exception 'Owner or manager access required to close end of day';
  end if;

  v_date := public.lb_business_date(now());
  v_local_time := (now() at time zone 'Asia/Karachi')::time;

  if not (v_local_time >= time '02:00' and v_local_time <= time '03:30') then
    raise exception 'End of Day can be closed between 2:00 AM and 3:30 AM.';
  end if;

  -- Serialize closure against both order inserts and expense inserts for this business date.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lb-order-' || v_date::text, 0));

  insert into public.lb_business_days(business_date, status)
  values(v_date, 'open')
  on conflict (business_date) do nothing;

  if exists(
    select 1 from public.lb_business_days d
    where d.business_date = v_date and d.status = 'closed'
  ) then
    return public.lb_ipos_daily_summary(v_date + 1);
  end if;

  v_snapshot := public.lb_ipos_daily_summary(v_date);

  update public.lb_business_days
     set status='closed',
         closed_at=now(),
         closed_by_user=auth.uid(),
         closing_snapshot=v_snapshot,
         updated_at=now()
   where business_date=v_date;

  insert into public.lb_audit_events(actor_type, actor_id, action, entity_type, entity_id, metadata)
  values('staff', auth.uid()::text, 'end_of_day_closed', 'business_day', v_date::text, v_snapshot);

  -- The old sheet is archived. Return the fresh next-day sheet immediately.
  return public.lb_ipos_daily_summary(v_date + 1);
end;
$$;

-- Backward-compatible retrieve: always current visible business date only.
create or replace function public.lb_counter_orders(p_query text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_date date := public.lb_ipos_visible_date(now());
  v_query text := lower(trim(coalesce(p_query,'')));
  v_digits text := regexp_replace(coalesce(p_query,''), '\D', '', 'g');
  v_order_no integer := null;
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager','counter') then
    raise exception 'Counter access required';
  end if;

  if length(v_digits) between 1 and 9 then
    v_order_no := v_digits::integer;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'order_number', o.business_order_number,
      'customer_name', o.customer_name,
      'customer_phone', o.customer_phone,
      'fulfilment', o.fulfilment,
      'payment_method', o.payment_method,
      'payment_status', o.payment_status,
      'status', o.order_status,
      'total', o.total,
      'source', o.source,
      'created_at', o.created_at,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', i.item_name,
          'quantity', i.quantity,
          'line_total', i.line_total
        ) order by i.created_at), '[]'::jsonb)
        from public.lb_order_items i where i.order_id = o.id
      )
    ) order by o.created_at desc), '[]'::jsonb)
    from (
      select x.*
      from public.lb_orders x
      where x.business_date = v_date
        and (
          v_query = ''
          or lower(coalesce(x.customer_name,'')) like '%' || v_query || '%'
          or (v_digits <> '' and regexp_replace(coalesce(x.customer_phone,''), '\D', '', 'g') like '%' || v_digits || '%')
          or (v_order_no is not null and x.business_order_number = v_order_no)
          or lower('lbsag-' || lpad(x.business_order_number::text,4,'0')) = v_query
          or lower('lbsag' || lpad(x.business_order_number::text,4,'0')) = v_query
        )
      order by x.created_at desc
      limit 100
    ) o
  );
end;
$$;

-- Date-scoped retrieve for the new UI. Previous-day bills can only appear when that
-- business date is deliberately selected by the operator.
create or replace function public.lb_counter_orders_v2(
  p_query text default null,
  p_business_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_date date := coalesce(p_business_date, public.lb_ipos_visible_date(now()));
  v_query text := lower(trim(coalesce(p_query,'')));
  v_digits text := regexp_replace(coalesce(p_query,''), '\D', '', 'g');
  v_order_no integer := null;
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager','counter') then
    raise exception 'Counter access required';
  end if;

  if length(v_digits) between 1 and 9 then
    v_order_no := v_digits::integer;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'order_number', o.business_order_number,
      'customer_name', o.customer_name,
      'customer_phone', o.customer_phone,
      'fulfilment', o.fulfilment,
      'payment_method', o.payment_method,
      'payment_status', o.payment_status,
      'status', o.order_status,
      'total', o.total,
      'source', o.source,
      'created_at', o.created_at,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', i.item_name,
          'quantity', i.quantity,
          'line_total', i.line_total
        ) order by i.created_at), '[]'::jsonb)
        from public.lb_order_items i where i.order_id = o.id
      )
    ) order by o.created_at desc), '[]'::jsonb)
    from (
      select x.*
      from public.lb_orders x
      where x.business_date = v_date
        and (
          v_query = ''
          or lower(coalesce(x.customer_name,'')) like '%' || v_query || '%'
          or (v_digits <> '' and regexp_replace(coalesce(x.customer_phone,''), '\D', '', 'g') like '%' || v_digits || '%')
          or (v_order_no is not null and x.business_order_number = v_order_no)
          or lower('lbsag-' || lpad(x.business_order_number::text,4,'0')) = v_query
          or lower('lbsag' || lpad(x.business_order_number::text,4,'0')) = v_query
        )
      order by x.created_at desc
      limit 100
    ) o
  );
end;
$$;

-- Harden function privileges. Trigger helper cannot be called directly as an RPC; visible-date
-- helper is internal. Client-facing functions remain authenticated-only.
revoke execute on function public.lb_assign_business_order_number() from public, anon, authenticated;
revoke execute on function public.lb_ipos_visible_date(timestamptz) from public, anon, authenticated;
revoke execute on function public.lb_ipos_daily_summary(date) from public, anon, authenticated;
revoke execute on function public.lb_ipos_add_expense(text,text,numeric,text) from public, anon, authenticated;
revoke execute on function public.lb_ipos_close_day() from public, anon, authenticated;
revoke execute on function public.lb_counter_orders(text) from public, anon, authenticated;
revoke execute on function public.lb_counter_orders_v2(text,date) from public, anon, authenticated;

grant execute on function public.lb_ipos_daily_summary(date) to authenticated;
grant execute on function public.lb_ipos_add_expense(text,text,numeric,text) to authenticated;
grant execute on function public.lb_ipos_close_day() to authenticated;
grant execute on function public.lb_counter_orders(text) to authenticated;
grant execute on function public.lb_counter_orders_v2(text,date) to authenticated;

notify pgrst, 'reload schema';
