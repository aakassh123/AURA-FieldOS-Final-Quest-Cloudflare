import { NextRequest, NextResponse } from "next/server";
import { getReportsData } from "@/lib/reports/queries";

function csvCell(value: unknown) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(request: NextRequest) {
  try {
    const data = await getReportsData({
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
    });

    const lines = [
      ["AURA FieldOS Executive Analytics & Sales Performance Report", `${data.filters.from} to ${data.filters.to}`],
      [],
      ["Executive KPI Summary"],
      [
        "Total Won Revenue",
        "Team Quota Target",
        "Quota Achievement %",
        "Open Pipeline Value",
        "Win Rate %",
        "Average Deal Size",
        "Completed Customer Visits",
        "Geofence Compliance %",
        "Field Distance (km)",
      ],
      [
        data.kpis.wonRevenue.toFixed(2),
        data.kpis.teamQuotaTarget.toFixed(2),
        `${data.kpis.teamAchievementRate.toFixed(1)}%`,
        data.kpis.openPipeline.toFixed(2),
        `${data.kpis.winRate.toFixed(1)}%`,
        data.kpis.averageDealSize.toFixed(2),
        data.kpis.completedVisits,
        `${data.kpis.geofenceComplianceRate.toFixed(1)}%`,
        data.kpis.totalDistanceKm.toFixed(1),
      ],
      [],
      ["Sales Rep Performance Leaderboard (Zoho CRM Benchmarking)"],
      [
        "Rank",
        "Employee Code",
        "Employee Name",
        "Role",
        "Quota Target (INR)",
        "Won Revenue (INR)",
        "Attainment %",
        "Won Deals",
        "Open Pipeline (INR)",
        "Completed Visits",
        "Geofence Verified",
        "Leads Handled",
        "Conversion Rate",
        "Performance Status",
      ],
      ...data.sales.rows.map((r) => [
        `#${r.rank}`,
        r.employee_code,
        r.employee,
        r.role,
        r.quota_target.toFixed(2),
        r.won_revenue.toFixed(2),
        `${r.achievement_rate.toFixed(1)}%`,
        r.deals,
        r.open_pipeline.toFixed(2),
        r.visits,
        r.geofence_verified_visits,
        r.leads,
        `${r.conversion_rate.toFixed(1)}%`,
        r.status_label,
      ]),
      [],
      ["Pipeline Funnel Stage Breakdown"],
      ["Stage", "Position", "Leads Count", "Estimated Value (INR)"],
      ...data.funnel.map((r) => [r.stage, r.position, r.leads, r.value.toFixed(2)]),
      [],
      ["Field Work & Visit Operations"],
      ["Total Visits", "Completed Visits", "Geofence Verified", "Total Trips", "Distance Logged (km)"],
      [
        data.field.visits,
        data.field.completed,
        data.field.geofence_verified,
        data.field.trips,
        data.field.distance_km.toFixed(2),
      ],
    ];

    if (data.finance) {
      lines.push(
        [],
        ["Financial Controls & Compensation Snapshot"],
        ["Expenses Submitted", "Expenses Approved", "Commissions Calculated", "Payouts Processed"],
        [
          data.finance.expenses_submitted.toFixed(2),
          data.finance.expenses_approved.toFixed(2),
          data.finance.commissions.toFixed(2),
          data.finance.payouts.toFixed(2),
        ]
      );
    }

    const body = lines.map((row) => row.map(csvCell).join(",")).join("\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aura-fieldos-zoho-sales-report-${data.filters.from}-to-${data.filters.to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export report" },
      { status: 500 }
    );
  }
}
