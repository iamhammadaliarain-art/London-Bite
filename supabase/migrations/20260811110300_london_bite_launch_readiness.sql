-- Version the launch-readiness RPC used by Management Settings.
create or replace function public.lb_management_launch_readiness() returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_menu integer;
  v_employees integer;
  v_linked integer;
  v_inventory integer;
  v_geofences integer;
  v_orders integer;
begin
  if not public.lb_is_manager() then raise exception 'Unauthorized'; end if;
  select count(*) into v_menu from public.lb_menu_items where is_active = true;
  select count(*) into v_employees from public.lb_employees where status = 'active';
  select count(*) into v_linked from public.lb_staff_memberships;
  select count(*) into v_inventory from public.lb_inventory_items;
  select count(*) into v_geofences from public.lb_branch_settings where latitude is not null and longitude is not null;
  select count(*) into v_orders from public.lb_orders;
  return jsonb_build_object(
    'menu', jsonb_build_object('ready', v_menu > 0, 'count', v_menu),
    'employees', jsonb_build_object('ready', v_employees > 0, 'count', v_employees),
    'staff_accounts', jsonb_build_object('ready', v_linked > 1, 'count', v_linked),
    'inventory', jsonb_build_object('ready', v_inventory > 0, 'count', v_inventory),
    'geofence', jsonb_build_object('ready', v_geofences > 0, 'count', v_geofences),
    'order_pipeline', jsonb_build_object('ready', true, 'count', v_orders),
    'cash_orders', jsonb_build_object('ready', true),
    'online_payment', jsonb_build_object('ready', false, 'external', true),
    'native_store_release', jsonb_build_object('ready', false, 'external', true)
  );
end;
$$;

revoke all on function public.lb_management_launch_readiness() from public,anon,authenticated;
grant execute on function public.lb_management_launch_readiness() to authenticated;
