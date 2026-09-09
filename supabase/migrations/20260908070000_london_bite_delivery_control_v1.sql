-- London Bite Delivery Control V1
-- Additive only: keeps existing orders, rider assignments, EOD and historical data intact.

alter table public.lb_rider_assignments
  add column if not exists bonus_candidate boolean not null default false,
  add column if not exists bonus_amount numeric(10,2) not null default 0,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_note text null,
  add column if not exists verified_at timestamptz null,
  add column if not exists verified_by uuid null,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_approved_at timestamptz null,
  add column if not exists payment_paid_at timestamptz null;

do $$ begin
  alter table public.lb_rider_assignments
    add constraint lb_rider_assignments_verification_status_check
    check (verification_status in ('pending','approved','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.lb_rider_assignments
    add constraint lb_rider_assignments_payment_status_check
    check (payment_status in ('pending','approved','paid'));
exception when duplicate_object then null; end $$;

create table if not exists public.lb_rider_shift_closings (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.lb_employees(id) on delete restrict,
  business_date date not null,
  status text not null default 'closed' check (status in ('closed')),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(employee_id, business_date)
);

alter table public.lb_rider_shift_closings enable row level security;
revoke all on public.lb_rider_shift_closings from anon, authenticated;

create index if not exists lb_rider_assignments_delivery_review_idx
  on public.lb_rider_assignments(delivered_at, verification_status, payment_status);
create index if not exists lb_rider_shift_closings_business_idx
  on public.lb_rider_shift_closings(business_date, employee_id);

create or replace function public.lb_delivery_business_date(p_at timestamptz default now())
returns date
language sql stable
set search_path to 'public'
as $$
  select case
    when (p_at at time zone 'Asia/Karachi')::time >= time '14:00'
      then (p_at at time zone 'Asia/Karachi')::date
    else (p_at at time zone 'Asia/Karachi')::date - 1
  end;
$$;

create or replace function public.lb_delivery_rider_shift_status()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_employee uuid;
  v_role text;
  v_local timestamp;
  v_business_date date;
  v_window_open boolean;
  v_closed boolean;
begin
  v_employee := public.lb_my_employee_id();
  v_role := public.lb_staff_role();
  if v_employee is null or v_role <> 'rider' then raise exception 'Rider access required'; end if;

  v_local := now() at time zone 'Asia/Karachi';
  v_business_date := public.lb_delivery_business_date(now());
  v_window_open := (v_local::time >= time '14:00' or v_local::time < time '04:00');
  select exists(
    select 1 from public.lb_rider_shift_closings
    where employee_id=v_employee and business_date=v_business_date
  ) into v_closed;

  return jsonb_build_object(
    'business_date',v_business_date,
    'window_open',v_window_open,
    'day_closed',v_closed,
    'can_receive_jobs',v_window_open and not v_closed,
    'opens_at','14:00',
    'hard_closes_at','04:00'
  );
end;$$;

create or replace function public.lb_delivery_rider_update_job(p_assignment_id uuid,p_status text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
  v_employee uuid;
  v_order_created timestamptz;
  v_delivered timestamptz;
  v_total_seconds numeric;
begin
  v_employee := public.lb_my_employee_id();
  if public.lb_staff_role() <> 'rider' or v_employee is null then raise exception 'Rider access required'; end if;
  if p_status not in ('picked_up','delivered','failed') then raise exception 'Invalid rider status'; end if;
  if not exists(select 1 from public.lb_rider_assignments where id=p_assignment_id and employee_id=v_employee) then raise exception 'Assignment not found'; end if;

  v_result := public.lb_rider_update_job(p_assignment_id,p_status);

  if p_status='delivered' then
    select o.created_at, ra.delivered_at
      into v_order_created, v_delivered
    from public.lb_rider_assignments ra
    join public.lb_orders o on o.id=ra.order_id
    where ra.id=p_assignment_id;

    if v_delivered is not null then
      v_total_seconds := extract(epoch from (v_delivered-v_order_created));
      update public.lb_rider_assignments
      set bonus_candidate = v_total_seconds < 1800,
          bonus_amount = case when v_total_seconds < 1800 then 10 else 0 end,
          verification_status='pending',
          verification_note=null,
          verified_at=null,
          verified_by=null,
          payment_status='pending',
          payment_approved_at=null,
          payment_paid_at=null
      where id=p_assignment_id;
    end if;
  end if;

  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object('delivery_control','updated');
end;$$;

create or replace function public.lb_management_delivery_control(p_business_date date default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_date date := coalesce(p_business_date,public.lb_delivery_business_date(now()));
  v_start timestamptz := (v_date::timestamp + time '14:00') at time zone 'Asia/Karachi';
  v_end timestamptz := ((v_date+1)::timestamp + time '04:00') at time zone 'Asia/Karachi';
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'assignment_id',ra.id,
      'order_id',o.id,
      'order_number',o.order_number,
      'customer_name',o.customer_name,
      'customer_phone',o.customer_phone,
      'delivery_address',o.delivery_address,
      'rider_id',e.id,
      'rider_name',e.name,
      'rider_code',e.employee_code,
      'order_started_at',o.created_at,
      'kitchen_ready_at',(select min(ev.created_at) from public.lb_order_events ev where ev.order_id=o.id and ev.event_type='ready'),
      'assigned_at',ra.assigned_at,
      'picked_up_at',ra.picked_up_at,
      'delivered_at',ra.delivered_at,
      'kitchen_seconds',case when (select min(ev.created_at) from public.lb_order_events ev where ev.order_id=o.id and ev.event_type='ready') is null then null else extract(epoch from ((select min(ev.created_at) from public.lb_order_events ev where ev.order_id=o.id and ev.event_type='ready')-o.created_at)) end,
      'dispatch_wait_seconds',case when ra.picked_up_at is null or (select min(ev.created_at) from public.lb_order_events ev where ev.order_id=o.id and ev.event_type='ready') is null then null else extract(epoch from (ra.picked_up_at-(select min(ev.created_at) from public.lb_order_events ev where ev.order_id=o.id and ev.event_type='ready'))) end,
      'rider_seconds',case when ra.picked_up_at is null or ra.delivered_at is null then null else extract(epoch from (ra.delivered_at-ra.picked_up_at)) end,
      'total_seconds',case when ra.delivered_at is null then extract(epoch from (now()-o.created_at)) else extract(epoch from (ra.delivered_at-o.created_at)) end,
      'late_seconds',case when ra.delivered_at is null then greatest(0,extract(epoch from (now()-o.created_at))-2400) else greatest(0,extract(epoch from (ra.delivered_at-o.created_at))-2400) end,
      'sla_status',case when ra.delivered_at is null and now()-o.created_at>interval '40 minutes' then 'late' when ra.delivered_at is not null and ra.delivered_at-o.created_at>interval '40 minutes' then 'late' when ra.delivered_at is not null then 'on_time' else 'active' end,
      'bonus_candidate',ra.bonus_candidate,
      'bonus_amount',ra.bonus_amount,
      'verification_status',ra.verification_status,
      'verification_note',ra.verification_note,
      'payment_status',ra.payment_status
    ) order by o.created_at desc)
    from public.lb_rider_assignments ra
    join public.lb_orders o on o.id=ra.order_id
    join public.lb_employees e on e.id=ra.employee_id
    where o.fulfilment='delivery' and o.created_at>=v_start and o.created_at<v_end
  ),'[]'::jsonb);
end;$$;

create or replace function public.lb_management_delivery_verify(p_assignment_id uuid,p_decision text,p_note text default null)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare v_amount numeric(10,2);begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if not exists(select 1 from public.lb_rider_assignments where id=p_assignment_id and delivered_at is not null) then raise exception 'Delivered assignment not found'; end if;

  update public.lb_rider_assignments
  set verification_status=p_decision,
      verification_note=nullif(trim(coalesce(p_note,'')),''),
      verified_at=now(),
      verified_by=auth.uid(),
      bonus_amount=case when p_decision='approved' and bonus_candidate then 10 else 0 end,
      payment_status=case when p_decision='rejected' then 'pending' else payment_status end
  where id=p_assignment_id
  returning bonus_amount into v_amount;

  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata)
  values('staff',auth.uid()::text,'delivery_verification','rider_assignment',p_assignment_id::text,jsonb_build_object('decision',p_decision,'bonus_amount',v_amount,'note',p_note));
  return jsonb_build_object('assignment_id',p_assignment_id,'verification_status',p_decision,'bonus_amount',v_amount);
end;$$;

create or replace function public.lb_management_delivery_approve_payment(p_employee_id uuid,p_business_date date default null)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_date date:=coalesce(p_business_date,public.lb_delivery_business_date(now()));
  v_start timestamptz := (v_date::timestamp + time '14:00') at time zone 'Asia/Karachi';
  v_end timestamptz := ((v_date+1)::timestamp + time '04:00') at time zone 'Asia/Karachi';
  v_total numeric(10,2);
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  update public.lb_rider_assignments ra
  set payment_status='approved',payment_approved_at=now()
  from public.lb_orders o
  where o.id=ra.order_id and ra.employee_id=p_employee_id
    and o.created_at>=v_start and o.created_at<v_end
    and ra.verification_status='approved' and ra.bonus_amount>0 and ra.payment_status='pending';
  select coalesce(sum(ra.bonus_amount),0) into v_total
  from public.lb_rider_assignments ra join public.lb_orders o on o.id=ra.order_id
  where ra.employee_id=p_employee_id and o.created_at>=v_start and o.created_at<v_end
    and ra.verification_status='approved' and ra.payment_status in ('approved','paid');
  return jsonb_build_object('employee_id',p_employee_id,'business_date',v_date,'approved_bonus',v_total,'payment_status','approved');
end;$$;

create or replace function public.lb_management_delivery_mark_paid(p_employee_id uuid,p_business_date date default null)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_date date:=coalesce(p_business_date,public.lb_delivery_business_date(now()));
  v_start timestamptz := (v_date::timestamp + time '14:00') at time zone 'Asia/Karachi';
  v_end timestamptz := ((v_date+1)::timestamp + time '04:00') at time zone 'Asia/Karachi';
  v_total numeric(10,2);
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  update public.lb_rider_assignments ra
  set payment_status='paid',payment_paid_at=now()
  from public.lb_orders o
  where o.id=ra.order_id and ra.employee_id=p_employee_id
    and o.created_at>=v_start and o.created_at<v_end
    and ra.verification_status='approved' and ra.payment_status='approved';
  select coalesce(sum(ra.bonus_amount),0) into v_total
  from public.lb_rider_assignments ra join public.lb_orders o on o.id=ra.order_id
  where ra.employee_id=p_employee_id and o.created_at>=v_start and o.created_at<v_end
    and ra.payment_status='paid';
  return jsonb_build_object('employee_id',p_employee_id,'business_date',v_date,'paid_bonus',v_total,'payment_status','paid');
end;$$;

create or replace function public.lb_delivery_submit_sheet_and_close(p_note text,p_evidence_url text default null)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_employee uuid;
  v_date date:=public.lb_delivery_business_date(now());
  v_sheet jsonb;
  v_active integer;
begin
  v_employee:=public.lb_my_employee_id();
  if public.lb_staff_role()<>'rider' or v_employee is null then raise exception 'Rider access required'; end if;

  select count(*) into v_active from public.lb_rider_assignments
  where employee_id=v_employee and status in ('assigned','picked_up');
  if v_active>0 then raise exception 'Complete active deliveries before closing the rider day'; end if;

  v_sheet:=public.lb_rider_daily_sheet_submit(p_note,p_evidence_url);
  insert into public.lb_rider_shift_closings(employee_id,business_date,status)
  values(v_employee,v_date,'closed')
  on conflict(employee_id,business_date) do update set status='closed',closed_at=now();

  return jsonb_build_object('business_date',v_date,'day_closed',true,'sheet',v_sheet);
end;$$;

revoke all on function public.lb_delivery_rider_shift_status() from public,anon;
revoke all on function public.lb_delivery_rider_update_job(uuid,text) from public,anon;
revoke all on function public.lb_management_delivery_control(date) from public,anon;
revoke all on function public.lb_management_delivery_verify(uuid,text,text) from public,anon;
revoke all on function public.lb_management_delivery_approve_payment(uuid,date) from public,anon;
revoke all on function public.lb_management_delivery_mark_paid(uuid,date) from public,anon;
revoke all on function public.lb_delivery_submit_sheet_and_close(text,text) from public,anon;

grant execute on function public.lb_delivery_rider_shift_status() to authenticated;
grant execute on function public.lb_delivery_rider_update_job(uuid,text) to authenticated;
grant execute on function public.lb_management_delivery_control(date) to authenticated;
grant execute on function public.lb_management_delivery_verify(uuid,text,text) to authenticated;
grant execute on function public.lb_management_delivery_approve_payment(uuid,date) to authenticated;
grant execute on function public.lb_management_delivery_mark_paid(uuid,date) to authenticated;
grant execute on function public.lb_delivery_submit_sheet_and_close(text,text) to authenticated;
