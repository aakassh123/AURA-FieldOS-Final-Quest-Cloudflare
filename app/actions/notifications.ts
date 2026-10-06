'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  return { supabase, user };
}

export async function markNotificationRead(formData: FormData) {
  try {
    const { supabase, user } = await requireUser();
    const id = text(formData.get('notification_id'));
    if (!id) return { error: 'Notification is required.' };
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if (error) return { error: error.message };
    revalidatePath('/notifications');
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to mark notification as read.' };
  }
}

export async function markAllNotificationsRead() {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    if (error) return { error: error.message };
    revalidatePath('/notifications');
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to mark notifications as read.' };
  }
}
