import { NextRequest, NextResponse } from "next/server";
import { getReportsData } from "@/lib/reports/queries";

function csvCell(value: unknown) { const s = String(value ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
export async function GET(request: NextRequest) {
  try {
    const data = await getReportsData({ from: request.nextUrl.searchParams.get("from") ?? undefined, to: request.nextUrl.searchParams.get("to") ?? undefined });
    const lines = [
      ["AURA FieldOS Report", `${data.filters.from} to ${data.filters.to}`],
      [], ["Sales performance"], ["Employee","Won Revenue","Won Deals","Leads","Completed Visits","Conversion Rate"],
      ...data.sales.rows.map(r => [r.employee, r.won_revenue.toFixed(2), r.deals, r.leads, r.visits, `${r.conversion_rate.toFixed(1)}%`]),
      [], ["Pipeline funnel"], ["Stage","Leads","Estimated Value"], ...data.funnel.map(r => [r.stage,r.leads,r.value.toFixed(2)]),
      [], ["Field summary"], ["Visits","Completed","Geofence Verified","Trips","Distance KM"], [data.field.visits,data.field.completed,data.field.geofence_verified,data.field.trips,data.field.distance_km.toFixed(2)],
    ];
    if (data.finance) { lines.push([], ["Finance snapshot"], ["Expenses Submitted","Expenses Approved","Commission","Payouts"], [data.finance.expenses_submitted.toFixed(2),data.finance.expenses_approved.toFixed(2),data.finance.commissions.toFixed(2),data.finance.payouts.toFixed(2)]); }
    const body = lines.map(row => row.map(csvCell).join(",")).join("\n");
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="aura-fieldos-report-${data.filters.from}-to-${data.filters.to}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export report" }, { status: 500 }); }
}
