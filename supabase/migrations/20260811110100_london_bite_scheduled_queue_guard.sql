-- Keep future scheduled orders visible to management, but out of station queues until the 30-minute preparation window.
create or replace function public.lb_operations_orders() returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_role text;v_employee uuid;
begin
  v_role:=public.lb_staff_role();v_employee:=public.lb_my_employee_id();
  if v_role not in ('owner','manager','kitchen','rider') then raise exception 'Operations order access required'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'order_number',o.order_number,'status',o.order_status,'fulfilment',o.fulfilment,'payment_status',o.payment_status,'total',o.total,'created_at',o.created_at,
      'customer_name',case when v_role in ('owner','manager','rider') then o.customer_name else null end,
      'customer_phone',case when v_role in ('owner','manager','rider') then o.customer_phone else null end,
      'delivery_address',case when v_role in ('owner','manager','rider') then o.delivery_address else null end,
      'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity) order by i.created_at),'[]'::jsonb) from public.lb_order_items i where i.order_id=o.id)
    ) order by o.created_at),'[]'::jsonb)
    from public.lb_orders o
    where o.order_status in ('accepted','preparing','ready','out_for_delivery')
      and (o.scheduled_for is null or o.scheduled_for <= now()+interval '30 minutes' or v_role in ('owner','manager'))
      and (
        v_role in ('owner','manager')
        or (v_role='kitchen' and o.order_status in ('accepted','preparing','ready'))
        or (v_role='rider' and exists(select 1 from public.lb_rider_assignments ra where ra.order_id=o.id and ra.employee_id=v_employee and ra.status in ('assigned','picked_up')))
      )
  );
end;
$$;
