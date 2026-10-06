import { createClient } from '@/lib/supabase/server';
export async function getCurrentUserEmail() { const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); return user?.email ?? ''; }
