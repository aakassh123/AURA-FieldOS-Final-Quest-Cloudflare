import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MapCustomer, MapEmployee, Trip, MapEmployeeState } from './types';

export async function getMapData() {
  let supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    try {
      supabase = createAdminClient() as any;
    } catch {
      // fallback
    }
  }
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());

  const [{ data: customers }, { data: employees }, { data: visits }, { data: todayAttendance }] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,city,latitude,longitude,geofence_radius_m')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('name'),
    supabase
      .from('employees')
      .select('id,user_id,full_name,employee_code,designation,phone,role')
      .eq('status', 'ACTIVE')
      .order('full_name'),
    supabase
      .from('customer_visits')
      .select('employee_id,status')
      .eq('status', 'STARTED'),
    supabase
      .from('attendance')
      .select('id,employee_id,attendance_date,status,check_in_at,check_out_at,check_in_latitude,check_in_longitude,check_in_accuracy_m,check_in_note,check_out_note')
      .eq('attendance_date', today),
  ]);

  const activeEmployees = employees ?? [];
  const ids = activeEmployees.map((e) => e.id);

  if (!ids.length) {
    return {
      customers: (customers ?? []) as MapCustomer[],
      employees: [] as MapEmployee[],
    };
  }

  // Get latest live location points from work sessions
  const { data: points } = await supabase
    .from('work_session_location_points')
    .select('employee_id,latitude,longitude,accuracy_m,recorded_at')
    .in('employee_id', ids)
    .order('recorded_at', { ascending: false });

  const latestPoints = new Map<string, any>();
  for (const p of points ?? []) {
    if (!latestPoints.has(p.employee_id)) latestPoints.set(p.employee_id, p);
  }

  // Map today's attendance by employee_id
  const attendanceMap = new Map<string, any>();
  for (const att of todayAttendance ?? []) {
    attendanceMap.set(att.employee_id, att);
  }

  // Map active customer visits
  const onVisit = new Set((visits ?? []).map((v) => v.employee_id));

  // Get user avatar URLs from auth metadata
  const avatarMap = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 100 });
    for (const u of usersData?.users ?? []) {
      if (u.user_metadata?.avatar_url) {
        avatarMap.set(u.id, u.user_metadata.avatar_url);
      }
    }
  } catch (err) {
    console.warn('Could not load user avatars for map:', err);
  }

  const mapEmployees: MapEmployee[] = [];

  for (const emp of activeEmployees) {
    const point = latestPoints.get(emp.id);
    const att = attendanceMap.get(emp.id);

    // Coordinate determination: work session point OR today's attendance check-in
    let lat: number | null = point ? point.latitude : (att?.check_in_latitude ?? null);
    let lng: number | null = point ? point.longitude : (att?.check_in_longitude ?? null);
    let accuracy: number | null = point ? point.accuracy_m : (att?.check_in_accuracy_m ?? null);
    let recordedAt: string = point ? point.recorded_at : (att?.check_in_at ?? new Date().toISOString());

    // If an employee doesn't have any coordinates yet, skip placing marker
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      continue;
    }

    // Determine state
    let state: MapEmployeeState = 'WORKING';
    let workMode: 'OFFICE' | 'FIELD' | 'OVERTIME' = 'FIELD';

    const checkInNote = String(att?.check_in_note ?? '').toUpperCase();
    const checkOutNote = String(att?.check_out_note ?? '').toUpperCase();

    if (onVisit.has(emp.id)) {
      state = 'ON_VISIT';
      workMode = 'FIELD';
    } else if (checkInNote.includes('OVERTIME') || checkOutNote.includes('OVERTIME')) {
      state = 'OVERTIME';
      workMode = 'OVERTIME';
    } else if (checkInNote.includes('OFFICE')) {
      state = 'OFFICE';
      workMode = 'OFFICE';
    } else {
      state = 'WORKING';
      workMode = 'FIELD';
    }

    mapEmployees.push({
      id: emp.id,
      full_name: emp.full_name,
      role: emp.role,
      employee_code: emp.employee_code,
      designation: emp.designation,
      phone: emp.phone,
      avatar_url: emp.user_id ? avatarMap.get(emp.user_id) ?? null : null,
      latitude: lat,
      longitude: lng,
      accuracy_m: accuracy,
      recorded_at: recordedAt,
      state,
      work_mode: workMode,
      is_checked_in: Boolean(att?.check_in_at && !att?.check_out_at),
      check_in_time: att?.check_in_at ?? null,
      check_in_note: att?.check_in_note ?? null,
    });
  }

  return {
    customers: (customers ?? []) as MapCustomer[],
    employees: mapEmployees,
  };
}

export async function getTrips() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .select('id,employee_id,status,started_at,ended_at,distance_m,purpose,notes,employee:employees(full_name)')
    .order('started_at', { ascending: false })
    .limit(100);
  if (error) console.warn('Trips query notice:', error.message);
  return (data ?? []) as unknown as Trip[];
}
