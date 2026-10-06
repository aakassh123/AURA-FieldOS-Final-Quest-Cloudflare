export type MapEmployeeState = 'ON_VISIT' | 'WORKING' | 'OFFICE' | 'OVERTIME';

export type MapEmployee = {
  id: string;
  full_name: string;
  role: string;
  employee_code?: string | null;
  avatar_url?: string | null;
  designation?: string | null;
  phone?: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  recorded_at: string;
  state: MapEmployeeState;
  work_mode?: 'OFFICE' | 'FIELD' | 'OVERTIME';
  is_checked_in?: boolean;
  check_in_time?: string | null;
  check_in_note?: string | null;
  battery_level?: number | null;
};

export type MapCustomer = {
  id: string;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  geofence_radius_m: number;
};

export type Trip = {
  id: string;
  employee_id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  started_at: string;
  ended_at: string | null;
  distance_m: number;
  purpose: string | null;
  notes: string | null;
  employee?: { full_name: string } | null;
};
