export type PlatformModule = "Management" | "iPOS" | "Kitchen" | "Rider" | "Employee" | "Customer";

export type PlatformRoute = {
  path: string;
  title: string;
  module: PlatformModule;
  purpose: string;
  features: string[];
};

const route = (path: string, title: string, module: PlatformModule, features: string[]): PlatformRoute => ({
  path,
  title,
  module,
  purpose: `${title} workspace for London Bite ${module.toLowerCase()} operations.`,
  features,
});

export const platformRoutes: PlatformRoute[] = [
  route("/management/dashboard", "Command Dashboard", "Management", ["Live KPIs", "Operational alerts", "Sales pulse"]),
  route("/management/orders", "Orders", "Management", ["All orders", "Status control", "Search by bill number"]),
  route("/management/orders/retrieve", "Retrieve Orders", "Management", ["Unpaid retrieval", "Mark paid", "Reprint receipt"]),
  route("/management/customers", "Customers", "Management", ["Order history", "Ratings", "Membership status"]),
  route("/management/menu", "Menu Control", "Management", ["Products", "Prices", "Availability"]),
  route("/management/inventory", "Inventory", "Management", ["Daily uploads", "Stock review", "Variance alerts"]),
  route("/management/employees", "Employees", "Management", ["Unique employee IDs", "Profiles", "Documents"]),
  route("/management/attendance", "Attendance", "Management", ["100m geofence", "Check-in policy", "Exceptions"]),
  route("/management/fines", "Fines", "Management", ["Automatic rules", "Evidence", "Waivers"]),
  route("/management/payroll", "Payroll", "Management", ["Weekly payroll", "Monthly summary", "Net deductions"]),
  route("/management/stars", "Stars", "Management", ["Award stars", "Weekly reset", "History"]),
  route("/management/leaderboard", "Leaderboard", "Management", ["Weekly leaders", "Bonus view", "Performance ranking"]),
  route("/management/leave", "Leave Requests", "Management", ["Approve", "Reject", "Leave history"]),
  route("/management/documents", "Documents", "Management", ["CNIC or passport", "Police certificate", "Medical and CV"]),
  route("/management/contracts", "Contracts", "Management", ["Digital contracts", "Signatures", "Approval status"]),
  route("/management/announcements", "Announcements", "Management", ["Create notice", "Audience targeting", "History"]),
  route("/management/suggestions", "Suggestions", "Management", ["Employee suggestions", "Status", "Management response"]),
  route("/management/reports", "Reports", "Management", ["Sales", "Operations", "Staff performance"]),
  route("/management/settings", "Settings", "Management", ["Store rules", "Payment methods", "System configuration"]),
  route("/management/audit", "Audit Log", "Management", ["Critical actions", "Actor", "Timestamp"]),

  route("/ipos", "iPOS Dashboard", "iPOS", ["Shift sales", "Open orders", "Counter alerts"]),
  route("/ipos/new-order", "New Order", "iPOS", ["Click-to-cart", "Discount engine", "Payment status"]),
  route("/ipos/retrieve", "Retrieve", "iPOS", ["Find bill", "Unpaid to paid", "Close after payment"]),
  route("/ipos/payments", "Payments", "iPOS", ["Cash", "Bank Alfalah", "EasyPaisa and JazzCash"]),
  route("/ipos/membership", "Membership", "iPOS", ["Card number", "Maximum 10%", "Validity"]),
  route("/ipos/receipts", "Receipts", "iPOS", ["Thermal receipt", "PDF receipt", "Reprint"]),
  route("/ipos/menu", "Counter Menu", "iPOS", ["Categories", "Fast search", "Out-of-stock state"]),
  route("/ipos/customers", "Customer Lookup", "iPOS", ["Phone search", "Previous orders", "Pending rating"]),

  route("/kitchen", "Kitchen Dashboard", "Kitchen", ["Queue health", "Preparation SLA", "Ready count"]),
  route("/kitchen/queue", "Kitchen Queue", "Kitchen", ["Accepted orders", "Timers", "Instructions"]),
  route("/kitchen/preparing", "Preparing", "Kitchen", ["Active tickets", "Elapsed time", "Item progress"]),
  route("/kitchen/ready", "Ready", "Kitchen", ["Ready orders", "Counter handoff", "Rider handoff"]),
  route("/kitchen/stock", "Kitchen Stock", "Kitchen", ["Out-of-stock", "Finished item", "Restore item"]),
  route("/kitchen/qc", "Kitchen QC", "Kitchen", ["Wrong-order control", "Quality checks", "Proof"]),

  route("/rider", "Rider Dashboard", "Rider", ["Assigned jobs", "Delivery KPI", "Shift summary"]),
  route("/rider/orders", "Assigned Orders", "Rider", ["Receipt number", "Address", "Start delivery"]),
  route("/rider/active-delivery", "Active Delivery", "Rider", ["Live GPS", "Customer tracking", "Delivered action"]),
  route("/rider/history", "Delivery History", "Rider", ["Completed jobs", "Duration", "Performance"]),
  route("/rider/daily-sheet", "Daily Sheet", "Rider", ["Photo upload", "Shift close", "Management review"]),
  route("/rider/performance", "Rider Performance", "Rider", ["KPI thresholds", "Fines", "Trend"]),

  route("/employee", "Employee Home", "Employee", ["Shift status", "Announcements", "Quick actions"]),
  route("/employee/profile", "My Profile", "Employee", ["Personal data", "Next of kin", "Required documents"]),
  route("/employee/attendance", "My Attendance", "Employee", ["100m geofence", "Check-in", "Check-out"]),
  route("/employee/leave", "My Leave", "Employee", ["Request leave", "Status", "History"]),
  route("/employee/fines", "My Fines", "Employee", ["Reason", "Proof", "Payroll deduction"]),
  route("/employee/payroll", "My Payroll", "Employee", ["Weekly pay", "Deductions", "Monthly summary"]),
  route("/employee/stars", "My Stars", "Employee", ["Current stars", "Weekly result", "Bonus"]),
  route("/employee/announcements", "Staff Announcements", "Employee", ["Management notices", "Unread state", "History"]),
  route("/employee/suggestions", "Suggestions", "Employee", ["Submit", "Track status", "Response"]),
  route("/employee/inventory-upload", "Inventory Upload", "Employee", ["Head chef upload", "5MB limit", "Management review"]),

  route("/customer/track", "Track Order", "Customer", ["Status timeline", "Live delivery", "Order details"]),
  route("/customer/receipt", "Digital Receipt", "Customer", ["Bill items", "Payment state", "Receipt download"]),
  route("/customer/rating", "Rate Order", "Customer", ["1 to 5 stars", "Comment", "Optional tip"]),
];

export const moduleOrder: PlatformModule[] = ["Management", "iPOS", "Kitchen", "Rider", "Employee", "Customer"];

export function findPlatformRoute(slug: string[]): PlatformRoute | undefined {
  const path = `/${slug.join("/")}`;
  return platformRoutes.find((item) => item.path === path);
}

export const orderStatusFlow = ["Accepted", "Preparing", "Ready", "Rider Assigned", "Out for Delivery", "Delivered"] as const;
