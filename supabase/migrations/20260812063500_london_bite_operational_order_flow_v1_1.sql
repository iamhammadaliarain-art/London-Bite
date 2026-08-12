-- London Bite Operational Order Flow PRD v1.1
-- Canonical role-aware execution, payment accountability, cash control and audit layer.

alter table public.lb_menu_items add column if not exists prep_target_minutes integer not null default 15 check (prep_target_minutes between 1 and 240);

alter table public.lb_orders add column if not exists operational_state text not null default 'QUEUED';
alter table public.lb_orders add column if not exists delivery_state text null;
alter table public.lb_orders add column if not exists table_identifier text null;
alter table public.lb_orders add column if not exists pickup_name text null;
alter table public.lb_orders add column if not exists target_due_at timestamptz null;
alter table public.lb_orders add column if not exists ready_at timestamptz null;
alter table public.lb_orders add column if not exists fulfilled_at timestamptz null;
alter table public.lb_orders add column if not exists closed_at timestamptz null;
alter table public.lb_orders add column if not exists collection_owner_employee_id uuid null references public.lb_employees(id) on delete set null;
alter table public.lb_orders add column if not exists created_by_employee_id uuid null references public.lb_employees(id) on delete set null;

alter table public.lb_orders drop constraint if exists lb_orders_operational_state_check;
alter table public.lb_orders add constraint lb_orders_operational_state_check check (operational_state in ('CREATED','QUEUED','PREPARING','READY','HANDED_OVER','SERVED','PICKED_UP','FULFILLED','CLOSED','CANCELLED'));
alter table public.lb_orders drop constraint if exists lb_orders_delivery_state_check;
alter table public.lb_orders add constraint lb_orders_delivery_state_check check (delivery_state is null or delivery_state in ('UNASSIGNED','ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','DELIVERED','FAILED'));

create index if not exists lb_orders_operational_state_idx on public.lb_orders(operational_state, created_at desc);
create index if not exists lb_orders_target_due_at_idx on public.lb_orders(target_due_at) where target_due_at is not null;
create index if not exists lb_orders_collection_owner_idx on public.lb_orders(collection_owner_employee_id) where collection_owner_employee_id is not null;

create table if not exists public.lb_order_subtasks (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.lb_orders(id) on delete cascade,
  label text not null,
  station text null,
  assigned_employee_id uuid null references public.lb_employees(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','DONE','CANCELLED')),
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.lb_payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.lb_orders(id) on delete restrict,
  event_type text not null check (event_type in ('PAYMENT_RECORDED','PAYMENT_COLLECTED','REFUND_RECORDED','VOIDED','PAYMENT_PENDING_ASSIGNED')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  method text null,
  actor_employee_id uuid null references public.lb_employees(id) on delete set null,
  reason text null,
  created_at timestamptz not null default now()
);

create table if not exists public.lb_cash_shifts (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.lb_employees(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opening_float numeric(12,2) not null check (opening_float >= 0),
  closed_at timestamptz null,
  actual_closing_cash numeric(12,2) null,
  expected_closing_cash numeric(12,2) null,
  variance numeric(12,2) null,
  variance_explanation text null,
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','REVIEWED'))
);

create table if not exists public.lb_order_exceptions (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid null references public.lb_orders(id) on delete cascade,
  shift_id uuid null references public.lb_cash_shifts(id) on delete cascade,
  exception_type text not null check (exception_type in ('AT_RISK','OVERDUE','PAYMENT_EXCEPTION','CASH_VARIANCE','CANCELLED','REMAKE','FAILED_DELIVERY')),
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','RESOLVED')),
  owner_employee_id uuid null references public.lb_employees(id) on delete set null,
  reason text null,
  resolved_reason text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create unique index if not exists lb_one_open_overdue_per_order on public.lb_order_exceptions(order_id, exception_type) where exception_type='OVERDUE' and status<>'RESOLVED';
create unique index if not exists lb_one_open_payment_exception_per_order on public.lb_order_exceptions(order_id, exception_type) where exception_type='PAYMENT_EXCEPTION' and status<>'RESOLVED';

alter table public.lb_order_subtasks enable row level security;
alter table public.lb_payment_events enable row level security;
alter table public.lb_cash_shifts enable row level security;
alter table public.lb_order_exceptions enable row level security;
revoke all on public.lb_order_subtasks from anon, authenticated;
revoke all on public.lb_payment_events from anon, authenticated;
revoke all on public.lb_cash_shifts from anon, authenticated;
revoke all on public.lb_order_exceptions from anon, authenticated;

create or replace function public.lb_operational_create_order(
  p_channel text,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_table_identifier text,
  p_pickup_name text,
  p_payment_condition text,
  p_payment_method text,
  p_items jsonb,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare
  v_role text:=public.lb_staff_role(); v_employee uuid:=public.lb_my_employee_id();
  v_order_id uuid; v_tracking text; v_subtotal numeric(12,2):=0; v_total numeric(12,2):=0;
  v_item jsonb; v_menu public.lb_menu_items%rowtype; v_qty integer; v_target integer:=1; v_payment_status text;
begin
  if v_role not in ('owner','manager','counter') then raise exception 'Counter order access required'; end if;
  if p_channel not in ('dine_in','pickup','delivery') then raise exception 'Invalid order channel'; end if;
  if p_channel='dine_in' and length(trim(coalesce(p_table_identifier,'')))<1 then raise exception 'Table or service identifier is required'; end if;
  if p_channel='delivery' and (length(trim(coalesce(p_customer_phone,'')))<7 or length(trim(coalesce(p_address,'')))<8) then raise exception 'Delivery customer, contact and address are required'; end if;
  if p_channel='pickup' and length(trim(coalesce(p_pickup_name,p_customer_name,'')))<2 then raise exception 'Pickup name is required'; end if;
  if p_payment_condition not in ('paid_now','pay_later','cash_on_delivery','collect_at_handoff') then raise exception 'Invalid payment condition'; end if;
  if p_payment_method not in ('cash','online') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,least(coalesce((v_item->>'quantity')::integer,1),20));
    select * into v_menu from public.lb_menu_items where slug=v_item->>'slug' and is_active=true and is_available=true;
    if not found then raise exception 'Menu item unavailable: %',coalesce(v_item->>'slug','unknown'); end if;
    v_subtotal:=v_subtotal+(v_menu.price*v_qty);
    v_target:=greatest(v_target,coalesce(v_menu.prep_target_minutes,15));
  end loop;
  v_total:=round(v_subtotal,2);
  v_payment_status:=case when p_payment_condition='paid_now' then 'paid' else 'cash_due' end;
  v_tracking:=encode(extensions.gen_random_bytes(16),'hex');

  insert into public.lb_orders(
    tracking_token,customer_name,customer_phone,delivery_address,fulfilment,payment_method,payment_status,
    subtotal,total,source,notes,operational_state,delivery_state,table_identifier,pickup_name,target_due_at,
    collection_owner_employee_id,created_by_employee_id
  ) values(
    v_tracking,coalesce(nullif(trim(p_customer_name),''),coalesce(nullif(trim(p_pickup_name),''),'Counter guest')),
    coalesce(trim(p_customer_phone),''),nullif(trim(coalesce(p_address,'')),''),p_channel,p_payment_method,v_payment_status,
    v_subtotal,v_total,'counter',nullif(trim(coalesce(p_notes,'')),''),'QUEUED',case when p_channel='delivery' then 'UNASSIGNED' else null end,
    nullif(trim(coalesce(p_table_identifier,'')),''),nullif(trim(coalesce(p_pickup_name,'')),''),now()+(v_target||' minutes')::interval,
    case when v_payment_status<>'paid' then v_employee else null end,v_employee
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,least(coalesce((v_item->>'quantity')::integer,1),20));
    select * into v_menu from public.lb_menu_items where slug=v_item->>'slug' and is_active=true and is_available=true;
    insert into public.lb_order_items(order_id,menu_item_id,item_name,unit_price,quantity,line_total)
    values(v_order_id,v_menu.id,
      v_menu.name || case when nullif(v_item->>'variant','') is not null then ' · '||(v_item->>'variant') else '' end,
      v_menu.price,v_qty,round(v_menu.price*v_qty,2));
  end loop;

  insert into public.lb_order_events(order_id,event_type,label,actor,metadata)
  values(v_order_id,'order_created','Order created at counter',coalesce(v_role,'counter'),jsonb_build_object('channel',p_channel,'target_minutes',v_target,'payment_condition',p_payment_condition));
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata)
  values('staff',auth.uid()::text,'order_created','order',v_order_id::text,jsonb_build_object('channel',p_channel,'payment_condition',p_payment_condition));
  if v_payment_status='paid' then
    insert into public.lb_payment_events(order_id,event_type,amount,method,actor_employee_id)
    values(v_order_id,'PAYMENT_RECORDED',v_total,p_payment_method,v_employee);
  else
    insert into public.lb_payment_events(order_id,event_type,amount,method,actor_employee_id)
    values(v_order_id,'PAYMENT_PENDING_ASSIGNED',v_total,p_payment_method,v_employee);
  end if;

  return jsonb_build_object('id',v_order_id,'order_number',(select order_number from public.lb_orders where id=v_order_id),'tracking_token',v_tracking,'target_due_at',(select target_due_at from public.lb_orders where id=v_order_id));
end;$$;

create or replace function public.lb_operational_orders() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_role text:=public.lb_staff_role(); v_employee uuid:=public.lb_my_employee_id();
begin
  if v_role not in ('owner','manager','counter','kitchen','rider','employee') then raise exception 'Operational access required'; end if;

  insert into public.lb_order_exceptions(order_id,exception_type,owner_employee_id,reason)
  select o.id,'OVERDUE',coalesce(o.collection_owner_employee_id,o.created_by_employee_id),'Preparation target missed'
  from public.lb_orders o
  where o.target_due_at<now() and o.operational_state in ('QUEUED','PREPARING')
    and not exists(select 1 from public.lb_order_exceptions e where e.order_id=o.id and e.exception_type='OVERDUE' and e.status<>'RESOLVED')
  on conflict do nothing;

  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'operational_state',o.operational_state,'legacy_status',o.order_status,
    'channel',o.fulfilment,'payment_status',o.payment_status,'payment_method',o.payment_method,'total',o.total,
    'customer_name',case when v_role in ('owner','manager','counter','rider') then o.customer_name else null end,
    'customer_phone',case when v_role in ('owner','manager','counter','rider') then o.customer_phone else null end,
    'delivery_address',case when v_role in ('owner','manager','rider') then o.delivery_address else null end,
    'table_identifier',o.table_identifier,'pickup_name',o.pickup_name,'target_due_at',o.target_due_at,'ready_at',o.ready_at,
    'delivery_state',o.delivery_state,'created_at',o.created_at,
    'overdue',exists(select 1 from public.lb_order_exceptions e where e.order_id=o.id and e.exception_type='OVERDUE' and e.status<>'RESOLVED'),
    'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity) order by i.created_at),'[]'::jsonb) from public.lb_order_items i where i.order_id=o.id),
    'subtasks',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'station',s.station,'status',s.status,'assigned_employee_id',s.assigned_employee_id) order by s.created_at),'[]'::jsonb) from public.lb_order_subtasks s where s.order_id=o.id)
  ) order by coalesce(o.target_due_at,o.created_at),o.created_at),'[]'::jsonb)
  from public.lb_orders o
  where o.operational_state not in ('CLOSED','CANCELLED')
    and (
      v_role in ('owner','manager','counter')
      or (v_role='kitchen' and o.operational_state in ('QUEUED','PREPARING','READY'))
      or (v_role='rider' and o.fulfilment='delivery' and (o.delivery_state in ('ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY') or exists(select 1 from public.lb_rider_assignments r where r.order_id=o.id and r.employee_id=v_employee)))
      or (v_role='employee' and o.operational_state='READY' and o.fulfilment in ('dine_in','pickup'))
    ));
end;$$;

create or replace function public.lb_operational_transition(p_order_id uuid,p_action text,p_reason text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_role text:=public.lb_staff_role(); v_employee uuid:=public.lb_my_employee_id(); v_order public.lb_orders%rowtype; v_next text; v_legacy text; v_label text;
begin
  select * into v_order from public.lb_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_action='START_PREP' then
    if v_role not in ('owner','manager','kitchen') or v_order.operational_state not in ('QUEUED','CREATED') then raise exception 'Start prep is not allowed'; end if;
    v_next:='PREPARING';v_legacy:='preparing';v_label:='Kitchen started preparing';
  elsif p_action='MARK_READY' then
    if v_role not in ('owner','manager','kitchen') or v_order.operational_state<>'PREPARING' then raise exception 'Ready is not allowed'; end if;
    if exists(select 1 from public.lb_order_subtasks where order_id=p_order_id and status not in ('DONE','CANCELLED')) then raise exception 'Required kitchen sub-tasks are incomplete'; end if;
    v_next:='READY';v_legacy:='ready';v_label:='Order ready for handoff';
  elsif p_action='SERVE' then
    if v_role not in ('owner','manager','counter','employee') or v_order.fulfilment<>'dine_in' or v_order.operational_state<>'READY' then raise exception 'Serve is not allowed'; end if;
    v_next:='SERVED';v_legacy:='delivered';v_label:='Order served';
  elsif p_action='HAND_OVER' then
    if v_role not in ('owner','manager','counter','employee') or v_order.fulfilment<>'pickup' or v_order.operational_state<>'READY' then raise exception 'Handoff is not allowed'; end if;
    v_next:='HANDED_OVER';v_legacy:='delivered';v_label:='Takeaway handed over';
  elsif p_action='RIDER_PICKUP' then
    if v_role not in ('owner','manager','rider') or v_order.fulfilment<>'delivery' or v_order.operational_state<>'READY' then raise exception 'Rider pickup is not allowed'; end if;
    if v_role='rider' and not exists(select 1 from public.lb_rider_assignments where order_id=p_order_id and employee_id=v_employee and status in ('assigned','picked_up')) then raise exception 'Order is not assigned to this rider'; end if;
    v_next:='PICKED_UP';v_legacy:='out_for_delivery';v_label:='Rider picked up order';
  elsif p_action='DELIVER' then
    if v_role not in ('owner','manager','rider') or v_order.fulfilment<>'delivery' or v_order.operational_state<>'PICKED_UP' then raise exception 'Delivery completion is not allowed'; end if;
    v_next:='FULFILLED';v_legacy:='delivered';v_label:='Order delivered';
  elsif p_action='CANCEL' then
    if v_role not in ('owner','manager','counter') then raise exception 'Cancel permission required'; end if;
    if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Cancellation reason is required'; end if;
    v_next:='CANCELLED';v_legacy:='cancelled';v_label:='Order cancelled';
  else raise exception 'Unknown action'; end if;

  update public.lb_orders set operational_state=v_next,order_status=v_legacy,updated_at=now(),
    ready_at=case when v_next='READY' then now() else ready_at end,
    fulfilled_at=case when v_next in ('SERVED','HANDED_OVER','FULFILLED') then now() else fulfilled_at end,
    delivery_state=case when p_action='RIDER_PICKUP' then 'OUT_FOR_DELIVERY' when p_action='DELIVER' then 'DELIVERED' else delivery_state end
  where id=p_order_id;

  if v_next in ('SERVED','HANDED_OVER','FULFILLED') and v_order.payment_status<>'paid' then
    insert into public.lb_order_exceptions(order_id,exception_type,owner_employee_id,reason)
    values(p_order_id,'PAYMENT_EXCEPTION',coalesce(v_order.collection_owner_employee_id,v_employee),'Fulfilment complete while payment remains due') on conflict do nothing;
  end if;

  insert into public.lb_order_events(order_id,event_type,label,actor,metadata) values(p_order_id,lower(p_action),v_label,coalesce(v_role,'system'),jsonb_build_object('reason',p_reason));
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,lower(p_action),'order',p_order_id::text,jsonb_build_object('from',v_order.operational_state,'to',v_next,'reason',p_reason));
  return jsonb_build_object('id',p_order_id,'state',v_next);
end;$$;

create or replace function public.lb_operational_record_payment(p_order_id uuid,p_amount numeric,p_method text,p_event text default 'PAYMENT_COLLECTED',p_reason text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_role text:=public.lb_staff_role(); v_employee uuid:=public.lb_my_employee_id(); v_order public.lb_orders%rowtype; v_paid numeric;
begin
  if v_role not in ('owner','manager','counter','rider','employee') then raise exception 'Payment collection access required'; end if;
  select * into v_order from public.lb_orders where id=p_order_id for update;if not found then raise exception 'Order not found'; end if;
  if p_event not in ('PAYMENT_COLLECTED','REFUND_RECORDED') then raise exception 'Invalid payment event'; end if;
  if p_amount<=0 then raise exception 'Amount must be greater than zero'; end if;
  if p_method not in ('cash','online') then raise exception 'Invalid payment method'; end if;
  if p_event='REFUND_RECORDED' and v_role not in ('owner','manager') then raise exception 'Refund requires manager permission'; end if;
  if p_event='REFUND_RECORDED' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Refund reason is required'; end if;

  insert into public.lb_payment_events(order_id,event_type,amount,method,actor_employee_id,reason) values(p_order_id,p_event,p_amount,p_method,v_employee,nullif(trim(coalesce(p_reason,'')),''));
  select coalesce(sum(case when event_type in ('PAYMENT_RECORDED','PAYMENT_COLLECTED') then amount when event_type='REFUND_RECORDED' then -amount else 0 end),0) into v_paid from public.lb_payment_events where order_id=p_order_id;
  update public.lb_orders set payment_status=case when v_paid>=total then 'paid' when v_paid>0 then 'pending' else case when p_event='REFUND_RECORDED' then 'refunded' else payment_status end end,updated_at=now() where id=p_order_id;
  if v_paid>=v_order.total then
    update public.lb_order_exceptions set status='RESOLVED',resolved_reason='Payment collected',resolved_at=now() where order_id=p_order_id and exception_type='PAYMENT_EXCEPTION' and status<>'RESOLVED';
    update public.lb_orders set operational_state='CLOSED',closed_at=now() where id=p_order_id and operational_state in ('SERVED','HANDED_OVER','FULFILLED');
  end if;
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,lower(p_event),'order',p_order_id::text,jsonb_build_object('amount',p_amount,'method',p_method,'reason',p_reason));
  return jsonb_build_object('id',p_order_id,'paid_total',v_paid,'payment_status',(select payment_status from public.lb_orders where id=p_order_id),'operational_state',(select operational_state from public.lb_orders where id=p_order_id));
end;$$;

create or replace function public.lb_operational_shift_open(p_opening_float numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_role text:=public.lb_staff_role(); v_employee uuid:=public.lb_my_employee_id(); v_id uuid;
begin
  if v_role not in ('owner','manager','counter') or v_employee is null then raise exception 'Counter shift access required'; end if;
  if p_opening_float<0 then raise exception 'Opening float cannot be negative'; end if;
  if exists(select 1 from public.lb_cash_shifts where employee_id=v_employee and status='OPEN') then raise exception 'An open cash shift already exists'; end if;
  insert into public.lb_cash_shifts(employee_id,opening_float) values(v_employee,p_opening_float) returning id into v_id;
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'shift_opened','cash_shift',v_id::text,jsonb_build_object('opening_float',p_opening_float));
  return jsonb_build_object('id',v_id,'status','OPEN');
end;$$;

create or replace function public.lb_operational_shift_close(p_shift_id uuid,p_actual_cash numeric,p_explanation text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_role text:=public.lb_staff_role(); v_shift public.lb_cash_shifts%rowtype; v_cash_in numeric; v_cash_refunds numeric; v_expected numeric; v_variance numeric;
begin
  if v_role not in ('owner','manager','counter') then raise exception 'Counter shift access required'; end if;
  select * into v_shift from public.lb_cash_shifts where id=p_shift_id for update;if not found or v_shift.status<>'OPEN' then raise exception 'Open shift not found'; end if;
  select coalesce(sum(amount),0) into v_cash_in from public.lb_payment_events where actor_employee_id=v_shift.employee_id and method='cash' and event_type in ('PAYMENT_RECORDED','PAYMENT_COLLECTED') and created_at>=v_shift.opened_at;
  select coalesce(sum(amount),0) into v_cash_refunds from public.lb_payment_events where actor_employee_id=v_shift.employee_id and method='cash' and event_type='REFUND_RECORDED' and created_at>=v_shift.opened_at;
  v_expected:=round(v_shift.opening_float+v_cash_in-v_cash_refunds,2);v_variance:=round(p_actual_cash-v_expected,2);
  if v_variance<>0 and length(trim(coalesce(p_explanation,'')))<3 then raise exception 'Variance explanation is required'; end if;
  update public.lb_cash_shifts set closed_at=now(),actual_closing_cash=p_actual_cash,expected_closing_cash=v_expected,variance=v_variance,variance_explanation=nullif(trim(coalesce(p_explanation,'')),''),status='CLOSED' where id=p_shift_id;
  if v_variance<>0 then insert into public.lb_order_exceptions(shift_id,exception_type,owner_employee_id,reason) values(p_shift_id,'CASH_VARIANCE',v_shift.employee_id,coalesce(nullif(trim(p_explanation),''),'Cash variance')); end if;
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'shift_closed','cash_shift',p_shift_id::text,jsonb_build_object('expected',v_expected,'actual',p_actual_cash,'variance',v_variance));
  return jsonb_build_object('id',p_shift_id,'expected',v_expected,'actual',p_actual_cash,'variance',v_variance);
end;$$;

create or replace function public.lb_operational_command_center() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  return jsonb_build_object(
    'live_orders',(select count(*) from public.lb_orders where operational_state not in ('CLOSED','CANCELLED')),
    'queued',(select count(*) from public.lb_orders where operational_state='QUEUED'),
    'preparing',(select count(*) from public.lb_orders where operational_state='PREPARING'),
    'ready',(select count(*) from public.lb_orders where operational_state='READY'),
    'overdue',(select count(*) from public.lb_order_exceptions where exception_type='OVERDUE' and status<>'RESOLVED'),
    'payment_exceptions',(select count(*) from public.lb_order_exceptions where exception_type='PAYMENT_EXCEPTION' and status<>'RESOLVED'),
    'cash_variances',(select count(*) from public.lb_order_exceptions where exception_type='CASH_VARIANCE' and status<>'RESOLVED'),
    'cash_open',(select coalesce(sum(opening_float),0) from public.lb_cash_shifts where status='OPEN'),
    'unresolved_amount',(select coalesce(sum(total),0) from public.lb_orders where payment_status<>'paid' and operational_state not in ('CANCELLED','CLOSED')),
    'recent_events',(select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) from (select id,action,entity_type,entity_id,metadata,created_at from public.lb_audit_events order by created_at desc limit 25) x)
  );
end;$$;

grant execute on function public.lb_operational_create_order(text,text,text,text,text,text,text,text,jsonb,text) to authenticated;
grant execute on function public.lb_operational_orders() to authenticated;
grant execute on function public.lb_operational_transition(uuid,text,text) to authenticated;
grant execute on function public.lb_operational_record_payment(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.lb_operational_shift_open(numeric) to authenticated;
grant execute on function public.lb_operational_shift_close(uuid,numeric,text) to authenticated;
grant execute on function public.lb_operational_command_center() to authenticated;
