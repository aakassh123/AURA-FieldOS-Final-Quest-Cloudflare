import { createClient } from "@/lib/supabase/server";

export type DashboardData = {
  kpis: { sales: number; qualifiedLeads: number; visits: number; pipeline: number };
  performance: { label: string; value: number }[];
  tasks: { id: string; title: string; due_at: string | null; priority: string; status: string; customer: string | null }[];
  leads: { id: string; title: string; owner: string | null; stage: string | null; value: number; priority: string }[];
  team: { id: string; name: string; role: string; state: "On visit" | "Working" | "Offline"; customer: string | null }[];
  pendingExpenses: { count: number; amount: number };
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const twelveWeeksAgo = new Date(startOfWeek(now));
  twelveWeeksAgo.setUTCDate(twelveWeeksAgo.getUTCDate() - 7 * 11);

  const [
    dealsResult,
    leadsResult,
    visitsResult,
    tasksResult,
    sessionsResult,
    employeesResult,
    expensesResult,
  ] = await Promise.all([
    supabase.from("deals").select("id,status,revenue_amount,closed_at,owner_employee_id").or(`closed_at.gte.${twelveWeeksAgo.toISOString()},status.eq.OPEN`),
    supabase.from("leads").select("id,title,estimated_value,priority,status,created_at,owner_employee_id,stage:pipeline_stages(name),owner:owner_employee_id(full_name)").order("updated_at", { ascending: false }).limit(20),
    supabase.from("customer_visits").select("id,employee_id,status,scheduled_at,completed_at,customer:customer_id(name)").gte("scheduled_at", monthStart.toISOString()).lt("scheduled_at", nextMonth.toISOString()).order("scheduled_at", { ascending: false }),
    supabase.from("tasks").select("id,title,due_at,priority,status,assigned_employee_id,customer:customer_id(name)").order("due_at", { ascending: true }).limit(20),
    supabase.from("work_sessions").select("id,employee_id,status,started_at,ended_at").eq("status", "ACTIVE"),
    supabase.from("employees").select("id,full_name,role,status").eq("status", "ACTIVE").order("full_name"),
    supabase.from("expenses").select("id,amount,status").eq("status", "SUBMITTED"),
  ]);

  for (const result of [dealsResult, leadsResult, visitsResult, tasksResult, sessionsResult, employeesResult, expensesResult]) {
    if (result.error) console.warn("Dashboard query notice:", result.error.message);
  }

  const deals = dealsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const employees = employeesResult.data ?? [];
  const expenses = expensesResult.data ?? [];

  const wonThisMonth = deals.filter((d) => d.status === "WON" && d.closed_at && new Date(d.closed_at) >= monthStart && new Date(d.closed_at) < nextMonth);
  const openDeals = deals.filter((d) => d.status === "OPEN");
  const qualifiedLeads = leads.filter((l: any) => String(l.stage?.name).toLowerCase() === "qualified" && String(l.status) === "OPEN").length;
  const completedVisits = visits.filter((v) => v.status === "COMPLETED").length;

  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(twelveWeeksAgo);
    start.setUTCDate(start.getUTCDate() + index * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const value = deals.filter((d) => d.status === "WON" && d.closed_at && new Date(d.closed_at) >= start && new Date(d.closed_at) < end)
      .reduce((sum, d) => sum + Number(d.revenue_amount ?? 0), 0);
    return { label: `W${index + 1}`, value };
  });

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const visitByEmployee = new Map<string, any>();
  for (const visit of visits.filter((v) => v.status === "STARTED").slice(0, 20)) {
    if (visit.employee_id && !visitByEmployee.has(visit.employee_id)) visitByEmployee.set(visit.employee_id, visit);
  }

  const team = employees.map((employee) => {
    const activeVisit = visitByEmployee.get(employee.id);
    const working = sessions.some((session) => session.employee_id === employee.id);
    return {
      id: employee.id,
      name: employee.full_name,
      role: employee.role,
      state: activeVisit ? "On visit" : working ? "Working" : "Offline",
      customer: activeVisit?.customer?.name ?? null,
    } as const;
  });

  const recentLeads = leads.slice(0, 5).map((lead: any) => ({
    id: lead.id,
    title: lead.title,
    owner: lead.owner?.full_name ?? null,
    stage: lead.stage?.name ?? null,
    value: Number(lead.estimated_value ?? 0),
    priority: String(lead.priority),
  }));

  return {
    kpis: {
      sales: wonThisMonth.reduce((sum, deal) => sum + Number(deal.revenue_amount ?? 0), 0),
      qualifiedLeads,
      visits: visits.filter((v: any) => v.status === "COMPLETED").length,
      pipeline: openDeals.length
        ? openDeals.reduce((sum, deal) => sum + Number(deal.revenue_amount ?? 0), 0)
        : leads.filter((l: any) => l.status === "OPEN").reduce((sum: number, l: any) => sum + Number(l.estimated_value ?? 0), 0),
    },
    performance: weeks,
    tasks: tasks.slice(0, 5).map((task: any) => ({
      id: task.id,
      title: task.title,
      due_at: task.due_at,
      priority: String(task.priority),
      status: String(task.status),
      customer: task.customer?.name ?? null,
    })),
    leads: recentLeads,
    team,
    pendingExpenses: {
      count: expenses.length,
      amount: expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
    },
  };
}
