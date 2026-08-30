-- London Bite iPOS business-day / EOD hardening.
-- Business-day boundary: 03:00 Asia/Karachi. A shift that starts in the afternoon
-- and closes after midnight remains on the same business_date.
-- Public/internal global order_number is preserved for referential safety; the
-- counter-facing number is business_order_number and restarts at 1 per day.

create or replace function public.lb_business_date(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when (p_at at time zone 'Asia/Karachi')::time < time '03:00'
      then (p_at at time zone 'Asia/Karachi')::date - 1
    else (p_at at time zone 'Asia/Karachi')::date
  end;
$$;

alter table public.lb_orders add column if not exists business_date date;
alter table public.lb_orders add column if not exists business_order_number integer;

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
where r.id = o.id
  and (o.business_date is null or o.business_order_number is null);

alter table public.lb_orders alter column business_date set not null;
alter table public.lb_orders alter column business_order_number set not null;

create unique index if not exists lb_orders_business_number_uidx
  on public.lb_orders(business_date, business_order_number);
create index if not exists lb_orders_business_date_created_idx
  on public.lb_orders(business_date, created_at desc);
create index if not exists lb_orders_status_created_idx
  on public.lb_orders(order_status, created_at desc);

create table if not exists public.lb_business_days (
  business_date date primary key,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz null,
  closed_by_user uuid null,
  closing_snapshot jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lb_expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  business_date date not null,
  category text not null,
  detail text not null default '',
  amount numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  payment_method text not null default 'cash' check (payment_method in ('cash','online','bank','other')),
  created_by_user uuid null,
  created_at timestamptz not null default now()
);

alter table public.lb_business_days enable row level security;
alter table public.lb_expenses enable row level security;
revoke all on public.lb_business_days from anon, authenticated;
revoke all on public.lb_expenses from anon, authenticated;

create index if not exists lb_expenses_business_date_created_idx
  on public.lb_expenses(business_date, created_at desc);

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

  insert into public.lb_business_days(business_date, status)
  values(v_date, 'open')
  on conflict (business_date) do nothing;

  if exists(
    select 1 from public.lb_business_days d
    where d.business_date = v_date and d.status = 'closed'
  ) then
    raise exception 'End of day is closed for %. New orders start on the next business day.', v_date;
  end if;

  if new.business_order_number is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lb-order-' || v_date::text, 0));
    select coalesce(max(o.business_order_number), 0) + 1
      into v_next
      from public.lb_orders o
     where o.business_date = v_date;
    new.business_order_number := v_next;
  end if;

  return new;
end;
$$;

drop trigger if exists lb_orders_business_number_before_insert on public.lb_orders;
create trigger lb_orders_business_number_before_insert
before insert on public.lb_orders
for each row execute function public.lb_assign_business_order_number();

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

  v_date := coalesce(p_business_date, public.lb_business_date(now()));
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
      select coalesce(max(o.business_order_number),0) + 1 from public.lb_orders o where o.business_date = v_date
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

  -- London Bite expense entry window: 14:00 until the 03:00 business-day cutoff.
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

  insert into public.lb_business_days(business_date, status)
  values(v_date, 'open')
  on conflict (business_date) do nothing;

  if exists(select 1 from public.lb_business_days d where d.business_date=v_date and d.status='closed') then
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
  v_snapshot jsonb;
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager') then
    raise exception 'Owner or manager access required to close end of day';
  end if;

  v_date := public.lb_business_date(now());

  if exists(select 1 from public.lb_business_days d where d.business_date=v_date and d.status='closed') then
    return public.lb_ipos_daily_summary(v_date);
  end if;

  insert into public.lb_business_days(business_date, status)
  values(v_date, 'open')
  on conflict (business_date) do nothing;

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

  return public.lb_ipos_daily_summary(v_date);
end;
$$;

-- Default retrieve is intentionally current-business-day only. Historical data is
-- still searchable, but it is no longer loaded on every normal counter visit.
create or replace function public.lb_counter_orders(p_query text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_date date := public.lb_business_date(now());
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
        from public.lb_order_items i
        where i.order_id = o.id
      )
    ) order by o.created_at desc), '[]'::jsonb)
    from (
      select x.*
      from public.lb_orders x
      where
        (v_query = '' and x.business_date = v_date)
        or
        (v_query <> '' and (
          lower(coalesce(x.customer_name,'')) like '%' || v_query || '%'
          or (v_digits <> '' and regexp_replace(coalesce(x.customer_phone,''), '\D', '', 'g') like '%' || v_digits || '%')
          or (v_order_no is not null and x.business_date = v_date and x.business_order_number = v_order_no)
          or lower('lbsag-' || lpad(x.business_order_number::text,4,'0')) = v_query
        ))
      order by x.created_at desc
      limit 100
    ) o
  );
end;
$$;

-- Keep kitchen/management active queues lightweight while displaying the daily
-- business ticket number rather than the internal global sequence.
create or replace function public.lb_operations_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_employee uuid;
begin
  v_role := public.lb_staff_role();
  v_employee := public.lb_my_employee_id();
  if v_role not in ('owner','manager','kitchen','rider') then
    raise exception 'Operations order access required';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,
      'order_number',o.business_order_number,
      'status',o.order_status,
      'fulfilment',o.fulfilment,
      'payment_status',o.payment_status,
      'total',o.total,
      'created_at',o.created_at,
      'customer_name',case when v_role in ('owner','manager','rider') then o.customer_name else null end,
      'customer_phone',case when v_role in ('owner','manager','rider') then o.customer_phone else null end,
      'delivery_address',case when v_role in ('owner','manager','rider') then o.delivery_address else null end,
      'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity) order by i.created_at),'[]'::jsonb) from public.lb_order_items i where i.order_id=o.id)
    ) order by coalesce(o.scheduled_for,o.created_at),o.created_at), '[]'::jsonb)
    from public.lb_orders o
    where o.order_status in ('accepted','preparing','ready','out_for_delivery')
      and (o.scheduled_for is null or o.scheduled_for <= now()+interval '30 minutes' or v_role in ('owner','manager'))
      and (
        v_role in ('owner','manager')
        or (v_role='kitchen' and o.order_status in ('accepted','preparing','ready'))
        or (v_role='rider' and exists(
          select 1 from public.lb_rider_assignments ra
          where ra.order_id=o.id and ra.employee_id=v_employee and ra.status in ('assigned','picked_up')
        ))
      )
  );
end;
$$;

-- Compatibility wrappers: existing UI contracts keep the field name order_number,
-- but the value returned to staff is now the per-business-day number.
create or replace function public.lb_counter_create_operational_order_v2(
  p_customer_name text,
  p_customer_phone text,
  p_channel text,
  p_table_identifier text,
  p_pickup_name text,
  p_delivery_address text,
  p_payment_method text,
  p_payment_status text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := public.lb_counter_create_operational_order(
    p_customer_name,p_customer_phone,p_channel,p_table_identifier,p_pickup_name,
    p_delivery_address,p_payment_method,p_payment_status,p_notes,p_items
  );
  v_id := (v_result->>'id')::uuid;
  return v_result || (
    select jsonb_build_object('order_number',o.business_order_number,'business_date',o.business_date)
    from public.lb_orders o where o.id=v_id
  );
end;
$$;

create or replace function public.lb_counter_create_order_v3(
  p_customer_name text,
  p_customer_phone text,
  p_fulfilment text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := public.lb_counter_create_order_v2(p_customer_name,p_customer_phone,p_fulfilment,p_items);
  v_id := (v_result->>'id')::uuid;
  return v_result || (
    select jsonb_build_object('order_number',o.business_order_number,'business_date',o.business_date)
    from public.lb_orders o where o.id=v_id
  );
end;
$$;

revoke all on function public.lb_business_date(timestamptz) from public,anon,authenticated;
revoke all on function public.lb_ipos_daily_summary(date) from public,anon,authenticated;
revoke all on function public.lb_ipos_add_expense(text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.lb_ipos_close_day() from public,anon,authenticated;
revoke all on function public.lb_counter_orders(text) from public,anon,authenticated;
revoke all on function public.lb_operations_orders() from public,anon,authenticated;
revoke all on function public.lb_counter_create_operational_order_v2(text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.lb_counter_create_order_v3(text,text,text,jsonb) from public,anon,authenticated;

grant execute on function public.lb_business_date(timestamptz) to authenticated;
grant execute on function public.lb_ipos_daily_summary(date) to authenticated;
grant execute on function public.lb_ipos_add_expense(text,text,numeric,text) to authenticated;
grant execute on function public.lb_ipos_close_day() to authenticated;
grant execute on function public.lb_counter_orders(text) to authenticated;
grant execute on function public.lb_operations_orders() to authenticated;
grant execute on function public.lb_counter_create_operational_order_v2(text,text,text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.lb_counter_create_order_v3(text,text,text,jsonb) to authenticated;
