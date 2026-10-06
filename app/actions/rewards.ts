'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function text(value: FormDataEntryValue | null) { return typeof value === 'string' ? value.trim() : ''; }
function num(value: FormDataEntryValue | null) { const n = Number(value); return Number.isFinite(n) ? n : null; }

async function requireRewardManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: employee } = await supabase.from('employees').select('id,company_id,role,status').eq('user_id', user.id).maybeSingle();
  if (!employee || employee.status !== 'ACTIVE') throw new Error('Active employee profile required');
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'SALES_MANAGER', 'HR_ACCOUNTS'].includes(employee.role)) throw new Error('You are not allowed to manage rewards.');
  return { supabase, employee };
}

export async function createRewardCatalogItem(formData: FormData) {
  try {
    const { supabase, employee } = await requireRewardManager();
    const name = text(formData.get('name'));
    const description = text(formData.get('description'));
    const cost = num(formData.get('cost_inr'));
    const stockRaw = text(formData.get('stock_remaining'));
    const stock = stockRaw ? Number(stockRaw) : null;
    if (name.length < 2) return { error: 'Reward name is required.' };
    if (cost === null || cost < 0) return { error: 'Enter a valid non-negative reward value.' };
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return { error: 'Stock must be a non-negative whole number or blank for unlimited.' };
    const { error } = await supabase.from('reward_catalog').insert({ company_id: employee.company_id, name, description: description || null, cost_inr: cost, stock_remaining: stock, active: true });
    if (error) return { error: error.message };
    revalidatePath('/rewards');
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to create reward.' }; }
}

export async function createRewardRule(formData: FormData) {
  try {
    const { supabase, employee } = await requireRewardManager();
    const name = text(formData.get('name'));
    const triggerType = text(formData.get('trigger_type')) || 'TASK_COMPLETED';
    const taskType = text(formData.get('task_type')) || null;
    const rewardId = text(formData.get('reward_id')) || null;
    const xp = num(formData.get('xp_amount'));
    const priority = num(formData.get('priority')) ?? 100;
    if (name.length < 2) return { error: 'Rule name is required.' };
    if (!['TASK_COMPLETED','VISIT_COMPLETED','DAILY_GOAL','WEEKLY_GOAL','STREAK'].includes(triggerType)) return { error: 'Invalid trigger.' };
    if (taskType && !['GENERAL','CALL','FOLLOW_UP','MEETING','DEMO','PROPOSAL','VISIT','OTHER'].includes(taskType)) return { error: 'Invalid task type.' };
    if (xp === null || xp < 0 || !Number.isInteger(xp)) return { error: 'XP must be a non-negative whole number.' };
    const { error } = await supabase.from('reward_rules').insert({ company_id: employee.company_id, name, trigger_type: triggerType, task_type: taskType, reward_id: rewardId, xp_amount: xp, priority, active: true });
    if (error) return { error: error.message };
    revalidatePath('/rewards');
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to create reward rule.' }; }
}
