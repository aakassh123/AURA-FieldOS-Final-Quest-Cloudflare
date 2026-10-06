"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { createDeal } from "@/app/actions/finance";
import type { ReportsData, SalesReportRow } from "@/lib/reports/queries";

const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const pct = (v: number) => `${v.toFixed(1)}%`;

type ActiveTab = "leaderboard" | "funnel" | "field" | "finance";

export function ZohoReportsDashboard({ data }: { data: ReportsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<ActiveTab>("leaderboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"won_revenue" | "achievement_rate" | "deals" | "visits" | "conversion_rate">("won_revenue");
  const [sortAsc, setSortAsc] = useState(false);

  // Quick Deal modal
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealPending, setDealPending] = useState(false);
  const [dealMsg, setDealMsg] = useState<{ error?: string; success?: boolean } | null>(null);

  // Quick preset dates
  const handlePreset = (preset: "today" | "week" | "month" | "last30" | "quarter" | "ytd") => {
    const now = new Date();
    let fromDate: Date;
    let toDate = new Date();

    if (preset === "today") {
      fromDate = new Date();
    } else if (preset === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      fromDate = new Date(now.setDate(diff));
    } else if (preset === "month") {
      fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    } else if (preset === "last30") {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === "quarter") {
      const currentQuarter = Math.floor(now.getUTCMonth() / 3);
      fromDate = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1));
    } else {
      // YTD
      fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    }

    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    startTransition(() => {
      router.push(`/reports?from=${fromStr}&to=${toStr}`);
    });
  };

  // Filter & sort leaderboard rows
  const filteredRows = useMemo(() => {
    let rows = [...data.sales.rows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.employee.toLowerCase().includes(q) ||
          r.employee_code.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
    });

    return rows;
  }, [data.sales.rows, searchQuery, sortBy, sortAsc]);

  // Top 3 Podium Winners
  const topPerformer = data.sales.rows[0];
  const secondPerformer = data.sales.rows[1];
  const thirdPerformer = data.sales.rows[2];

  const handleSortChange = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  const handleDealSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDealPending(true);
    setDealMsg(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await createDeal(fd);
      if (res?.error) {
        setDealMsg({ error: res.error });
      } else {
        setDealMsg({ success: true });
        setTimeout(() => {
          setShowDealModal(false);
          setDealMsg(null);
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setDealMsg({ error: err?.message || "Failed to record deal." });
    } finally {
      setDealPending(false);
    }
  };

  const exportUrl = `/api/reports/export?from=${data.filters.from}&to=${data.filters.to}`;

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 border border-teal-200">
                <Icon name="activity" size={13} className="text-teal-600" />
                Zoho CRM Analytics Engine
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">Live Workspace Benchmarking</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
              Sales & Employee Performance
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
              Track sales quota attainment, revenue closed, active pipeline, field client visits, and individual sales rep rankings.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowDealModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 active:scale-95"
            >
              <Icon name="plus" size={15} />
              <span>Record Deal</span>
            </button>
            <a
              href={exportUrl}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              <Icon name="download" size={15} className="text-slate-500" />
              <span>Export CSV</span>
            </a>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              title="Print report"
            >
              <Icon name="printer" size={15} className="text-slate-500" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar (Zoho CRM standard preset pills) */}
        <div className="mt-6 border-t border-slate-100 pt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1.5">
              Period:
            </span>
            <button
              type="button"
              onClick={() => handlePreset("today")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset("week")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handlePreset("month")}
              className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900 shadow-xs transition"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePreset("last30")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset("quarter")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
            >
              This Quarter
            </button>
            <button
              type="button"
              onClick={() => handlePreset("ytd")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
            >
              YTD
            </button>
          </div>

          {/* Custom Date Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const fromVal = fd.get("from") as string;
              const toVal = fd.get("to") as string;
              startTransition(() => {
                router.push(`/reports?from=${fromVal}&to=${toVal}`);
              });
            }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1">
              <span className="text-[11px] font-semibold text-slate-500">From</span>
              <input
                name="from"
                type="date"
                defaultValue={data.filters.from}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1">
              <span className="text-[11px] font-semibold text-slate-500">To</span>
              <input
                name="to"
                type="date"
                defaultValue={data.filters.to}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-[var(--navy)] px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? "…" : "Apply"}
            </button>
          </form>
        </div>
      </div>

      {/* Zoho CRM Executive KPI Cards Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Won Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Won Revenue</p>
              <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">
                {money(data.kpis.wonRevenue)}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <Icon name="badge-dollar-sign" size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{data.kpis.wonDeals} deals closed won</span>
            <span className="font-bold text-teal-700">
              Avg {money(data.kpis.averageDealSize)}
            </span>
          </div>
        </div>

        {/* Team Quota Attainment */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quota Attainment</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="text-2xl font-black tracking-tight text-slate-950">
                  {pct(data.kpis.teamAchievementRate)}
                </p>
                <span className="text-xs font-semibold text-slate-500">
                  of {money(data.kpis.teamQuotaTarget)}
                </span>
              </div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon name="target" size={20} />
            </div>
          </div>
          {/* Visual Progress Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.kpis.teamAchievementRate >= 100
                    ? "bg-emerald-500"
                    : data.kpis.teamAchievementRate >= 70
                    ? "bg-teal-500"
                    : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(5, data.kpis.teamAchievementRate))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Open Pipeline Value */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Pipeline</p>
              <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">
                {money(data.kpis.openPipeline)}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
              <Icon name="funnel" size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{data.kpis.openDeals} open opportunities</span>
            <span className="font-bold text-indigo-700">{pct(data.kpis.winRate)} Win Rate</span>
          </div>
        </div>

        {/* Field Customer Visits */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Field Visits</p>
              <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">
                {data.kpis.completedVisits}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <Icon name="map-pin-check" size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-bold">
              ✓ {pct(data.kpis.geofenceComplianceRate)} GPS Verified
            </span>
            <span className="text-slate-500">{data.kpis.totalDistanceKm.toFixed(1)} km</span>
          </div>
        </div>
      </section>

      {/* Navigation Tabs (Zoho CRM layout) */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "leaderboard"
              ? "border-teal-600 text-teal-900 bg-teal-50/50 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="trophy" size={16} className={activeTab === "leaderboard" ? "text-teal-600" : "text-slate-400"} />
          <span>Employee Performance Leaderboard</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {data.sales.rows.length} Reps
          </span>
        </button>

        <button
          onClick={() => setActiveTab("funnel")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "funnel"
              ? "border-teal-600 text-teal-900 bg-teal-50/50 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="filter" size={16} className={activeTab === "funnel" ? "text-teal-600" : "text-slate-400"} />
          <span>Pipeline & Funnel Stages</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {data.funnel.length} Stages
          </span>
        </button>

        <button
          onClick={() => setActiveTab("field")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "field"
              ? "border-teal-600 text-teal-900 bg-teal-50/50 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="map-pin" size={16} className={activeTab === "field" ? "text-teal-600" : "text-slate-400"} />
          <span>Field & Customer Visits</span>
        </button>

        {data.finance && (
          <button
            onClick={() => setActiveTab("finance")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "finance"
                ? "border-teal-600 text-teal-900 bg-teal-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name="receipt" size={16} className={activeTab === "finance" ? "text-teal-600" : "text-slate-400"} />
            <span>Finance & Audit Snapshot</span>
          </button>
        )}
      </div>

      {/* TAB 1: EMPLOYEE PERFORMANCE LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div className="space-y-6">
          {/* Top 3 Podium Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Rank 1 (Gold) */}
            {topPerformer && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50/80 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-black text-amber-900">
                    🥇 #1 Top Performer
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">{topPerformer.employee_code}</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-950 truncate">{topPerformer.employee}</h3>
                <p className="text-xs text-slate-500">{topPerformer.designation}</p>
                <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Won Revenue</span>
                    <p className="text-lg font-black text-amber-950">{money(topPerformer.won_revenue)}</p>
                  </div>
                  <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">
                    {pct(topPerformer.achievement_rate)} Quota
                  </span>
                </div>
              </div>
            )}

            {/* Rank 2 (Silver) */}
            {secondPerformer && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-gradient-to-b from-slate-100/70 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-black text-slate-800">
                    🥈 #2 Runner Up
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">{secondPerformer.employee_code}</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-950 truncate">{secondPerformer.employee}</h3>
                <p className="text-xs text-slate-500">{secondPerformer.designation}</p>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Won Revenue</span>
                    <p className="text-lg font-black text-slate-900">{money(secondPerformer.won_revenue)}</p>
                  </div>
                  <span className="rounded-lg bg-teal-100 px-2 py-1 text-xs font-black text-teal-800">
                    {pct(secondPerformer.achievement_rate)} Quota
                  </span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {thirdPerformer && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-700/30 bg-gradient-to-b from-amber-50/40 to-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
                    🥉 #3 Contender
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">{thirdPerformer.employee_code}</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-950 truncate">{thirdPerformer.employee}</h3>
                <p className="text-xs text-slate-500">{thirdPerformer.designation}</p>
                <div className="mt-4 pt-3 border-t border-amber-200/50 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Won Revenue</span>
                    <p className="text-lg font-black text-slate-900">{money(thirdPerformer.won_revenue)}</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                    {pct(thirdPerformer.achievement_rate)} Quota
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard Table Surface */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Search and Filters Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sales rep, EMP code..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 pl-9 text-xs text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Icon name="search" size={14} />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Showing <strong>{filteredRows.length}</strong> sales reps</span>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3.5 text-center">Rank</th>
                    <th className="px-4 py-3.5">Sales Representative</th>
                    <th
                      onClick={() => handleSortChange("won_revenue")}
                      className="px-4 py-3.5 cursor-pointer hover:text-teal-700 transition"
                    >
                      Won Revenue {sortBy === "won_revenue" && (sortAsc ? "↑" : "↓")}
                    </th>
                    <th
                      onClick={() => handleSortChange("achievement_rate")}
                      className="px-4 py-3.5 cursor-pointer hover:text-teal-700 transition"
                    >
                      Quota Attainment {sortBy === "achievement_rate" && (sortAsc ? "↑" : "↓")}
                    </th>
                    <th
                      onClick={() => handleSortChange("deals")}
                      className="px-4 py-3.5 text-center cursor-pointer hover:text-teal-700 transition"
                    >
                      Deals {sortBy === "deals" && (sortAsc ? "↑" : "↓")}
                    </th>
                    <th className="px-4 py-3.5">Open Pipeline</th>
                    <th
                      onClick={() => handleSortChange("visits")}
                      className="px-4 py-3.5 text-center cursor-pointer hover:text-teal-700 transition"
                    >
                      Visits {sortBy === "visits" && (sortAsc ? "↑" : "↓")}
                    </th>
                    <th
                      onClick={() => handleSortChange("conversion_rate")}
                      className="px-4 py-3.5 text-center cursor-pointer hover:text-teal-700 transition"
                    >
                      Win Rate {sortBy === "conversion_rate" && (sortAsc ? "↑" : "↓")}
                    </th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={row.employee_id} className="hover:bg-slate-50/70 transition">
                      {/* Rank Column */}
                      <td className="px-4 py-3.5 text-center font-bold">
                        {row.rank === 1 ? (
                          <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-800 text-xs">
                            🥇
                          </span>
                        ) : row.rank === 2 ? (
                          <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-slate-800 text-xs">
                            🥈
                          </span>
                        ) : row.rank === 3 ? (
                          <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-xs">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">#{row.rank}</span>
                        )}
                      </td>

                      {/* Rep Details */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--navy)] text-white text-xs font-bold">
                            {row.employee.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{row.employee}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                {row.employee_code}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">{row.designation}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Won Revenue */}
                      <td className="px-4 py-3.5 font-bold text-slate-950">
                        {money(row.won_revenue)}
                      </td>

                      {/* Quota Progress Bar (Zoho CRM style) */}
                      <td className="px-4 py-3.5 min-w-[150px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-800">{pct(row.achievement_rate)}</span>
                            <span className="text-slate-400">of {money(row.quota_target)}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.achievement_rate >= 100
                                  ? "bg-emerald-500"
                                  : row.achievement_rate >= 70
                                  ? "bg-teal-500"
                                  : "bg-amber-400"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(4, row.achievement_rate))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Won Deals */}
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700">
                        {row.deals}
                      </td>

                      {/* Open Pipeline */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-700">{money(row.open_pipeline)}</span>
                        {row.open_deals > 0 && (
                          <span className="ml-1 text-[10px] text-slate-400">({row.open_deals})</span>
                        )}
                      </td>

                      {/* Visits */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold text-slate-700">{row.visits}</span>
                        {row.geofence_verified_visits > 0 && (
                          <span className="ml-1 text-[10px] font-bold text-emerald-600" title="GPS verified">
                            ✓{row.geofence_verified_visits}
                          </span>
                        )}
                      </td>

                      {/* Conversion */}
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700">
                        {pct(row.conversion_rate)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            row.status_label === "Top Performer"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.status_label === "On Track"
                              ? "bg-teal-100 text-teal-800"
                              : row.status_label === "Consistent"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.status_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <div key={row.employee_id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--navy)] text-white text-xs font-bold">
                        {row.employee.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-teal-700">#{row.rank}</span>
                          <h4 className="font-bold text-slate-900 text-sm">{row.employee}</h4>
                        </div>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                          {row.employee_code}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        row.status_label === "Top Performer"
                          ? "bg-emerald-100 text-emerald-800"
                          : row.status_label === "On Track"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.status_label}
                    </span>
                  </div>

                  {/* Quota Progress */}
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{money(row.won_revenue)} won</span>
                      <span className="font-bold text-teal-700">{pct(row.achievement_rate)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${Math.min(100, Math.max(5, row.achievement_rate))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Quota: {money(row.quota_target)}</span>
                      <span>{row.deals} won deals</span>
                    </div>
                  </div>

                  {/* Operational Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-slate-100 p-2">
                      <span className="text-[10px] text-slate-400 block">Pipeline</span>
                      <span className="font-bold text-slate-800">{money(row.open_pipeline)}</span>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2">
                      <span className="text-[10px] text-slate-400 block">Visits</span>
                      <span className="font-bold text-slate-800">{row.visits}</span>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2">
                      <span className="text-[10px] text-slate-400 block">Win Rate</span>
                      <span className="font-bold text-slate-800">{pct(row.conversion_rate)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PIPELINE & FUNNEL */}
      {activeTab === "funnel" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Zoho CRM Pipeline Funnel</h2>
              <p className="mt-1 text-xs text-slate-500">Stage-by-stage deal volume and accumulated value.</p>
            </div>

            <div className="space-y-4 pt-2">
              {data.funnel.map((row) => {
                const maxLeads = Math.max(...data.funnel.map((x) => x.leads), 1);
                const widthPct = Math.max(8, (row.leads / maxLeads) * 100);

                return (
                  <div key={row.stage} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          #{row.position + 1}
                        </span>
                        <span className="font-bold text-slate-800">{row.stage}</span>
                      </div>
                      <span className="font-semibold text-slate-600">
                        {row.leads} leads · {money(row.value)}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-950">Funnel Conversion Insights</h2>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <span className="font-bold text-slate-800 block">Total Pipeline Value</span>
                <span className="text-xl font-black text-teal-800 mt-1 block">
                  {money(data.funnel.reduce((s, r) => s + r.value, 0))}
                </span>
                <span className="text-[11px] text-slate-500">
                  Aggregated across {data.kpis.totalLeads} opportunities.
                </span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <span className="font-bold text-slate-800 block">Overall Deal Win Rate</span>
                <span className="text-xl font-black text-emerald-800 mt-1 block">
                  {pct(data.kpis.winRate)}
                </span>
                <span className="text-[11px] text-slate-500">
                  Ratio of Won deals to Total resolved opportunities.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FIELD & VISITS */}
      {activeTab === "field" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Total Visits</span>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.field.visits}</p>
              <span className="text-[11px] text-slate-400">Scheduled client visits</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Completed On-Site</span>
              <p className="mt-1 text-2xl font-black text-emerald-700">{data.field.completed}</p>
              <span className="text-[11px] text-emerald-600">Successfully concluded</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Geofence GPS Verified</span>
              <p className="mt-1 text-2xl font-black text-teal-700">{data.field.geofence_verified}</p>
              <span className="text-[11px] text-teal-600">Radius check-in confirmed</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Travel Distance</span>
              <p className="mt-1 text-2xl font-black text-slate-950">{data.field.distance_km.toFixed(1)} km</p>
              <span className="text-[11px] text-slate-400">{data.field.trips} verified trips</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Field Operations Benchmark</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High GPS geofence compliance ensures field reps genuinely visit customer premises.
                </p>
              </div>
              <Link
                href="/visits"
                className="rounded-xl bg-[var(--navy)] px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                View Live Field Map →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FINANCE & AUDIT */}
      {activeTab === "finance" && data.finance && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Expenses Submitted</span>
              <p className="mt-1 text-2xl font-black text-slate-950">{money(data.finance.expenses_submitted)}</p>
              <span className="text-[11px] text-slate-400">Total claimed in period</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Expenses Approved</span>
              <p className="mt-1 text-2xl font-black text-emerald-700">{money(data.finance.expenses_approved)}</p>
              <span className="text-[11px] text-emerald-600">Reimbursement approved</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Calculated Commission</span>
              <p className="mt-1 text-2xl font-black text-teal-700">{money(data.finance.commissions)}</p>
              <span className="text-[11px] text-teal-600">Tied to won deals</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs text-slate-500">Payout Disbursements</span>
              <p className="mt-1 text-2xl font-black text-slate-950">{money(data.finance.payouts)}</p>
              <span className="text-[11px] text-slate-400">Total payroll processed</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/expenses"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Review Expense Claims →
            </Link>
            <Link
              href="/commissions"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Commission Ledger →
            </Link>
          </div>
        </div>
      )}

      {/* QUICK DEAL RECORDING MODAL */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Record Sales Deal</h3>
                <p className="text-xs text-slate-500">Add a new deal to update team revenue & rep rankings.</p>
              </div>
              <button
                onClick={() => setShowDealModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDealSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Deal Title</label>
                <input
                  required
                  name="title"
                  placeholder="e.g. Apex POS Enterprise Rollout"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Revenue Amount (₹)</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  name="revenue_amount"
                  placeholder="e.g. 150000"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Deal Owner</label>
                  <select
                    name="owner_employee_id"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-teal-500"
                  >
                    {data.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.employee_code} ({e.full_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Deal Status</label>
                  <select
                    name="status"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-teal-500"
                  >
                    <option value="WON">WON (Closed)</option>
                    <option value="OPEN">OPEN (Pipeline)</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
              </div>

              {dealMsg?.error && (
                <p className="rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                  {dealMsg.error}
                </p>
              )}
              {dealMsg?.success && (
                <p className="rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">
                  ✓ Deal recorded! Updating leaderboard…
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDealModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dealPending}
                  className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {dealPending ? "Recording…" : "Save Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
