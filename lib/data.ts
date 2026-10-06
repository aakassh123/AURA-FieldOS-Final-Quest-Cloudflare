export const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Today", icon: "layout-dashboard", href: "/" },
      { label: "Attendance & Shifts", icon: "calendar-check", href: "/attendance" },
      { label: "My Work", icon: "check-square", href: "/field" },
      { label: "Quest & Rewards", icon: "gift", href: "/rewards" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", icon: "users", href: "/leads" },
      { label: "Customers", icon: "building-2", href: "/customers" },
    ],
  },
  {
    label: "Field Work",
    items: [
      { label: "Live Map", icon: "map", href: "/map" },
      { label: "Visits", icon: "map-pin", href: "/visits" },
      { label: "Trips & Distance", icon: "route", href: "/trips" },
      { label: "Expense Claims", icon: "receipt", href: "/expenses" },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Employees", icon: "users-round", href: "/employees" },
      { label: "Teams", icon: "users-round", href: "/teams" },
    ],
  },
  {
    label: "Finance",
    allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ACCOUNTS"],
    items: [
      { label: "Money", icon: "wallet", href: "/finance" },
      { label: "Compensation", icon: "badge-dollar-sign", href: "/compensation" },
      { label: "Commissions", icon: "percent", href: "/commissions" },
      { label: "Payouts", icon: "banknote", href: "/payouts" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", icon: "bell", href: "/notifications" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports & Analytics", icon: "chart-no-axes-combined", href: "/reports" },
    ],
  },
];

export const performance = [62, 70, 54, 78, 72, 88, 82, 94, 76, 86, 91, 98];
export const tasks = [
  { title: "Follow up with Hotel Sunrise", meta: "10:30 AM · High priority", status: "Due" },
  { title: "Demo at City Centre", meta: "1:00 PM · 3.2 km away", status: "Next" },
  { title: "Submit travel expense", meta: "Today · ₹1,240", status: "Pending" },
];
export const leads = [
  { name: "Hotel Sunrise", owner: "Rohit Kumar", stage: "Demo", value: "₹2.4L", priority: "Hot" },
  { name: "Cafe Avenue", owner: "Priya Singh", stage: "Qualified", value: "₹85K", priority: "Warm" },
  { name: "Grand Palace", owner: "Aman Verma", stage: "Proposal", value: "₹1.6L", priority: "Hot" },
  { name: "Urban Eats", owner: "Neha Gupta", stage: "New", value: "₹45K", priority: "Cold" },
];
export const team = [
  { name: "Rohit Kumar", initials: "RK", state: "On visit", area: "Gomti Nagar", color: "bg-teal-100 text-teal-700" },
  { name: "Priya Singh", initials: "PS", state: "Travelling", area: "Hazratganj", color: "bg-blue-100 text-blue-700" },
  { name: "Aman Verma", initials: "AV", state: "On visit", area: "Aliganj", color: "bg-violet-100 text-violet-700" },
  { name: "Neha Gupta", initials: "NG", state: "Offline", area: "Indira Nagar", color: "bg-slate-100 text-slate-600" },
];
