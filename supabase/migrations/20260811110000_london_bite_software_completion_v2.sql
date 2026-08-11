-- London Bite software completion V2
-- Additive migration over the existing lb_* production schema.

alter table public.lb_orders add column if not exists scheduled_for timestamptz null;
alter table public.lb_orders add column if not exists referral_code text null;

create table if not exists public.lb_referral_codes (
  code text primary key,
  label text not null,
  status text not null default 'active' check (status in ('active','paused','expired')),
  max_uses integer null check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  valid_until date null,
  reward_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lb_menu_recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  menu_item_id uuid not null references public.lb_menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.lb_inventory_items(id) on delete cascade,
  quantity_per_unit numeric(12,3) not null check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(menu_item_id, inventory_item_id)
);

create table if not exists public.lb_order_stock_consumption (
  order_id uuid not null references public.lb_orders(id) on delete cascade,
  inventory_item_id uuid not null references public.lb_inventory_items(id) on delete restrict,
  quantity_used numeric(12,3) not null check (quantity_used >= 0),
  created_at timestamptz not null default now(),
  primary key(order_id, inventory_item_id)
);

alter table public.lb_referral_codes enable row level security;
alter table public.lb_menu_recipes enable row level security;
alter table public.lb_order_stock_consumption enable row level security;
revoke all on public.lb_referral_codes from anon, authenticated;
revoke all on public.lb_menu_recipes from anon, authenticated;
revoke all on public.lb_order_stock_consumption from anon, authenticated;

create index if not exists lb_orders_scheduled_for_idx on public.lb_orders(scheduled_for) where scheduled_for is not null;
create index if not exists lb_orders_referral_code_idx on public.lb_orders(referral_code) where referral_code is not null;
create index if not exists lb_menu_recipes_menu_idx on public.lb_menu_recipes(menu_item_id);
create index if not exists lb_menu_recipes_inventory_idx on public.lb_menu_recipes(inventory_item_id);

create or replace function public.lb_create_order_v2(
  p_customer_name text,p_customer_phone text,p_delivery_address text,p_fulfilment text,p_payment_method text,p_items jsonb,
  p_source text default 'web',p_scheduled_for timestamptz default null,p_referral_code text default null
) returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_result jsonb;v_order_id uuid;v_code text;
begin
  if p_scheduled_for is not null then
    if p_scheduled_for < now()+interval '30 minutes' then raise exception 'Scheduled orders must be at least 30 minutes ahead'; end if;
    if p_scheduled_for > now()+interval '7 days' then raise exception 'Scheduled orders can be placed up to 7 days ahead'; end if;
  end if;
  v_code:=nullif(upper(trim(coalesce(p_referral_code,''))),'');
  if v_code is not null and not exists(select 1 from public.lb_referral_codes r where r.code=v_code and r.status='active' and (r.valid_until is null or r.valid_until>=current_date) and (r.max_uses is null or r.uses<r.max_uses)) then raise exception 'Referral code is not active'; end if;
  v_result:=public.lb_create_order(p_customer_name,p_customer_phone,p_delivery_address,p_fulfilment,p_payment_method,p_items,left(coalesce(nullif(trim(p_source),''),'web'),80));
  v_order_id:=(v_result->>'id')::uuid;
  update public.lb_orders set scheduled_for=p_scheduled_for,referral_code=v_code,updated_at=now() where id=v_order_id;
  if v_code is not null then update public.lb_referral_codes set uses=uses+1,updated_at=now() where code=v_code; end if;
  insert into public.lb_audit_events(actor_type,action,entity_type,entity_id,metadata) values('customer','order_enrichment','order',v_order_id::text,jsonb_build_object('scheduled_for',p_scheduled_for,'referral_code',v_code));
  return v_result||jsonb_build_object('scheduled_for',p_scheduled_for,'referral_code',v_code);
end;$$;

create or replace function public.lb_operations_orders_v2() returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_role text;v_employee uuid;
begin
  v_role:=public.lb_staff_role();v_employee:=public.lb_my_employee_id();
  if v_role not in ('owner','manager','kitchen','rider') then raise exception 'Operations order access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'status',o.order_status,'fulfilment',o.fulfilment,'payment_status',o.payment_status,'total',o.total,'created_at',o.created_at,
    'scheduled_for',o.scheduled_for,'referral_code',o.referral_code,
    'customer_name',case when v_role in ('owner','manager','rider') then o.customer_name else null end,
    'customer_phone',case when v_role in ('owner','manager','rider') then o.customer_phone else null end,
    'delivery_address',case when v_role in ('owner','manager','rider') then o.delivery_address else null end,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity) order by i.created_at),'[]'::jsonb) from public.lb_order_items i where i.order_id=o.id)
  ) order by coalesce(o.scheduled_for,o.created_at),o.created_at),'[]'::jsonb) from public.lb_orders o
  where o.order_status in ('accepted','preparing','ready','out_for_delivery')
    and (o.scheduled_for is null or o.scheduled_for<=now()+interval '30 minutes' or v_role in ('owner','manager'))
    and (v_role in ('owner','manager') or (v_role='kitchen' and o.order_status in ('accepted','preparing','ready')) or (v_role='rider' and exists(select 1 from public.lb_rider_assignments ra where ra.order_id=o.id and ra.employee_id=v_employee and ra.status in ('assigned','picked_up')))));
end;$$;

create or replace function public.lb_management_referral_codes() returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin if not public.lb_is_manager() then raise exception 'Unauthorized'; end if; return (select coalesce(jsonb_agg(jsonb_build_object('code',code,'label',label,'status',status,'max_uses',max_uses,'uses',uses,'valid_until',valid_until,'reward_note',reward_note) order by created_at desc),'[]'::jsonb) from public.lb_referral_codes); end;$$;

create or replace function public.lb_management_referral_upsert(p_code text,p_label text,p_status text default 'active',p_max_uses integer default null,p_valid_until date default null,p_reward_note text default null) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_code text;
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  v_code:=upper(regexp_replace(trim(coalesce(p_code,'')),'[^A-Za-z0-9_-]','','g'));
  if length(v_code)<3 or length(v_code)>24 then raise exception 'Referral code must be 3 to 24 characters'; end if;
  if p_status not in ('active','paused','expired') then raise exception 'Invalid referral status'; end if;
  insert into public.lb_referral_codes(code,label,status,max_uses,valid_until,reward_note) values(v_code,left(trim(p_label),80),p_status,p_max_uses,p_valid_until,nullif(trim(coalesce(p_reward_note,'')),'')) on conflict(code) do update set label=excluded.label,status=excluded.status,max_uses=excluded.max_uses,valid_until=excluded.valid_until,reward_note=excluded.reward_note,updated_at=now();
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'referral_upsert','referral',v_code,jsonb_build_object('status',p_status,'max_uses',p_max_uses));
  return jsonb_build_object('code',v_code,'status',p_status);
end;$$;

create or replace function public.lb_management_recipes() returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin if not public.lb_is_manager() then raise exception 'Unauthorized'; end if; return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'menu_item_id',r.menu_item_id,'menu_name',m.name,'menu_slug',m.slug,'inventory_item_id',r.inventory_item_id,'inventory_name',i.name,'inventory_unit',i.unit,'quantity_per_unit',r.quantity_per_unit) order by m.name,i.name),'[]'::jsonb) from public.lb_menu_recipes r join public.lb_menu_items m on m.id=r.menu_item_id join public.lb_inventory_items i on i.id=r.inventory_item_id); end;$$;

create or replace function public.lb_management_recipe_upsert(p_menu_slug text,p_inventory_item_id uuid,p_quantity_per_unit numeric) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_menu uuid;v_id uuid;
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  if p_quantity_per_unit<=0 or p_quantity_per_unit>10000 then raise exception 'Invalid recipe quantity'; end if;
  select id into v_menu from public.lb_menu_items where slug=p_menu_slug;if v_menu is null then raise exception 'Menu item not found'; end if;
  if not exists(select 1 from public.lb_inventory_items where id=p_inventory_item_id) then raise exception 'Inventory item not found'; end if;
  insert into public.lb_menu_recipes(menu_item_id,inventory_item_id,quantity_per_unit) values(v_menu,p_inventory_item_id,p_quantity_per_unit) on conflict(menu_item_id,inventory_item_id) do update set quantity_per_unit=excluded.quantity_per_unit,updated_at=now() returning id into v_id;
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'recipe_upsert','menu_recipe',v_id::text,jsonb_build_object('menu_slug',p_menu_slug,'inventory_item_id',p_inventory_item_id,'quantity_per_unit',p_quantity_per_unit));
  return jsonb_build_object('id',v_id);
end;$$;

create or replace function public.lb_consume_order_inventory(p_order_id uuid) returns void language plpgsql security definer set search_path to 'public' as $$
declare v_row record;v_available numeric;v_used numeric;
begin
  for v_row in select r.inventory_item_id,sum(oi.quantity*r.quantity_per_unit)::numeric(12,3) qty from public.lb_order_items oi join public.lb_menu_recipes r on r.menu_item_id=oi.menu_item_id where oi.order_id=p_order_id group by r.inventory_item_id loop
    if not exists(select 1 from public.lb_order_stock_consumption where order_id=p_order_id and inventory_item_id=v_row.inventory_item_id) then
      select current_quantity into v_available from public.lb_inventory_items where id=v_row.inventory_item_id for update;v_used:=least(coalesce(v_available,0),v_row.qty);
      insert into public.lb_order_stock_consumption(order_id,inventory_item_id,quantity_used) values(p_order_id,v_row.inventory_item_id,v_used);
      update public.lb_inventory_items set current_quantity=greatest(0,current_quantity-v_row.qty),updated_at=now() where id=v_row.inventory_item_id;
      insert into public.lb_stock_movements(inventory_item_id,quantity_change,reason) values(v_row.inventory_item_id,-v_used,'Automatic recipe consumption for order '||p_order_id::text);
      if coalesce(v_available,0)<v_row.qty then insert into public.lb_audit_events(actor_type,action,entity_type,entity_id,metadata) values('system','inventory_shortfall','inventory',v_row.inventory_item_id::text,jsonb_build_object('order_id',p_order_id,'required',v_row.qty,'available',coalesce(v_available,0))); end if;
    end if;
  end loop;
end;$$;

create or replace function public.lb_management_intelligence(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),180));
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  return jsonb_build_object(
    'top_products',(select coalesce(jsonb_agg(x order by (x->>'revenue')::numeric desc),'[]'::jsonb) from (select jsonb_build_object('name',oi.item_name,'units',sum(oi.quantity),'orders',count(distinct oi.order_id),'revenue',sum(oi.line_total)) x from public.lb_order_items oi join public.lb_orders o on o.id=oi.order_id where o.created_at>=now()-(v_days||' days')::interval and o.order_status<>'cancelled' group by oi.item_name limit 10) q),
    'demand_hours',(select coalesce(jsonb_agg(x order by (x->>'hour')::int),'[]'::jsonb) from (select jsonb_build_object('hour',extract(hour from o.created_at at time zone 'Asia/Karachi')::int,'orders',count(*),'revenue',sum(o.total)) x from public.lb_orders o where o.created_at>=now()-(v_days||' days')::interval and o.order_status<>'cancelled' group by extract(hour from o.created_at at time zone 'Asia/Karachi')) q),
    'repeat_customers',(select count(*) from (select regexp_replace(customer_phone,'\\D','','g') p from public.lb_orders where created_at>=now()-(v_days||' days')::interval and order_status<>'cancelled' group by 1 having count(*)>1) r),
    'scheduled_orders',(select count(*) from public.lb_orders where scheduled_for is not null and scheduled_for>=now() and order_status not in ('delivered','cancelled')),
    'referral_orders',(select count(*) from public.lb_orders where created_at>=now()-(v_days||' days')::interval and referral_code is not null and order_status<>'cancelled'),
    'avg_prep_minutes',(select round(avg(extract(epoch from (ready_at-prep_at))/60)::numeric,1) from (select o.id,min(e.created_at) filter(where e.event_type='preparing') prep_at,min(e.created_at) filter(where e.event_type='ready') ready_at from public.lb_orders o join public.lb_order_events e on e.order_id=o.id where o.created_at>=now()-(v_days||' days')::interval group by o.id) t where prep_at is not null and ready_at is not null),
    'avg_delivery_minutes',(select round(avg(extract(epoch from (delivered_at-out_at))/60)::numeric,1) from (select o.id,min(e.created_at) filter(where e.event_type='out_for_delivery') out_at,min(e.created_at) filter(where e.event_type='delivered') delivered_at from public.lb_orders o join public.lb_order_events e on e.order_id=o.id where o.created_at>=now()-(v_days||' days')::interval group by o.id) t where out_at is not null and delivered_at is not null));
end;$$;

-- Runtime safety hooks. A scheduled order cannot be prepared more than 30 minutes early,
-- and a delivery cannot be dispatched until a rider assignment exists.
create or replace function public.lb_management_update_order(p_order_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_label text;v_fulfilment text;v_scheduled timestamptz;
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;if p_status not in ('accepted','preparing','ready','out_for_delivery','delivered','cancelled') then raise exception 'Invalid status'; end if;
  select fulfilment,scheduled_for into v_fulfilment,v_scheduled from public.lb_orders where id=p_order_id;if v_fulfilment is null then raise exception 'Order not found'; end if;
  if p_status='preparing' and v_scheduled is not null and v_scheduled>now()+interval '30 minutes' then raise exception 'Scheduled order is not within the preparation window'; end if;
  if p_status='out_for_delivery' then if v_fulfilment<>'delivery' then raise exception 'Only delivery orders can be dispatched'; end if;if not exists(select 1 from public.lb_rider_assignments where order_id=p_order_id and status in ('assigned','picked_up')) then raise exception 'Assign a rider before dispatch'; end if;end if;
  v_label:=case p_status when 'preparing' then 'Kitchen started preparing' when 'ready' then 'Order ready for handoff' when 'out_for_delivery' then 'Rider is on the way' when 'delivered' then 'Order delivered' when 'cancelled' then 'Order cancelled' else 'Order accepted' end;
  update public.lb_orders set order_status=p_status,updated_at=now() where id=p_order_id;if p_status='preparing' then perform public.lb_consume_order_inventory(p_order_id);end if;
  insert into public.lb_order_events(order_id,event_type,label,actor) values(p_order_id,p_status,v_label,'management');insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'order_status_change','order',p_order_id::text,jsonb_build_object('status',p_status));return jsonb_build_object('id',p_order_id,'status',p_status);
end;$$;

create or replace function public.lb_operations_update_order(p_order_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_role text;v_employee uuid;v_label text;v_fulfilment text;v_scheduled timestamptz;
begin
  v_role:=public.lb_staff_role();v_employee:=public.lb_my_employee_id();if v_role not in ('owner','manager','kitchen','rider') then raise exception 'Operations update access required';end if;if p_status not in ('preparing','ready','out_for_delivery','delivered','cancelled') then raise exception 'Invalid status';end if;if v_role='kitchen' and p_status not in ('preparing','ready') then raise exception 'Kitchen cannot set that status';end if;
  select fulfilment,scheduled_for into v_fulfilment,v_scheduled from public.lb_orders where id=p_order_id;if v_fulfilment is null then raise exception 'Order not found';end if;if p_status='preparing' and v_scheduled is not null and v_scheduled>now()+interval '30 minutes' then raise exception 'Scheduled order is not within the preparation window';end if;
  if p_status='out_for_delivery' then if v_fulfilment<>'delivery' then raise exception 'Only delivery orders can be dispatched';end if;if not exists(select 1 from public.lb_rider_assignments where order_id=p_order_id and status in ('assigned','picked_up') and (v_role<>'rider' or employee_id=v_employee)) then raise exception 'Assign a rider before dispatch';end if;end if;
  if v_role='rider' then if p_status not in ('out_for_delivery','delivered') then raise exception 'Rider cannot set that status';end if;if not exists(select 1 from public.lb_rider_assignments where order_id=p_order_id and employee_id=v_employee and status in ('assigned','picked_up')) then raise exception 'Order is not assigned to this rider';end if;end if;
  v_label:=case p_status when 'preparing' then 'Kitchen started preparing' when 'ready' then 'Order ready for handoff' when 'out_for_delivery' then 'Rider is on the way' when 'delivered' then 'Order delivered' else 'Order cancelled' end;update public.lb_orders set order_status=p_status,updated_at=now() where id=p_order_id;if p_status='preparing' then perform public.lb_consume_order_inventory(p_order_id);end if;insert into public.lb_order_events(order_id,event_type,label,actor) values(p_order_id,p_status,v_label,v_role);insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'order_status_change','order',p_order_id::text,jsonb_build_object('status',p_status,'role',v_role));return jsonb_build_object('id',p_order_id,'status',p_status);
end;$$;

revoke all on function public.lb_create_order_v2(text,text,text,text,text,jsonb,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.lb_operations_orders_v2() from public,anon,authenticated;
revoke all on function public.lb_management_referral_codes() from public,anon,authenticated;
revoke all on function public.lb_management_referral_upsert(text,text,text,integer,date,text) from public,anon,authenticated;
revoke all on function public.lb_management_recipes() from public,anon,authenticated;
revoke all on function public.lb_management_recipe_upsert(text,uuid,numeric) from public,anon,authenticated;
revoke all on function public.lb_management_intelligence(integer) from public,anon,authenticated;
revoke all on function public.lb_consume_order_inventory(uuid) from public,anon,authenticated;
grant execute on function public.lb_create_order_v2(text,text,text,text,text,jsonb,text,timestamptz,text) to anon,authenticated;
grant execute on function public.lb_operations_orders_v2() to authenticated;
grant execute on function public.lb_management_referral_codes() to authenticated;
grant execute on function public.lb_management_referral_upsert(text,text,text,integer,date,text) to authenticated;
grant execute on function public.lb_management_recipes() to authenticated;
grant execute on function public.lb_management_recipe_upsert(text,uuid,numeric) to authenticated;
grant execute on function public.lb_management_intelligence(integer) to authenticated;
