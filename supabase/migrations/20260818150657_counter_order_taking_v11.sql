-- PRD v1.1 counter order-taking surface and authenticated order command.
-- The RPC is the only write boundary used by the counter UI: it validates the
-- channel-specific destination, prices against the live catalogue, assigns the
-- counter actor, starts the SLA clock and records an append-only payment event.

create or replace function public.lb_counter_create_operational_order(
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
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_employee uuid;
  v_order_id uuid;
  v_tracking text;
  v_subtotal numeric(12,2) := 0;
  v_discount_percent numeric(5,2) := 0;
  v_discount_label text := 'No discount';
  v_discount_amount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_member_percent numeric(5,2) := 0;
  v_item jsonb;
  v_menu public.lb_menu_items%rowtype;
  v_qty integer;
  v_units integer := 0;
  v_target_minutes integer := 15;
  v_phone text := trim(coalesce(p_customer_phone, 'counter'));
  v_phone_digits text;
  v_customer_name text := coalesce(nullif(trim(p_customer_name), ''), 'Walk-in customer');
begin
  v_role := public.lb_staff_role();
  if v_role not in ('owner','manager','counter') then
    raise exception 'Counter access required';
  end if;

  v_employee := public.lb_my_employee_id();
  if p_channel not in ('dine_in','pickup','delivery') then
    raise exception 'Choose dine-in, takeaway or delivery';
  end if;
  if p_payment_method not in ('cash','online') then
    raise exception 'Invalid payment method';
  end if;
  if p_payment_status not in ('paid','pending','cash_due') then
    raise exception 'Invalid payment state';
  end if;
  if p_payment_method = 'online' and p_payment_status <> 'paid' then
    raise exception 'Online payment must be verified before it is recorded';
  end if;
  if p_channel = 'delivery' and p_payment_status = 'pending' then
    raise exception 'Delivery payment must be paid or cash on delivery';
  end if;
  if p_channel <> 'delivery' and p_payment_status = 'cash_due' then
    raise exception 'Cash on delivery is only available for delivery orders';
  end if;

  if p_channel = 'dine_in' and length(trim(coalesce(p_table_identifier,''))) < 1 then
    raise exception 'Table number is required';
  end if;
  if p_channel = 'pickup' and length(trim(coalesce(p_pickup_name,''))) < 2 then
    raise exception 'Pickup name is required';
  end if;
  if p_channel = 'delivery' then
    v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');
    if length(v_customer_name) < 2 then raise exception 'Customer name is required'; end if;
    if length(v_phone_digits) < 10 or length(v_phone_digits) > 15 then raise exception 'Valid phone is required'; end if;
    if length(trim(coalesce(p_delivery_address,''))) < 8 or length(trim(coalesce(p_delivery_address,''))) > 500 then
      raise exception 'Complete delivery address is required';
    end if;
  end if;
  if length(coalesce(p_notes,'')) > 500 then raise exception 'Order notes are too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Order must contain 1 to 30 line items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := coalesce((v_item->>'quantity')::integer, 1);
    exception when others then
      raise exception 'Invalid item quantity';
    end;
    if v_qty < 1 or v_qty > 50 then raise exception 'Item quantity must be between 1 and 50'; end if;
    v_units := v_units + v_qty;
    if v_units > 100 then raise exception 'Order quantity is too large'; end if;

    select * into v_menu
      from public.lb_menu_items
     where slug = v_item->>'slug' and is_active = true and is_available = true;
    if not found then raise exception 'Menu item unavailable: %', coalesce(v_item->>'slug','unknown'); end if;
    v_subtotal := v_subtotal + (v_menu.price * v_qty);
    v_target_minutes := greatest(v_target_minutes, coalesce(v_menu.prep_target_minutes, 15));
  end loop;
  if v_subtotal <= 0 or v_subtotal > 200000 then raise exception 'Order total is outside the allowed range'; end if;

  if v_phone <> 'counter' then
    select discount_percent into v_member_percent
      from public.lb_memberships
     where regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
       and status = 'active'
       and (valid_until is null or valid_until >= current_date)
     limit 1;
  end if;
  v_member_percent := least(10, coalesce(v_member_percent, 0));
  if v_member_percent > 0 then
    v_discount_percent := v_member_percent;
    v_discount_label := 'Membership';
  end if;
  v_discount_amount := round(v_subtotal * v_discount_percent / 100, 2);
  v_total := round(v_subtotal - v_discount_amount, 2);
  v_tracking := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.lb_orders(
    tracking_token,customer_name,customer_phone,delivery_address,fulfilment,
    payment_method,payment_status,subtotal,discount_label,discount_percent,
    discount_amount,total,source,notes,operational_state,delivery_state,
    table_identifier,pickup_name,target_due_at,collection_owner_employee_id,
    created_by_employee_id
  ) values (
    v_tracking,v_customer_name,v_phone,nullif(trim(coalesce(p_delivery_address,'')),''),p_channel,
    p_payment_method,p_payment_status,v_subtotal,v_discount_label,v_discount_percent,
    v_discount_amount,v_total,'ipos',nullif(trim(coalesce(p_notes,'')),''),'QUEUED',
    case when p_channel='delivery' then 'UNASSIGNED' else null end,
    nullif(trim(coalesce(p_table_identifier,'')),''),nullif(trim(coalesce(p_pickup_name,'')),''),
    now()+make_interval(mins=>v_target_minutes),
    case when p_payment_status='paid' then null else v_employee end,v_employee
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_menu from public.lb_menu_items where slug=v_item->>'slug';
    insert into public.lb_order_items(order_id,menu_item_id,item_name,unit_price,quantity,line_total)
    values(v_order_id,v_menu.id,v_menu.name,v_menu.price,v_qty,round(v_menu.price*v_qty,2));
  end loop;

  insert into public.lb_order_events(order_id,event_type,label,actor,metadata)
  values(v_order_id,'order_created','Counter created order',coalesce(v_employee::text,v_role),
    jsonb_build_object('channel',p_channel,'target_minutes',v_target_minutes,'payment_status',p_payment_status));
  insert into public.lb_order_events(order_id,event_type,label,actor,metadata)
  values(v_order_id,'queued','Sent to kitchen queue',coalesce(v_employee::text,v_role),
    jsonb_build_object('target_due_at',now()+make_interval(mins=>v_target_minutes)));

  insert into public.lb_payment_events(order_id,event_type,amount,method,actor_employee_id,reason)
  values(v_order_id,
    case when p_payment_status='paid' then 'PAYMENT_RECORDED' else 'PAYMENT_PENDING_ASSIGNED' end,
    v_total,p_payment_method,v_employee,
    case p_payment_status when 'paid' then 'Recorded during counter order creation' when 'cash_due' then 'Cash on delivery assigned from counter' else 'Collection required at handoff' end);

  insert into public.lb_audit_events(actor_type,actor_id,action,entity_type,entity_id,metadata)
  values('staff',auth.uid()::text,'counter_order_created','order',v_order_id::text,
    jsonb_build_object('channel',p_channel,'payment_status',p_payment_status,'payment_method',p_payment_method,
      'table_identifier',nullif(trim(coalesce(p_table_identifier,'')),''),'pickup_name',nullif(trim(coalesce(p_pickup_name,'')),''),
      'target_minutes',v_target_minutes,'item_lines',jsonb_array_length(p_items)));

  return (select jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'tracking_token',o.tracking_token,
    'status',o.order_status,'operational_state',o.operational_state,'payment_status',o.payment_status,
    'subtotal',o.subtotal,'discount_label',o.discount_label,'discount_amount',o.discount_amount,
    'total',o.total,'target_due_at',o.target_due_at,'created_at',o.created_at
  ) from public.lb_orders o where o.id=v_order_id);
end;
$$;

revoke all on function public.lb_counter_create_operational_order(text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.lb_counter_create_operational_order(text,text,text,text,text,text,text,text,text,jsonb) to authenticated;

-- Replace the prototype eight-item database list with the approved catalogue.
update public.lb_menu_items set is_active=false,updated_at=now();

insert into public.lb_menu_items(slug,name,category,price,image_url,badge,sort_order,prep_target_minutes,description,is_active,is_available)
values
  ('quarter-broast','Quarter Broast','Broast',799,'/menu/quarter-broast.webp','Quarter',1,18,'Official London Bite menu item.',true,true),
  ('half-broast','Half Broast','Broast',1499,'/menu/half-broast.webp','Half',2,18,'Official London Bite menu item.',true,true),
  ('full-broast','Full Broast','Broast',2699,'/menu/full-broast.webp','Full',3,18,'Official London Bite menu item.',true,true),
  ('peri-peri-wings-5pc','Peri Peri Wings · 5 pcs','Peri Peri',550,'/menu/peri-peri-wings-5pc.webp','5 pcs',4,15,'Official London Bite menu item.',true,true),
  ('peri-peri-wings-10pc','Peri Peri Wings · 10 pcs','Peri Peri',999,'/menu/peri-peri-wings-10pc.webp','10 pcs',5,15,'Official London Bite menu item.',true,true),
  ('peri-peri-strips-5pc','Peri Peri Strips · 5 pcs','Peri Peri',499,'/menu/peri-peri-strips.webp','5 pcs',6,15,'Official London Bite menu item.',true,true),
  ('peri-peri-burger','Peri Peri Burger','Premium Burgers',599,'/menu/peri-peri-burger.webp','Spicy',7,15,'Official London Bite menu item.',true,true),
  ('pizza-burger','Pizza Burger','Premium Burgers',549,'/menu/pizza-burger.webp','Fusion',8,15,'Official London Bite menu item.',true,true),
  ('mighty-burger','Mighty Burger','Premium Burgers',699,'/menu/mighty-burger.webp','Loaded',9,15,'Official London Bite menu item.',true,true),
  ('beef-burger-single','Beef Burger · Single Patty','Premium Burgers',799,'/menu/beef-burger-single.webp','Single',10,15,'Official London Bite menu item.',true,true),
  ('beef-burger-double','Beef Burger · Double Patty','Premium Burgers',1099,'/menu/beef-burger-double.webp','Double',11,15,'Official London Bite menu item.',true,true),
  ('zinger-burger','Zinger Burger','Classic Burgers',399,'/menu/zinger-burger.webp','Classic',12,15,'Official London Bite menu item.',true,true),
  ('mexican-fillet-burger','Mexican Fillet Burger','Classic Burgers',449,'/menu/mexican-fillet-burger.webp','Spicy',13,15,'Official London Bite menu item.',true,true),
  ('chicken-patty-burger','Chicken Patty Burger','Classic Burgers',350,'/menu/chicken-patty-burger.webp','Single',14,15,'Official London Bite menu item.',true,true),
  ('double-patty-burger','Double Patty Burger','Classic Burgers',650,'/menu/double-patty-burger.webp','Double',15,15,'Official London Bite menu item.',true,true),
  ('lebanese-kebab-burger','Lebanese Kebab Burger','Classic Burgers',399,'/menu/lebanese-kebab-burger.webp','Kebab',16,15,'Official London Bite menu item.',true,true),
  ('zinger-spicy-burger','Zinger Spicy Burger','Classic Burgers',449,'/menu/zinger-spicy-burger.webp','Hot',17,15,'Official London Bite menu item.',true,true),
  ('tikka-pizza-small','Tikka Pizza · Small','Classic Pizza',649,'/menu/tikka-pizza.webp','Small',18,20,'Official London Bite menu item.',true,true),
  ('tikka-pizza-medium','Tikka Pizza · Medium','Classic Pizza',1050,'/menu/tikka-pizza.webp','Medium',19,20,'Official London Bite menu item.',true,true),
  ('tikka-pizza-large','Tikka Pizza · Large','Classic Pizza',1550,'/menu/tikka-pizza.webp','Large',20,20,'Official London Bite menu item.',true,true),
  ('tikka-pizza-family','Tikka Pizza · Family','Classic Pizza',2050,'/menu/tikka-pizza.webp','Family',21,20,'Official London Bite menu item.',true,true),
  ('fajita-pizza-small','Fajita Pizza · Small','Classic Pizza',649,'/menu/fajita-pizza.webp','Small',22,20,'Official London Bite menu item.',true,true),
  ('fajita-pizza-medium','Fajita Pizza · Medium','Classic Pizza',1050,'/menu/fajita-pizza.webp','Medium',23,20,'Official London Bite menu item.',true,true),
  ('fajita-pizza-large','Fajita Pizza · Large','Classic Pizza',1550,'/menu/fajita-pizza.webp','Large',24,20,'Official London Bite menu item.',true,true),
  ('fajita-pizza-family','Fajita Pizza · Family','Classic Pizza',2050,'/menu/fajita-pizza.webp','Family',25,20,'Official London Bite menu item.',true,true),
  ('supreme-pizza-small','Supreme Pizza · Small','Classic Pizza',649,'/menu/supreme-pizza.webp','Small',26,20,'Official London Bite menu item.',true,true),
  ('supreme-pizza-medium','Supreme Pizza · Medium','Classic Pizza',1050,'/menu/supreme-pizza.webp','Medium',27,20,'Official London Bite menu item.',true,true),
  ('supreme-pizza-large','Supreme Pizza · Large','Classic Pizza',1550,'/menu/supreme-pizza.webp','Large',28,20,'Official London Bite menu item.',true,true),
  ('supreme-pizza-family','Supreme Pizza · Family','Classic Pizza',2050,'/menu/supreme-pizza.webp','Family',29,20,'Official London Bite menu item.',true,true),
  ('veggie-lover-pizza-small','Veggie Lover Pizza · Small','Classic Pizza',649,'/menu/veggie-lover-pizza.webp','Small',30,20,'Official London Bite menu item.',true,true),
  ('veggie-lover-pizza-medium','Veggie Lover Pizza · Medium','Classic Pizza',1050,'/menu/veggie-lover-pizza.webp','Medium',31,20,'Official London Bite menu item.',true,true),
  ('veggie-lover-pizza-large','Veggie Lover Pizza · Large','Classic Pizza',1550,'/menu/veggie-lover-pizza.webp','Large',32,20,'Official London Bite menu item.',true,true),
  ('veggie-lover-pizza-family','Veggie Lover Pizza · Family','Classic Pizza',2050,'/menu/veggie-lover-pizza.webp','Family',33,20,'Official London Bite menu item.',true,true),
  ('mughlai-pizza-small','Mughlai Pizza · Small','Classic Pizza',649,'/menu/mughlai-pizza.webp','Small',34,20,'Official London Bite menu item.',true,true),
  ('mughlai-pizza-medium','Mughlai Pizza · Medium','Classic Pizza',1050,'/menu/mughlai-pizza.webp','Medium',35,20,'Official London Bite menu item.',true,true),
  ('mughlai-pizza-large','Mughlai Pizza · Large','Classic Pizza',1550,'/menu/mughlai-pizza.webp','Large',36,20,'Official London Bite menu item.',true,true),
  ('mughlai-pizza-family','Mughlai Pizza · Family','Classic Pizza',2050,'/menu/mughlai-pizza.webp','Family',37,20,'Official London Bite menu item.',true,true),
  ('malai-boti-pizza-small','Malai Boti Pizza · Small','Special Pizza',699,'/menu/malai-boti-pizza.webp','Small',38,20,'Official London Bite menu item.',true,true),
  ('malai-boti-pizza-medium','Malai Boti Pizza · Medium','Special Pizza',1190,'/menu/malai-boti-pizza.webp','Medium',39,20,'Official London Bite menu item.',true,true),
  ('malai-boti-pizza-large','Malai Boti Pizza · Large','Special Pizza',1729,'/menu/malai-boti-pizza.webp','Large',40,20,'Official London Bite menu item.',true,true),
  ('malai-boti-pizza-family','Malai Boti Pizza · Family','Special Pizza',2229,'/menu/malai-boti-pizza.webp','Family',41,20,'Official London Bite menu item.',true,true),
  ('creamy-pizza-small','Creamy Pizza · Small','Special Pizza',699,'/menu/creamy-pizza.webp','Small',42,20,'Official London Bite menu item.',true,true),
  ('creamy-pizza-medium','Creamy Pizza · Medium','Special Pizza',1190,'/menu/creamy-pizza.webp','Medium',43,20,'Official London Bite menu item.',true,true),
  ('creamy-pizza-large','Creamy Pizza · Large','Special Pizza',1729,'/menu/creamy-pizza.webp','Large',44,20,'Official London Bite menu item.',true,true),
  ('creamy-pizza-family','Creamy Pizza · Family','Special Pizza',2229,'/menu/creamy-pizza.webp','Family',45,20,'Official London Bite menu item.',true,true),
  ('afghani-pizza-small','Afghani Pizza · Small','Special Pizza',699,'/menu/afghani-pizza.webp','Small',46,20,'Official London Bite menu item.',true,true),
  ('afghani-pizza-medium','Afghani Pizza · Medium','Special Pizza',1190,'/menu/afghani-pizza.webp','Medium',47,20,'Official London Bite menu item.',true,true),
  ('afghani-pizza-large','Afghani Pizza · Large','Special Pizza',1729,'/menu/afghani-pizza.webp','Large',48,20,'Official London Bite menu item.',true,true),
  ('afghani-pizza-family','Afghani Pizza · Family','Special Pizza',2229,'/menu/afghani-pizza.webp','Family',49,20,'Official London Bite menu item.',true,true),
  ('kebab-pizza-small','Kebab Pizza · Small','Special Pizza',699,'/menu/kebab-pizza.webp','Small',50,20,'Official London Bite menu item.',true,true),
  ('kebab-pizza-medium','Kebab Pizza · Medium','Special Pizza',1190,'/menu/kebab-pizza.webp','Medium',51,20,'Official London Bite menu item.',true,true),
  ('kebab-pizza-large','Kebab Pizza · Large','Special Pizza',1729,'/menu/kebab-pizza.webp','Large',52,20,'Official London Bite menu item.',true,true),
  ('kebab-pizza-family','Kebab Pizza · Family','Special Pizza',2229,'/menu/kebab-pizza.webp','Family',53,20,'Official London Bite menu item.',true,true),
  ('crown-crust-pizza-medium','Crown Crust Pizza · Medium','Premium Pizza',1450,'/menu/crown-crust-pizza.webp','Medium',54,20,'Official London Bite menu item.',true,true),
  ('crown-crust-pizza-large','Crown Crust Pizza · Large','Premium Pizza',2050,'/menu/crown-crust-pizza.webp','Large',55,20,'Official London Bite menu item.',true,true),
  ('crown-crust-pizza-family','Crown Crust Pizza · Family','Premium Pizza',2650,'/menu/crown-crust-pizza.webp','Family',56,20,'Official London Bite menu item.',true,true),
  ('kebab-crust-pizza-medium','Kebab Crust Pizza · Medium','Premium Pizza',1450,'/menu/kebab-crust-pizza.webp','Medium',57,20,'Official London Bite menu item.',true,true),
  ('kebab-crust-pizza-large','Kebab Crust Pizza · Large','Premium Pizza',2050,'/menu/kebab-crust-pizza.webp','Large',58,20,'Official London Bite menu item.',true,true),
  ('kebab-crust-pizza-family','Kebab Crust Pizza · Family','Premium Pizza',2650,'/menu/kebab-crust-pizza.webp','Family',59,20,'Official London Bite menu item.',true,true),
  ('cheese-crust-pizza-medium','Cheese Crust Pizza · Medium','Premium Pizza',1450,'/menu/cheese-crust-pizza.webp','Medium',60,20,'Official London Bite menu item.',true,true),
  ('cheese-crust-pizza-large','Cheese Crust Pizza · Large','Premium Pizza',2050,'/menu/cheese-crust-pizza.webp','Large',61,20,'Official London Bite menu item.',true,true),
  ('cheese-crust-pizza-family','Cheese Crust Pizza · Family','Premium Pizza',2650,'/menu/cheese-crust-pizza.webp','Family',62,20,'Official London Bite menu item.',true,true),
  ('super-supreme-pizza-medium','Super Supreme Pizza · Medium','Premium Pizza',1450,'/menu/super-supreme-pizza.webp','Medium',63,20,'Official London Bite menu item.',true,true),
  ('super-supreme-pizza-large','Super Supreme Pizza · Large','Premium Pizza',2050,'/menu/super-supreme-pizza.webp','Large',64,20,'Official London Bite menu item.',true,true),
  ('super-supreme-pizza-family','Super Supreme Pizza · Family','Premium Pizza',2650,'/menu/super-supreme-pizza.webp','Family',65,20,'Official London Bite menu item.',true,true),
  ('london-bite-special-pizza-large','London Bite Special Pizza · Large','Signature Pizza',2399,'/menu/london-bite-special-pizza.webp','Large',66,20,'Official London Bite menu item.',true,true),
  ('london-bite-special-pizza-family','London Bite Special Pizza · Family','Signature Pizza',2799,'/menu/london-bite-special-pizza.webp','Family',67,20,'Official London Bite menu item.',true,true),
  ('zingeratha','Zingeratha','Wraps',349,'/menu/zingeratha.webp','Classic',68,12,'Official London Bite menu item.',true,true),
  ('spicy-zingeratha','Spicy Zingeratha','Wraps',399,'/menu/spicy-zingeratha.webp','Spicy',69,12,'Official London Bite menu item.',true,true),
  ('loaded-wrap','Loaded Wrap','Wraps',590,'/menu/loaded-wrap.webp','Loaded',70,12,'Official London Bite menu item.',true,true),
  ('bbq-wrap','BBQ Wrap','Wraps',649,'/menu/bbq-wrap.webp','BBQ',71,12,'Official London Bite menu item.',true,true),
  ('peri-peri-grill-wrap','Peri Peri Grill Wrap','Wraps',749,'/menu/peri-peri-grill-wrap.webp','Grilled',72,12,'Official London Bite menu item.',true,true),
  ('junior-bite','The Junior Bite','Kids Meal',649,'/menu/junior-bite.webp','Kids',73,10,'Official London Bite menu item.',true,true),
  ('salsa-wings-5pc','Salsa Wings · 5 pcs','Sidekicks',450,'/menu/salsa-wings.webp','5 pcs',74,10,'Official London Bite menu item.',true,true),
  ('salsa-wings-10pc','Salsa Wings · 10 pcs','Sidekicks',700,'/menu/salsa-wings.webp','10 pcs',75,10,'Official London Bite menu item.',true,true),
  ('crispy-wings-5pc','Crispy Wings · 5 pcs','Sidekicks',350,'/menu/crispy-wings.webp','5 pcs',76,10,'Official London Bite menu item.',true,true),
  ('crispy-wings-10pc','Crispy Wings · 10 pcs','Sidekicks',600,'/menu/crispy-wings.webp','10 pcs',77,10,'Official London Bite menu item.',true,true),
  ('chicken-nuggets-5pc','Chicken Nuggets · 5 pcs','Sidekicks',300,'/menu/chicken-nuggets.webp','5 pcs',78,10,'Official London Bite menu item.',true,true),
  ('chicken-nuggets-10pc','Chicken Nuggets · 10 pcs','Sidekicks',580,'/menu/chicken-nuggets.webp','10 pcs',79,10,'Official London Bite menu item.',true,true),
  ('injected-nuggets-5pc','Injected Nuggets · 5 pcs','Sidekicks',499,'/menu/injected-nuggets.webp','5 pcs',80,10,'Official London Bite menu item.',true,true),
  ('injected-nuggets-10pc','Injected Nuggets · 10 pcs','Sidekicks',999,'/menu/injected-nuggets.webp','10 pcs',81,10,'Official London Bite menu item.',true,true),
  ('kabab-bites-4pc','Kabab Bites · 4 pcs','Sidekicks',599,'/menu/kabab-bites.webp','4 pcs',82,10,'Official London Bite menu item.',true,true),
  ('love-bites-10pc','Love Bites · 10 pcs','Sidekicks',399,'/menu/love-bites.webp','10 pcs',83,10,'Official London Bite menu item.',true,true),
  ('chicken-strips-4pc','Chicken Strips · 4 pcs','Sidekicks',399,'/menu/chicken-strips.webp','4 pcs',84,10,'Official London Bite menu item.',true,true),
  ('spring-roll','Spring Roll','Sidekicks',699,'/menu/spring-roll.webp',null,85,10,'Official London Bite menu item.',true,true),
  ('italian-pasta','Italian Pasta','Sidekicks',699,'/menu/italian-pasta.webp',null,86,10,'Official London Bite menu item.',true,true),
  ('classic-fries-medium','Classic Fries · Medium','Fries',250,'/menu/classic-fries.webp','Medium',87,10,'Official London Bite menu item.',true,true),
  ('classic-fries-large','Classic Fries · Large','Fries',350,'/menu/classic-fries.webp','Large',88,10,'Official London Bite menu item.',true,true),
  ('london-masala-fries','London Masala Fries','Fries',350,'/menu/london-masala-fries.webp',null,89,10,'Official London Bite menu item.',true,true),
  ('cheesy-fries','Cheesy Fries','Fries',449,'/menu/cheesy-fries.webp',null,90,10,'Official London Bite menu item.',true,true),
  ('loaded-fries','Loaded Fries','Fries',699,'/menu/loaded-fries.webp','Loaded',91,10,'Official London Bite menu item.',true,true),
  ('peri-peri-sauce','Peri Peri Sauce','Sauces',100,'/menu/peri-peri-sauce.webp',null,92,10,'Official London Bite menu item.',true,true),
  ('special-sauce','Special Sauce','Sauces',100,'/menu/special-sauce.webp',null,93,10,'Official London Bite menu item.',true,true),
  ('garlic-mayo','Garlic Mayo','Sauces',100,'/menu/garlic-mayo.webp',null,94,10,'Official London Bite menu item.',true,true),
  ('tango-sauce','Tango Sauce','Sauces',100,'/menu/tango-sauce.webp',null,95,10,'Official London Bite menu item.',true,true)
on conflict (slug) do update set
  name=excluded.name,category=excluded.category,price=excluded.price,image_url=excluded.image_url,
  badge=excluded.badge,sort_order=excluded.sort_order,prep_target_minutes=excluded.prep_target_minutes,
  is_active=true,updated_at=now();

