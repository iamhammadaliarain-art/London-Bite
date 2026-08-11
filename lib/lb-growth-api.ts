import { lbRpc } from "@/lib/lb-api";

export type MembershipRecord={id:string;customer_phone:string;customer_name:string|null;member_code:string;discount_percent:number;valid_until:string|null;status:string};
export type WorkforceEvidence={employee_id:string;employee_code:string;name:string;role:string;station:string|null;tasks_done:number;tasks_open:number;check_ins:number;late_events:number;attendance_policy_amount:number;deliveries:number;avg_delivery_minutes:number;open_incidents:number};
export type CounterMemberOrder={id:string;order_number:number;tracking_token:string;status:string;subtotal:number;discount_label:string;discount_amount:number;total:number;created_at:string};

export const getCounterMemberships=(token:string,query="")=>lbRpc<MembershipRecord[]>("lb_counter_memberships",{p_query:query||null},token);
export const upsertCounterMembership=(token:string,input:{phone:string;name?:string;discountPercent:number;validUntil?:string;status?:"active"|"paused"|"expired"})=>lbRpc<{id:string;member_code:string;status:string}>("lb_counter_membership_upsert",{p_customer_phone:input.phone,p_customer_name:input.name??null,p_discount_percent:input.discountPercent,p_valid_until:input.validUntil??null,p_status:input.status??"active"},token);
export const getWorkforcePerformance=(token:string,days=30)=>lbRpc<WorkforceEvidence[]>("lb_management_workforce_performance",{p_days:days},token);
export const createCounterMemberOrder=(token:string,input:{name?:string;phone?:string;fulfilment:"pickup"|"dine_in";items:{slug:string;quantity:number}[]})=>lbRpc<CounterMemberOrder>("lb_counter_create_order_v2",{p_customer_name:input.name??"Walk-in customer",p_customer_phone:input.phone?.trim()||"counter",p_fulfilment:input.fulfilment,p_items:input.items},token);
