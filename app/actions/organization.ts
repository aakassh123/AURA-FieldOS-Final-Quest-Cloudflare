"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { APP_ROLES, type AppRole } from "@/lib/auth/types";

const MANAGEABLE_ROLES: AppRole[] = [...APP_ROLES];

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: FormDataEntryValue | null) {
  const valueText = text(value);
  return valueText || null;
}

function isRole(value: string): value is AppRole {
  return MANAGEABLE_ROLES.includes(value as AppRole);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  return { supabase, user };
}

export async function bootstrapCompany(formData: FormData) {
  const { supabase } = await requireUser();
  const name = text(formData.get("name"));
  const slug = text(formData.get("slug")).toLowerCase();

  if (name.length < 2) return { error: "Company name must be at least 2 characters." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Use a lowercase slug such as aura-sales." };
  }

  const { error } = await supabase.rpc("bootstrap_company", {
    p_name: name,
    p_slug: slug,
  });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath("/teams");
  return { success: true };
}

export async function createEmployee(formData: FormData) {
  const { supabase } = await requireUser();
  const company = await supabase.from("companies").select("id").maybeSingle();
  if (company.error || !company.data) return { error: "Company setup is incomplete." };

  const fullName = text(formData.get("full_name"));
  const employeeCode = text(formData.get("employee_code")).toUpperCase();
  const role = text(formData.get("role"));
  const managerId = nullableText(formData.get("manager_id"));

  if (fullName.length < 2) return { error: "Full name is required." };
  if (!employeeCode) return { error: "Employee code is required." };
  if (!isRole(role)) return { error: "Invalid employee role." };

  const { error } = await supabase.from("employees").insert({
    company_id: company.data.id,
    employee_code: employeeCode,
    full_name: fullName,
    email: nullableText(formData.get("email")),
    phone: nullableText(formData.get("phone")),
    designation: nullableText(formData.get("designation")),
    role,
    manager_id: managerId,
    status: text(formData.get("status")) || "INVITED",
    joined_at: nullableText(formData.get("joined_at")),
  });

  if (error) return { error: error.message };

  revalidatePath("/employees");
  revalidatePath("/teams");
  return { success: true };
}

export async function updateEmployee(formData: FormData) {
  const { supabase } = await requireUser();
  const id = text(formData.get("id"));
  const fullName = text(formData.get("full_name"));
  const role = text(formData.get("role"));
  const status = text(formData.get("status"));
  const managerId = nullableText(formData.get("manager_id"));

  if (!id || fullName.length < 2 || !isRole(role)) return { error: "Please provide valid employee details." };
  if (!["INVITED", "ACTIVE", "INACTIVE"].includes(status)) return { error: "Invalid employee status." };

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      email: nullableText(formData.get("email")),
      phone: nullableText(formData.get("phone")),
      designation: nullableText(formData.get("designation")),
      role,
      manager_id: managerId,
      status,
      joined_at: nullableText(formData.get("joined_at")),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/employees");
  revalidatePath("/teams");
  return { success: true };
}

export async function deleteEmployee(formData: FormData) {
  const { supabase } = await requireUser();
  const id = text(formData.get("id"));
  if (!id) return { error: "Employee id is required." };

  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/employees");
  revalidatePath("/teams");
  return { success: true };
}

export async function createTeam(formData: FormData) {
  const { supabase } = await requireUser();
  const company = await supabase.from("companies").select("id").maybeSingle();
  if (company.error || !company.data) return { error: "Company setup is incomplete." };

  const name = text(formData.get("name"));
  if (name.length < 2) return { error: "Team name is required." };

  const { error } = await supabase.from("teams").insert({
    company_id: company.data.id,
    name,
    description: nullableText(formData.get("description")),
    manager_employee_id: nullableText(formData.get("manager_employee_id")),
  });

  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { success: true };
}

export async function updateTeam(formData: FormData) {
  const { supabase } = await requireUser();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!id || name.length < 2) return { error: "Valid team details are required." };

  const { error } = await supabase
    .from("teams")
    .update({
      name,
      description: nullableText(formData.get("description")),
      manager_employee_id: nullableText(formData.get("manager_employee_id")),
      is_active: text(formData.get("is_active")) === "true",
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { success: true };
}

export async function deleteTeam(formData: FormData) {
  const { supabase } = await requireUser();
  const id = text(formData.get("id"));
  if (!id) return { error: "Team id is required." };

  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { success: true };
}

export async function addTeamMember(formData: FormData) {
  const { supabase } = await requireUser();
  const teamId = text(formData.get("team_id"));
  const employeeId = text(formData.get("employee_id"));

  if (!teamId || !employeeId) return { error: "Team and employee are required." };

  const company = await supabase.from("companies").select("id").maybeSingle();
  if (company.error || !company.data) return { error: "Company setup is incomplete." };

  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    employee_id: employeeId,
    company_id: company.data.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { success: true };
}

export async function removeTeamMember(formData: FormData) {
  const { supabase } = await requireUser();
  const teamId = text(formData.get("team_id"));
  const employeeId = text(formData.get("employee_id"));
  if (!teamId || !employeeId) return { error: "Team and employee are required." };

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("employee_id", employeeId);

  if (error) return { error: error.message };
  revalidatePath("/teams");
  return { success: true };
}

// CRM actions live here for now to keep Stage 4 mutations behind the same server boundary.
export async function createLead(formData: FormData) {
  const { supabase } = await requireUser();
  const company = await supabase.from('companies').select('id').maybeSingle();
  if (company.error || !company.data) return { error: 'Company setup is incomplete.' };
  const title = text(formData.get('title'));
  const stageId = text(formData.get('stage_id'));
  const ownerId = nullableText(formData.get('owner_employee_id'));
  const customerId = nullableText(formData.get('customer_id'));
  const priority = text(formData.get('priority')) || 'MEDIUM';
  const value = Number(formData.get('estimated_value') || 0);
  if (title.length < 2 || !stageId) return { error: 'Lead title and stage are required.' };
  if (!Number.isFinite(value) || value < 0) return { error: 'Estimated value must be a valid amount.' };
  const { error } = await supabase.from('leads').insert({ company_id: company.data.id, title, stage_id: stageId, owner_employee_id: ownerId, customer_id: customerId, source: nullableText(formData.get('source')), priority, estimated_value: value, expected_close_date: nullableText(formData.get('expected_close_date')), next_follow_up_at: nullableText(formData.get('next_follow_up_at')), notes: nullableText(formData.get('notes')) });
  if (error) return { error: error.message };
  revalidatePath('/leads'); revalidatePath('/');
  return { success: true };
}

export async function updateLeadStage(formData: FormData) {
  const { supabase } = await requireUser();
  const id = text(formData.get('id')); const stageId = text(formData.get('stage_id'));
  if (!id || !stageId) return { error: 'Lead and stage are required.' };
  const { error } = await supabase.from('leads').update({ stage_id: stageId }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/leads'); revalidatePath(`/leads/${id}`);
  return { success: true };
}

export async function addLeadActivity(formData: FormData) {
  const { supabase, user } = await requireUser();
  const leadId = text(formData.get('lead_id')); const body = text(formData.get('body')); const type = text(formData.get('type')) || 'NOTE';
  if (!leadId || !body) return { error: 'Activity note is required.' };
  const employee = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
  if (employee.error || !employee.data) return { error: 'Your account is not linked to an employee profile.' };
  const { error } = await supabase.from('lead_activities').insert({ company_id: (await supabase.from('companies').select('id').maybeSingle()).data?.id, lead_id: leadId, employee_id: employee.data.id, type, body });
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`); revalidatePath('/leads');
  return { success: true };
}

export async function createCustomer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const company = await supabase.from('companies').select('id').maybeSingle();
  if (company.error || !company.data) return { error: 'Company setup is incomplete.' };
  const name = text(formData.get('name'));
  if (name.length < 2) return { error: 'Customer name is required.' };
  const employee = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
  const ownerId = nullableText(formData.get('owner_employee_id')) ?? employee.data?.id ?? null;
  const { error } = await supabase.from('customers').insert({ company_id: company.data.id, name, phone: nullableText(formData.get('phone')), email: nullableText(formData.get('email')), city: nullableText(formData.get('city')), industry: nullableText(formData.get('industry')), address: nullableText(formData.get('address')), notes: nullableText(formData.get('notes')), owner_employee_id: ownerId });
  if (error) return { error: error.message };
  revalidatePath('/customers'); revalidatePath('/leads');
  return { success: true };
}

export async function createTask(formData: FormData) {
  const { supabase, user } = await requireUser();
  const company = await supabase.from('companies').select('id').maybeSingle();
  const employee = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
  if (company.error || !company.data || employee.error || !employee.data) return { error: 'Company or employee setup is incomplete.' };
  const title = text(formData.get('title')); if (title.length < 2) return { error: 'Task title is required.' };
  const assigned = nullableText(formData.get('assigned_employee_id')) ?? employee.data.id;
  const { error } = await supabase.from('tasks').insert({ company_id: company.data.id, title, description: nullableText(formData.get('description')), lead_id: nullableText(formData.get('lead_id')), customer_id: nullableText(formData.get('customer_id')), assigned_employee_id: assigned, created_by_employee_id: employee.data.id, due_at: nullableText(formData.get('due_at')), priority: text(formData.get('priority')) || 'MEDIUM', task_type: text(formData.get('task_type')) || 'GENERAL' });
  if (error) return { error: error.message };
  revalidatePath('/'); revalidatePath('/leads'); revalidatePath(`/leads/${text(formData.get('lead_id'))}`);
  return { success: true };
}

export async function completeTask(formData: FormData) {
  try {
    const { supabase } = await requireUser();
    const id = text(formData.get('id'));
    if (!id) return { error: 'Task id is required.' };
    const { data, error } = await supabase.rpc('complete_task_with_rewards', { p_task_id: id });
    if (error) return { error: error.message };
    revalidatePath('/'); revalidatePath('/field'); revalidatePath('/leads'); revalidatePath('/rewards');
    return { success: true, ...(data ?? {}) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to complete task.' };
  }
}


export async function updateCustomerLocation(formData: FormData) {
  const { supabase } = await requireUser();
  const id = text(formData.get("id"));
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return { error: "Valid customer location is required." };
  const { error } = await supabase.from("customers").update({ latitude, longitude }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers"); revalidatePath("/visits"); revalidatePath("/field");
  return { success: true };
}
