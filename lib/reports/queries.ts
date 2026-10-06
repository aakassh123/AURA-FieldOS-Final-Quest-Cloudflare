import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/types";

export type ReportFilters = { from: string; to: string };
export type SalesReportRow = { employee_id: string; employee: string; deals: number; won_revenue: number; visits: number; leads: number; conversion_rate: number };
export type FunnelRow = { stage: string; position: number; leads: number; value: number };
export type FieldReport = { visits: number; completed: number; geofence_verified: number; trips: number; distance_km: number };
export type FinanceReport = { expenses_submitted: number; expenses_approved: number; commissions: number; payouts: number };
export type ReportsData = { filters: ReportFilters; sales: { revenue: number; wonDeals: number; openPipeline: number; rows: SalesReportRow[] }; funnel: FunnelRow[]; field: FieldReport; finance: FinanceReport | null };

function rangeDefaults() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
function safeDate(value: string | undefined, fallback: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback; }

export async function getReportsData(input?: Partial<ReportFilters>): Promise<ReportsData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role as AppRole | undefined;
  const defaults = rangeDefaults();
  const from = safeDate(input?.from, defaults.from);
  const to = safeDate(input?.to, defaults.to);
  const end = new Date(`${to}T23:59:59.999Z`).toISOString();
  const start = new Date(`${from}T00:00:00.000Z`).toISOString();

  const [employeesResult, dealsResult, leadsResult, visitsResult, tripsResult] = await Promise.all([
    supabase.from("employees").select("id,full_name,status").eq("status", "ACTIVE").order("full_name"),
    supabase.from("deals").select("id,owner_employee_id,status,revenue_amount,closed_at,created_at").or(`created_at.gte.${start},closed_at.gte.${start}`).lte("created_at", end),
    supabase.from("leads").select("id,owner_employee_id,stage_id,estimated_value,created_at,pipeline:pipeline_stages(name,position)").gte("created_at", start).lte("created_at", end),
    supabase.from("customer_visits").select("id,employee_id,status,geofence_verified,scheduled_at,completed_at").gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("trips").select("id,employee_id,distance_m,started_at,ended_at").gte("started_at", start).lte("started_at", end),
  ]);
  for (const result of [employeesResult, dealsResult, leadsResult, visitsResult, tripsResult]) if (result.error) throw new Error(result.error.message);

  const employees = employeesResult.data ?? [];
  const deals = dealsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const trips = tripsResult.data ?? [];

  const won = deals.filter((d: any) => d.status === "WON" && d.closed_at && new Date(d.closed_at) >= new Date(start) && new Date(d.closed_at) <= new Date(end));
  const revenue = won.reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0);
  const openPipeline = deals.filter((d: any) => d.status === "OPEN").reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0);

  const rows = employees.map((e: any) => {
    const employeeWon = won.filter((d: any) => d.owner_employee_id === e.id);
    const employeeLeads = leads.filter((l: any) => l.owner_employee_id === e.id);
    const employeeVisits = visits.filter((v: any) => v.employee_id === e.id);
    const converted = employeeLeads.filter((l: any) => String(l.pipeline?.name).toLowerCase() === "won").length;
    return { employee_id: e.id, employee: e.full_name, deals: employeeWon.length, won_revenue: employeeWon.reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0), visits: employeeVisits.filter((v: any) => v.status === "COMPLETED").length, leads: employeeLeads.length, conversion_rate: employeeLeads.length ? (converted / employeeLeads.length) * 100 : 0 };
  }).sort((a, b) => b.won_revenue - a.won_revenue);

  const stageMap = new Map<string, FunnelRow>();
  for (const lead of leads as any[]) {
    const name = lead.pipeline?.name ?? "Unknown";
    const position = Number(lead.pipeline?.position ?? 999);
    const existing = stageMap.get(name) ?? { stage: name, position, leads: 0, value: 0 };
    existing.leads += 1; existing.value += Number(lead.estimated_value ?? 0); stageMap.set(name, existing);
  }
  const funnel = [...stageMap.values()].sort((a, b) => a.position - b.position);
  const field = { visits: visits.length, completed: visits.filter((v: any) => v.status === "COMPLETED").length, geofence_verified: visits.filter((v: any) => v.geofence_verified).length, trips: trips.length, distance_km: trips.reduce((s: number, t: any) => s + Number(t.distance_m ?? 0), 0) / 1000 };

  let finance: FinanceReport | null = null;
  if (["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ACCOUNTS"].includes(String(role))) {
    const [expensesResult, commissionsResult, payoutsResult] = await Promise.all([
      supabase.from("expenses").select("amount,approved_amount,status,expense_date").gte("expense_date", from).lte("expense_date", to),
      supabase.from("commissions").select("commission_amount,calculated_at").gte("calculated_at", start).lte("calculated_at", end),
      supabase.from("payouts").select("net_amount,period_start,period_end").lte("period_start", to).gte("period_end", from),
    ]);
    for (const result of [expensesResult, commissionsResult, payoutsResult]) if (result.error) throw new Error(result.error.message);
    const expenses = expensesResult.data ?? [], commissions = commissionsResult.data ?? [], payouts = payoutsResult.data ?? [];
    finance = { expenses_submitted: expenses.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0), expenses_approved: expenses.reduce((s: number, x: any) => s + Number(x.approved_amount ?? 0), 0), commissions: commissions.reduce((s: number, x: any) => s + Number(x.commission_amount ?? 0), 0), payouts: payouts.reduce((s: number, x: any) => s + Number(x.net_amount ?? 0), 0) };
  }
  return { filters: { from, to }, sales: { revenue, wonDeals: won.length, openPipeline, rows }, funnel, field, finance };
}
