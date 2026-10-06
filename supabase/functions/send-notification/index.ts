import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRole);

Deno.serve(async req => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record?.user_id) return new Response(JSON.stringify({ skipped: true }), { headers: { 'content-type': 'application/json' } });

    const { data: tokens, error } = await supabase.from('mobile_devices').select('id,expo_push_token').eq('user_id', record.user_id).eq('is_active', true);
    if (error) throw error;
    if (!tokens?.length) return new Response(JSON.stringify({ delivered: 0 }), { headers: { 'content-type': 'application/json' } });

    const messages = tokens.map(token => ({
      to: token.expo_push_token,
      sound: 'default',
      title: record.title ?? 'AURA FieldOS',
      body: record.body ?? 'You have a new update.',
      data: { notificationId: record.id, href: record.href ?? '/' },
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    return new Response(JSON.stringify({ delivered: messages.length, result }), { status: response.ok ? 200 : 502, headers: { 'content-type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Push delivery failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
