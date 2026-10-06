export type PipelineStage = { id: string; name: string; position: number; color: string; is_closed: boolean };
export type Customer = { id: string; name: string; phone: string | null; email: string | null; city: string | null; industry: string | null; owner_employee_id: string | null; latitude?: number | null; longitude?: number | null; geofence_radius_m?: number };
export type Contact = { id: string; customer_id: string; full_name: string; designation: string | null; phone: string | null; email: string | null; is_primary: boolean };
export type Lead = {
  id: string; title: string; customer_id: string | null; contact_id: string | null; stage_id: string; owner_employee_id: string | null;
  source: string | null; priority: 'LOW'|'MEDIUM'|'HIGH'; status: 'OPEN'|'WON'|'LOST'; estimated_value: number;
  expected_close_date: string | null; next_follow_up_at: string | null; notes: string | null; created_at: string;
  stage?: PipelineStage; owner?: { full_name: string } | null; customer?: { name: string } | null;
};
export type Activity = { id: string; type: string; body: string; created_at: string; employee?: { full_name: string } | null };
export type CrmData = { stages: PipelineStage[]; leads: Lead[]; customers: Customer[]; employees: {id:string;full_name:string;role:string;status:string}[]; };
