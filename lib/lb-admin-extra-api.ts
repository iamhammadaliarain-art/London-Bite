import { lbRpc, type LiveProduct } from "@/lib/lb-api";

export type FeedbackRecord = { id:string; order_number:number; rating:number; comment:string|null; issue_category:string|null; created_at:string };
export type SuggestionRecord = { id:string; employee_id:string; employee_code:string; employee_name:string; title:string; detail:string; status:string; management_response:string|null; created_at:string };
export type StaffSuggestion = { id:string; title:string; detail:string; status:string; management_response:string|null; created_at:string };
export type AttendanceRecord = { id:number; employee_id:string; employee_code:string; employee_name:string; event_type:string; occurred_at:string; distance_meters:number|null; status:string|null; fine_amount:number };
export type AuditRecord = { id:number; actor_type:string; actor_id:string|null; action:string; entity_type:string; entity_id:string|null; metadata:Record<string,unknown>; created_at:string };
export type CounterOrder = { id:string; order_number:number; tracking_token:string; status:string; total:number; created_at:string };

export const getManagementMenu = (token:string) => lbRpc<(LiveProduct & { is_active:boolean })[]>("lb_management_menu",{},token);
export const updateManagementMenuItem = (token:string,itemId:string,input:{price?:number;available?:boolean;active?:boolean}) => lbRpc("lb_management_update_menu_item",{p_item_id:itemId,p_price:input.price??null,p_available:input.available??null,p_active:input.active??null},token);
export const createCounterOrder = (token:string,input:{name?:string;fulfilment:"pickup"|"dine_in";items:{slug:string;quantity:number}[]}) => lbRpc<CounterOrder>("lb_counter_create_order",{p_customer_name:input.name??"Walk-in customer",p_fulfilment:input.fulfilment,p_items:input.items},token);
export const submitCustomerFeedback = (trackingToken:string,rating:number,comment?:string,issueCategory?:string) => lbRpc("lb_submit_feedback",{p_tracking_token:trackingToken,p_rating:rating,p_comment:comment??null,p_issue_category:issueCategory??null});
export const getManagementFeedback = (token:string) => lbRpc<FeedbackRecord[]>("lb_management_feedback",{},token);
export const submitStaffSuggestion = (token:string,title:string,detail:string) => lbRpc("lb_staff_submit_suggestion",{p_title:title,p_detail:detail},token);
export const getManagementSuggestions = (token:string) => lbRpc<SuggestionRecord[]>("lb_management_suggestions",{},token);
export const updateManagementSuggestion = (token:string,id:string,status:string,response?:string) => lbRpc("lb_management_update_suggestion",{p_id:id,p_status:status,p_response:response??null},token);
export const getStaffSuggestions = (token:string) => lbRpc<StaffSuggestion[]>("lb_staff_suggestions",{},token);
export const getManagementAttendance = (token:string,date?:string) => lbRpc<AttendanceRecord[]>("lb_management_attendance",{p_date:date??new Date().toISOString().slice(0,10)},token);
export const getManagementAudit = (token:string,limit=100) => lbRpc<AuditRecord[]>("lb_management_audit",{p_limit:limit},token);
export const createManagementAnnouncement = (token:string,title:string,body:string,audience="all") => lbRpc("lb_management_announcement_create",{p_title:title,p_body:body,p_audience:audience},token);
