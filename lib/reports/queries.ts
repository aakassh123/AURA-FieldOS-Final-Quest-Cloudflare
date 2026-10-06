import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/types";

export type ReportFilters = { from: string; to: string };

export type SalesReportRow = {
  employee_id: string;
  employee_code: string;
  employee: string;
  role: string;
  designation?: string;
  rank: number;
  deals: number;
  won_revenue: number;
  open_deals: number;
  open_pipeline: number;
  visits: number;
  geofence_verified_visits: number;
  leads: number;
  conversion_rate: number;
  quota_target: number;
  achievement_rate: number;
  status_label: "Top Performer" | "On Track" | "Consistent" | "Developing";
};

export type FunnelRow = {
  stage: string;
  position: number;
  leads: number;
  value: number;
};

export type FieldReport = {
  visits: number;
  completed: number;
  geofence_verified: number;
  trips: number;
  distance_km: number;
};

export type FinanceReport = {
  expenses_submitted: number;
  expenses_approved: number;
  commissions: number;
  payouts: number;
};

export type ExecutiveKpis = {
  wonRevenue: number;
  wonDeals: number;
  openPipeline: number;
  openDeals: number;
  teamQuotaTarget: number;
  teamAchievementRate: number;
  winRate: number;
  averageDealSize: number;
  totalVisits: number;
  completedVisits: number;
  geofenceVerifiedVisits: number;
  geofenceComplianceRate: number;
  totalDistanceKm: number;
  totalLeads: number;
};

export type ReportsData = {
  filters: ReportFilters;
  kpis: ExecutiveKpis;
  sales: {
    revenue: number;
    wonDeals: number;
    openPipeline: number;
    rows: SalesReportRow[];
  };
  funnel: FunnelRow[];
  field: FieldReport;
  finance: FinanceReport | null;
  employees: { id: string; full_name: string; employee_code: string }[];
};

function rangeDefaults() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

function safeDate(value: string | undefined, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback;
}

export async function getReportsData(input?: Partial<ReportFilters>): Promise<ReportsData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const { data: profile } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).maybeSingle();
  const role = profile?.role as AppRole | undefined;

  const defaults = rangeDefaults();
  const from = safeDate(input?.from, defaults.from);
  const to = safeDate(input?.to, defaults.to);
  const end = new Date(`${to}T23:59:59.999Z`).toISOString();
  const start = new Date(`${from}T00:00:00.000Z`).toISOString();

  const [employeesResult, dealsResult, leadsResult, visitsResult, tripsResult, targetsResult] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, employee_code, designation, role, status")
      .eq("status", "ACTIVE")
      .order("employee_code", { ascending: true }),
    supabase
      .from("deals")
      .select("id, owner_employee_id, status, revenue_amount, closed_at, created_at, title")
      .or(`created_at.gte.${start},closed_at.gte.${start}`)
      .lte("created_at", end),
    supabase
      .from("leads")
      .select("id, owner_employee_id, stage_id, estimated_value, created_at, pipeline:pipeline_stages(name, position)")
      .gte("created_at", start)
      .lte("created_at", end),
    supabase
      .from("customer_visits")
      .select("id, employee_id, status, geofence_verified, scheduled_at, completed_at")
      .gte("scheduled_at", start)
      .lte("scheduled_at", end),
    supabase
      .from("trips")
      .select("id, employee_id, distance_m, started_at, ended_at")
      .gte("started_at", start)
      .lte("started_at", end),
    supabase
      .from("targets")
      .select("id, employee_id, period_start, period_end, revenue_target, visit_target")
      .lte("period_start", to)
      .gte("period_end", from),
  ]);

  for (const result of [employeesResult, dealsResult, leadsResult, visitsResult, tripsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const employees = employeesResult.data ?? [];
  const deals = dealsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const trips = tripsResult.data ?? [];
  const targets = targetsResult.data ?? [];

  // Filter won deals within the exact closed period
  const won = deals.filter(
    (d: any) => d.status === "WON" && d.closed_at && new Date(d.closed_at) >= new Date(start) && new Date(d.closed_at) <= new Date(end)
  );
  const openDealsList = deals.filter((d: any) => d.status === "OPEN");
  const lostDealsList = deals.filter((d: any) => d.status === "LOST");

  const revenue = won.reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0);
  const openPipeline = openDealsList.reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0);

  // Map employee performance rows
  const unrankedRows = employees.map((e: any) => {
    const employeeWon = won.filter((d: any) => d.owner_employee_id === e.id);
    const employeeOpen = openDealsList.filter((d: any) => d.owner_employee_id === e.id);
    const employeeLeads = leads.filter((l: any) => l.owner_employee_id === e.id);
    const employeeVisits = visits.filter((v: any) => v.employee_id === e.id);

    const wonRev = employeeWon.reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0);
    const openPipe = employeeOpen.reduce((s: number, d: any) => s + Number(d.revenue_amount ?? 0), 0);
    const completedVisits = employeeVisits.filter((v: any) => v.status === "COMPLETED").length;
    const geofenceVerifiedVisits = employeeVisits.filter((v: any) => v.geofence_verified).length;

    const convertedLeads = employeeLeads.filter((l: any) => String(l.pipeline?.name).toLowerCase() === "won").length;
    let conversionRate = 0;
    if (employeeLeads.length > 0) {
      conversionRate = (convertedLeads / employeeLeads.length) * 100;
    } else if (employeeWon.length > 0) {
      conversionRate = 100;
    }

    // Target lookup or default quota
    const empTargetObj = targets.find((t: any) => t.employee_id === e.id);
    const quotaTarget = Number(empTargetObj?.revenue_target ?? 250000);
    const achievementRate = quotaTarget > 0 ? (wonRev / quotaTarget) * 100 : 0;

    let statusLabel: "Top Performer" | "On Track" | "Consistent" | "Developing" = "Developing";
    if (achievementRate >= 100) statusLabel = "Top Performer";
    else if (achievementRate >= 70) statusLabel = "On Track";
    else if (achievementRate >= 35) statusLabel = "Consistent";

    return {
      employee_id: e.id,
      employee_code: e.employee_code || "EMP-000",
      employee: e.full_name,
      role: e.role,
      designation: e.designation || (e.role === "COMPANY_ADMIN" ? "Company Administrator" : "Sales Executive"),
      deals: employeeWon.length,
      won_revenue: wonRev,
      open_deals: employeeOpen.length,
      open_pipeline: openPipe,
      visits: completedVisits,
      geofence_verified_visits: geofenceVerifiedVisits,
      leads: employeeLeads.length,
      conversion_rate: conversionRate,
      quota_target: quotaTarget,
      achievement_rate: achievementRate,
      status_label: statusLabel,
    };
  });

  // Sort and assign ranks: Won Revenue DESC -> Deals Won DESC -> Completed Visits DESC
  unrankedRows.sort((a, b) => {
    if (b.won_revenue !== a.won_revenue) return b.won_revenue - a.won_revenue;
    if (b.deals !== a.deals) return b.deals - a.deals;
    return b.visits - a.visits;
  });

  const rows: SalesReportRow[] = unrankedRows.map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));

  // Pipeline funnel stages
  const stageMap = new Map<string, FunnelRow>();
  for (const lead of leads as any[]) {
    const name = lead.pipeline?.name ?? "Unknown";
    const position = Number(lead.pipeline?.position ?? 999);
    const existing = stageMap.get(name) ?? { stage: name, position, leads: 0, value: 0 };
    existing.leads += 1;
    existing.value += Number(lead.estimated_value ?? 0);
    stageMap.set(name, existing);
  }
  const funnel = [...stageMap.values()].sort((a, b) => a.position - b.position);

  // Field operations
  const field: FieldReport = {
    visits: visits.length,
    completed: visits.filter((v: any) => v.status === "COMPLETED").length,
    geofence_verified: visits.filter((v: any) => v.geofence_verified).length,
    trips: trips.length,
    distance_km: trips.reduce((s: number, t: any) => s + Number(t.distance_m ?? 0), 0) / 1000,
  };

  // Executive team KPIs
  const teamQuotaTarget = rows.reduce((s, r) => s + r.quota_target, 0);
  const teamAchievementRate = teamQuotaTarget > 0 ? (revenue / teamQuotaTarget) * 100 : 0;
  const closedTotal = won.length + lostDealsList.length;
  const winRate = closedTotal > 0 ? (won.length / closedTotal) * 100 : won.length > 0 ? 100 : 0;
  const averageDealSize = won.length > 0 ? revenue / won.length : 0;
  const geofenceComplianceRate = field.completed > 0 ? (field.geofence_verified / field.completed) * 100 : 0;

  const kpis: ExecutiveKpis = {
    wonRevenue: revenue,
    wonDeals: won.length,
    openPipeline,
    openDeals: openDealsList.length,
    teamQuotaTarget,
    teamAchievementRate,
    winRate,
    averageDealSize,
    totalVisits: field.visits,
    completedVisits: field.completed,
    geofenceVerifiedVisits: field.geofence_verified,
    geofenceComplianceRate,
    totalDistanceKm: field.distance_km,
    totalLeads: leads.length,
  };

  let finance: FinanceReport | null = null;
  if (["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ACCOUNTS"].includes(String(role))) {
    const [expensesResult, commissionsResult, payoutsResult] = await Promise.all([
      supabase.from("expenses").select("amount,approved_amount,status,expense_date").gte("expense_date", from).lte("expense_date", to),
      supabase.from("commissions").select("commission_amount,calculated_at").gte("calculated_at", start).lte("calculated_at", end),
      supabase.from("payouts").select("net_amount,period_start,period_end").lte("period_start", to).gte("period_end", from),
    ]);
    for (const result of [expensesResult, commissionsResult, payoutsResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const expenses = expensesResult.data ?? [];
    const commissions = commissionsResult.data ?? [];
    const payouts = payoutsResult.data ?? [];
    finance = {
      expenses_submitted: expenses.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0),
      expenses_approved: expenses.reduce((s: number, x: any) => s + Number(x.approved_amount ?? 0), 0),
      commissions: commissions.reduce((s: number, x: any) => s + Number(x.commission_amount ?? 0), 0),
      payouts: payouts.reduce((s: number, x: any) => s + Number(x.net_amount ?? 0), 0),
    };
  }

  return {
    filters: { from, to },
    kpis,
    sales: { revenue, wonDeals: won.length, openPipeline, rows },
    funnel,
    field,
    finance,
    employees: employees.map((e: any) => ({
      id: e.id,
      full_name: e.full_name,
      employee_code: e.employee_code,
    })),
  };
}
