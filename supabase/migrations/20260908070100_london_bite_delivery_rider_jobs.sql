-- Rider-facing delivery feed with the original order timestamp as the 40-minute SLA start.
create or replace function public.lb_delivery_rider_jobs(p_include_history boolean default false)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare v_employee uuid;v_date date;v_start timestamptz;v_end timestamptz;begin
  v_employee:=public.lb_my_employee_id();
  if public.lb_staff_role()<>'rider' or v_employee is null then raise exception 'Rider access required'; end if;
  v_date:=public.lb_delivery_business_date(now());
  v_start:=(v_date::timestamp+time '14:00') at time zone 'Asia/Karachi';
  v_end:=((v_date+1)::timestamp+time '04:00') at time zone 'Asia/Karachi';
  return coalesce((select jsonb_agg(jsonb_build_object(
    'assignment_id',ra.id,'order_id',o.id,'order_number',o.order_number,
    'assignment_status',ra.status,'order_status',o.order_status,
    'customer_name',o.customer_name,'customer_phone',o.customer_phone,
    'delivery_address',o.delivery_address,'total',o.total,
    'order_started_at',o.created_at,'assigned_at',ra.assigned_at,
    'picked_up_at',ra.picked_up_at,'delivered_at',ra.delivered_at,
    'bonus_candidate',ra.bonus_candidate,'bonus_amount',ra.bonus_amount,
    'verification_status',ra.verification_status,'payment_status',ra.payment_status,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity) order by i.created_at),'[]'::jsonb) from public.lb_order_items i where i.order_id=o.id)
  ) order by o.created_at desc)
  from public.lb_rider_assignments ra join public.lb_orders o on o.id=ra.order_id
  where ra.employee_id=v_employee and o.created_at>=v_start and o.created_at<v_end
    and (p_include_history or ra.status in ('assigned','picked_up'))),'[]'::jsonb);
end;$$;

revoke all on function public.lb_delivery_rider_jobs(boolean) from public,anon;
grant execute on function public.lb_delivery_rider_jobs(boolean) to authenticated;
