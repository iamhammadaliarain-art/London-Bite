-- Final preview review hardening.
-- 1. Reserve referral capacity atomically.
-- 2. Rank top products before LIMIT 10.
-- 3. Force riders through the assignment/pickup workflow.

create or replace function public.lb_create_order_v2(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_fulfilment text,
  p_payment_method text,
  p_items jsonb,
  p_source text default 'web',
  p_scheduled_for timestamptz default null,
  p_referral_code text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_code text;
  v_ref public.lb_referral_codes%rowtype;
begin
  if p_scheduled_for is not null then
    if p_scheduled_for < now() + interval '30 minutes' then raise exception 'Scheduled orders must be at least 30 minutes ahead'; end if;
    if p_scheduled_for > now() + interval '7 days' then raise exception 'Scheduled orders can be placed up to 7 days ahead'; end if;
  end if;

  v_code := nullif(upper(trim(coalesce(p_referral_code,''))), '');
  if v_code is not null then
    select * into v_ref
      from public.lb_referral_codes
     where code = v_code
     for update;

    if not found
      or v_ref.status <> 'active'
      or (v_ref.valid_until is not null and v_ref.valid_until < current_date)
      or (v_ref.max_uses is not null and v_ref.uses >= v_ref.max_uses)
    then
      raise exception 'Referral code is not active';
    end if;
  end if;

  v_result := public.lb_create_order(
    p_customer_name,p_customer_phone,p_delivery_address,p_fulfilment,p_payment_method,p_items,
    left(coalesce(nullif(trim(p_source),''),'web'),80)
  );
  v_order_id := (v_result->>'id')::uuid;

  update public.lb_orders
     set scheduled_for=p_scheduled_for,referral_code=v_code,updated_at=now()
   where id=v_order_id;

  if v_code is not null then
    update public.lb_referral_codes set uses=uses+1,updated_at=now() where code=v_code;
  end if;

  insert into public.lb_audit_events(actor_type,action,entity_type,entity_id,metadata)
  values('customer','order_enrichment','order',v_order_id::text,
    jsonb_build_object('scheduled_for',p_scheduled_for,'referral_code',v_code));

  return v_result || jsonb_build_object('scheduled_for',p_scheduled_for,'referral_code',v_code);
end;
$$;

create or replace function public.lb_management_intelligence(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),180));
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  return jsonb_build_object(
    'top_products',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'name',q.item_name,'units',q.units,'orders',q.orders,'revenue',q.revenue
      ) order by q.revenue desc),'[]'::jsonb)
      from (
        select oi.item_name,
               sum(oi.quantity) as units,
               count(distinct oi.order_id) as orders,
               sum(oi.line_total) as revenue
          from public.lb_order_items oi
          join public.lb_orders o on o.id=oi.order_id
         where o.created_at>=now()-(v_days||' days')::interval
           and o.order_status<>'cancelled'
         group by oi.item_name
         order by sum(oi.line_total) desc
         limit 10
      ) q
    ),
    'demand_hours',(select coalesce(jsonb_agg(x order by (x->>'hour')::int),'[]'::jsonb) from (select jsonb_build_object('hour',extract(hour from o.created_at at time zone 'Asia/Karachi')::int,'orders',count(*),'revenue',sum(o.total)) x from public.lb_orders o where o.created_at>=now()-(v_days||' days')::interval and o.order_status<>'cancelled' group by extract(hour from o.created_at at time zone 'Asia/Karachi')) q),
    'repeat_customers',(select count(*) from (select regexp_replace(customer_phone,'\\D','','g') p from public.lb_orders where created_at>=now()-(v_days||' days')::interval and order_status<>'cancelled' group by 1 having count(*)>1) r),
    'scheduled_orders',(select count(*) from public.lb_orders where scheduled_for is not null and scheduled_for>=now() and order_status not in ('delivered','cancelled')),
    'referral_orders',(select count(*) from public.lb_orders where created_at>=now()-(v_days||' days')::interval and referral_code is not null and order_status<>'cancelled'),
    'avg_prep_minutes',(select round(avg(extract(epoch from (ready_at-prep_at))/60)::numeric,1) from (select o.id,min(e.created_at) filter(where e.event_type='preparing') prep_at,min(e.created_at) filter(where e.event_type='ready') ready_at from public.lb_orders o join public.lb_order_events e on e.order_id=o.id where o.created_at>=now()-(v_days||' days')::interval group by o.id) t where prep_at is not null and ready_at is not null),
    'avg_delivery_minutes',(select round(avg(extract(epoch from (delivered_at-out_at))/60)::numeric,1) from (select o.id,min(e.created_at) filter(where e.event_type='out_for_delivery') out_at,min(e.created_at) filter(where e.event_type='delivered') delivered_at from public.lb_orders o join public.lb_order_events e on e.order_id=o.id where o.created_at>=now()-(v_days||' days')::interval group by o.id) t where out_at is not null and delivered_at is not null)
  );
end;
$$;

create or replace function public.lb_operations_update_order(p_order_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_role text;v_label text;v_fulfilment text;v_scheduled timestamptz;
begin
  v_role:=public.lb_staff_role();
  if v_role not in ('owner','manager','kitchen','rider') then raise exception 'Operations update access required'; end if;
  if v_role='rider' then raise exception 'Riders must update delivery through the assignment workflow'; end if;
  if p_status not in ('preparing','ready','out_for_delivery','delivered','cancelled') then raise exception 'Invalid status'; end if;
  if v_role='kitchen' and p_status not in ('preparing','ready') then raise exception 'Kitchen cannot set that status'; end if;

  select fulfilment,scheduled_for into v_fulfilment,v_scheduled from public.lb_orders where id=p_order_id;
  if v_fulfilment is null then raise exception 'Order not found'; end if;
  if p_status='preparing' and v_scheduled is not null and v_scheduled>now()+interval '30 minutes' then raise exception 'Scheduled order is not within the preparation window'; end if;
  if p_status='out_for_delivery' then
    if v_fulfilment<>'delivery' then raise exception 'Only delivery orders can be dispatched'; end if;
    if not exists(select 1 from public.lb_rider_assignments where order_id=p_order_id and status in ('assigned','picked_up')) then raise exception 'Assign a rider before dispatch'; end if;
  end if;

  v_label:=case p_status when 'preparing' then 'Kitchen started preparing' when 'ready' then 'Order ready for handoff' when 'out_for_delivery' then 'Rider is on the way' when 'delivered' then 'Order delivered' else 'Order cancelled' end;
  update public.lb_orders set order_status=p_status,updated_at=now() where id=p_order_id;
  if p_status='preparing' then perform public.lb_consume_order_inventory(p_order_id); end if;
  insert into public.lb_order_events(order_id,event_type,label,actor) values(p_order_id,p_status,v_label,v_role);
  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata) values('staff',auth.uid()::text,'order_status_change','order',p_order_id::text,jsonb_build_object('status',p_status,'role',v_role));
  return jsonb_build_object('id',p_order_id,'status',p_status);
end;
$$;

grant execute on function public.lb_create_order_v2(text,text,text,text,text,jsonb,text,timestamptz,text) to anon,authenticated;
grant execute on function public.lb_management_intelligence(integer) to authenticated;
grant execute on function public.lb_operations_update_order(uuid,text) to authenticated;
