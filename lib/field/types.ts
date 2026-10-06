export type Attendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: string;
  check_in_at: string;
  check_out_at: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy_m: number | null;
  check_in_note?: string | null;
  check_out_note?: string | null;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
  } | null;
};

export type WorkSession = {
  id: string;
  employee_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  started_at: string;
  ended_at: string | null;
  total_active_seconds: number;
  start_latitude: number | null;
  start_longitude: number | null;
};

export type FieldCustomer = {
  id: string;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
};

export type Visit = {
  id: string;
  customer_id: string;
  lead_id: string | null;
  employee_id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  check_in_distance_m: number | null;
  geofence_verified: boolean;
  outcome: string | null;
  notes: string | null;
  next_follow_up_at: string | null;
  customer?: { name: string } | null;
};
