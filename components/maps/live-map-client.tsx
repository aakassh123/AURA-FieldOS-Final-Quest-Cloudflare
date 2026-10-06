'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { MapView } from '@/components/maps/map-view';
import type { MapCustomer, MapEmployee } from '@/lib/maps/types';

type Props = {
  initialCustomers: MapCustomer[];
  initialEmployees: MapEmployee[];
  canManage: boolean;
};

export function LiveMapClient({ initialCustomers, initialEmployees, canManage }: Props) {
  const [employees, setEmployees] = useState<MapEmployee[]>(initialEmployees);
  const [customers, setCustomers] = useState<MapCustomer[]>(initialCustomers);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'OFFICE' | 'FIELD' | 'OVERTIME'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string | null>(null);
  const [isRadarActive, setIsRadarActive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [, startTransition] = useTransition();

  // Real-time polling function
  const fetchLatestMapData = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/map/realtime', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          startTransition(() => {
            setEmployees(json.employees ?? []);
            setCustomers(json.customers ?? []);
            setLastUpdated(new Date());
          });
        }
      }
    } catch (err) {
      console.warn('Real-time map refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Setup interval for radar polling every 10 seconds
  useEffect(() => {
    if (!isRadarActive) return;
    const interval = setInterval(fetchLatestMapData, 10000);
    return () => clearInterval(interval);
  }, [isRadarActive]);

  // Counts
  const officeCount = useMemo(() => employees.filter((e) => e.state === 'OFFICE').length, [employees]);
  const overtimeCount = useMemo(() => employees.filter((e) => e.state === 'OVERTIME').length, [employees]);
  const fieldCount = useMemo(() => employees.filter((e) => e.state === 'WORKING' || e.state === 'ON_VISIT').length, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      // Filter by state
      if (selectedFilter === 'OFFICE' && e.state !== 'OFFICE') return false;
      if (selectedFilter === 'OVERTIME' && e.state !== 'OVERTIME') return false;
      if (selectedFilter === 'FIELD' && e.state !== 'WORKING' && e.state !== 'ON_VISIT') return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = e.full_name.toLowerCase().includes(q);
        const matchesCode = (e.employee_code ?? '').toLowerCase().includes(q);
        const matchesRole = e.role.toLowerCase().includes(q);
        const matchesDesig = (e.designation ?? '').toLowerCase().includes(q);
        return matchesName || matchesCode || matchesRole || matchesDesig;
      }
      return true;
    });
  }, [employees, selectedFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Real-time Control & KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tracked</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{employees.length}</span>
            <span className="text-xs font-semibold text-slate-500">active staff</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">🏢 In Office</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">{officeCount}</span>
            <span className="text-xs font-semibold text-emerald-700">real-time office</span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">🚗 Field Active</p>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-950">{fieldCount}</span>
            <span className="text-xs font-semibold text-blue-700">visits & routes</span>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">🌙 Overtime (Extra)</p>
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-950">{overtimeCount}</span>
            <span className="text-xs font-semibold text-purple-700">past 6 PM staff</span>
          </div>
        </div>
      </div>

      {/* Main Map + Directory Grid */}
      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* Map Container */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {/* Radar Header */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className={`relative flex h-3 w-3 ${isRadarActive ? '' : 'opacity-40'}`}>
                {isRadarActive && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-slate-800">
                {isRadarActive ? 'Live Radar Active' : 'Radar Paused'}
              </span>
              <span className="text-[11px] text-slate-400">
                · Synced {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRadarActive((prev) => !prev)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  isRadarActive
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isRadarActive ? 'Pause Radar' : 'Resume Radar'}
              </button>

              <button
                type="button"
                disabled={isRefreshing}
                onClick={fetchLatestMapData}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <span className={`inline-block text-xs ${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
                <span>{isRefreshing ? 'Pinging…' : 'Ping GPS'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="relative">
            <MapView
              customers={customers}
              employees={employees}
              height={620}
              focusedEmployeeId={focusedEmployeeId}
              onSelectEmployee={(emp) => setFocusedEmployeeId(emp.id)}
            />
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 px-2 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-emerald-100" />
              🏢 In Office
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-blue-500 bg-blue-100" />
              🚗 Field Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-purple-500 bg-purple-100" />
              🌙 Overtime (Past 6 PM)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-amber-500 bg-amber-100" />
              📍 On Customer Visit
            </span>
            <span className="ml-auto text-[10px] text-slate-400">
              {customers.length} verified CRM pins
            </span>
          </div>
        </div>

        {/* Sidebar Directory */}
        <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Live Team Directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Real-time workplace view for office & field.</p>
          </div>

          {/* Workplace Filter Tabs */}
          <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`rounded-lg py-1.5 transition ${
                selectedFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({employees.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('OFFICE')}
              className={`rounded-lg py-1.5 transition ${
                selectedFilter === 'OFFICE' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏢 Office ({officeCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('FIELD')}
              className={`rounded-lg py-1.5 transition ${
                selectedFilter === 'FIELD' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚗 Field ({fieldCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('OVERTIME')}
              className={`rounded-lg py-1.5 transition ${
                selectedFilter === 'OVERTIME' ? 'bg-white text-purple-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌙 OT ({overtimeCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee or code…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white"
            />
          </div>

          {/* Employee Cards List */}
          <div className="mt-3 max-h-[500px] flex-1 space-y-2.5 overflow-y-auto pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = focusedEmployeeId === emp.id;
              const isOffice = emp.state === 'OFFICE';
              const isOvertime = emp.state === 'OVERTIME';
              const isOnVisit = emp.state === 'ON_VISIT';

              return (
                <div
                  key={emp.id}
                  onClick={() => setFocusedEmployeeId(emp.id)}
                  className={`group cursor-pointer rounded-xl border p-3 transition ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/30 shadow-sm ring-1 ring-teal-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {emp.avatar_url ? (
                        <img
                          src={emp.avatar_url}
                          alt={emp.full_name}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-700">
                          {emp.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[9px] shadow-sm ${
                          isOffice
                            ? 'bg-emerald-500 text-white'
                            : isOvertime
                            ? 'bg-purple-500 text-white'
                            : isOnVisit
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {isOffice ? '🏢' : isOvertime ? '🌙' : isOnVisit ? '📍' : '🚗'}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-bold text-slate-900 group-hover:text-teal-700">
                          {emp.full_name}
                        </p>
                        {emp.employee_code && (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                            {emp.employee_code}
                          </span>
                        )}
                      </div>

                      <p className="truncate text-[10px] text-slate-500">
                        {emp.designation || emp.role}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            isOffice
                              ? 'bg-emerald-50 text-emerald-700'
                              : isOvertime
                              ? 'bg-purple-50 text-purple-700'
                              : isOnVisit
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {isOffice
                            ? '🏢 In Office'
                            : isOvertime
                            ? '🌙 Overtime Field'
                            : isOnVisit
                            ? '📍 At Customer'
                            : '🚗 Field Active'}
                        </span>

                        <span className="text-[10px] text-slate-400">
                          GPS ±{emp.accuracy_m ? Math.round(emp.accuracy_m) : '15'}m
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <span className="text-slate-400">
                      🕒 {new Date(emp.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedEmployeeId(emp.id);
                      }}
                      className="font-bold text-teal-700 hover:underline"
                    >
                      🎯 Focus on map →
                    </button>
                  </div>
                </div>
              );
            })}

            {!filteredEmployees.length && (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                No employees matching filter.
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
