export type Profile = { id: string; company_id: string | null; full_name: string | null; role: string };
export type Employee = { id: string; company_id: string; user_id: string | null; full_name: string; role: string; status: string };
export type WorkSession = { id: string; employee_id: string; status: string; started_at: string; ended_at: string | null };
export type Visit = { id: string; customer_id: string; status: string; scheduled_at: string | null; customer?: { name: string } | null; };
export type Task = { id: string; title: string; due_at: string | null; priority: string; status: string; };
