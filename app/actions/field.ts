'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function text(value: FormDataEntryValue | null) { return typeof value === 'string' ? value.trim() : ''; }
function num(value: FormDataEntryValue | null) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function nullableText(value: FormDataEntryValue | null) { const v = text(value); return v || null; }

async function requireEmployee() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: employee, error } = await supabase.from('employees').select('id,company_id,full_name,role,status').eq('user_id', user.id).maybeSingle();
  if (error || !employee) throw new Error('Your account is not linked to an employee profile.');
  if (employee.status !== 'ACTIVE') {
    await supabase.from('employees').update({ status: 'ACTIVE' }).eq('id', employee.id);
    employee.status = 'ACTIVE';
  }
  return { supabase, user, employee };
}

export async function checkIn(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude')); const accuracy = num(formData.get('accuracy'));
    if (latitude === null || longitude === null) return { error: 'Location is required for attendance check-in.' };
    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());
    const { data: existing } = await supabase.from('attendance').select('id,check_in_at,check_out_at').eq('employee_id', employee.id).eq('attendance_date', today).maybeSingle();
    if (existing?.check_in_at && !existing.check_out_at) return { error: 'You are already checked in today.' };
    const { error } = await supabase.from('attendance').upsert({ company_id: employee.company_id, employee_id: employee.id, attendance_date: today, status: 'PRESENT', check_in_at: new Date().toISOString(), check_in_latitude: latitude, check_in_longitude: longitude, check_in_accuracy_m: accuracy }, { onConflict: 'employee_id,attendance_date' });
    if (error) return { error: error.message };
    revalidatePath('/field'); revalidatePath('/attendance'); revalidatePath('/');
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to check in.' }; }
}

export async function checkOut(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude')); const accuracy = num(formData.get('accuracy'));
    if (latitude === null || longitude === null) return { error: 'Location is required for attendance check-out.' };
    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());
    const { data: attendance } = await supabase.from('attendance').select('id,check_in_at,check_out_at').eq('employee_id', employee.id).eq('attendance_date', today).maybeSingle();
    if (!attendance?.check_in_at) return { error: 'Check in before checking out.' };
    if (attendance.check_out_at) return { error: 'You are already checked out today.' };
    const { error } = await supabase.from('attendance').update({ check_out_at: new Date().toISOString(), check_out_latitude: latitude, check_out_longitude: longitude, check_out_accuracy_m: accuracy }).eq('id', attendance.id);
    if (error) return { error: error.message };
    const { data: active } = await supabase.from('work_sessions').select('id').eq('employee_id', employee.id).eq('status','ACTIVE').maybeSingle();
    if (active) await endWorkSessionInternal(supabase, employee.id, active.id, latitude, longitude);
    revalidatePath('/field'); revalidatePath('/attendance'); revalidatePath('/');
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to check out.' }; }
}

async function endWorkSessionInternal(supabase: Awaited<ReturnType<typeof createClient>>, employeeId: string, id: string, latitude: number | null, longitude: number | null) {
  const { data: session } = await supabase.from('work_sessions').select('started_at,total_active_seconds,status').eq('id', id).eq('employee_id', employeeId).maybeSingle();
  if (!session || session.status !== 'ACTIVE') return;
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000));
  await supabase.from('work_sessions').update({ status:'ENDED', ended_at:new Date().toISOString(), total_active_seconds: session.total_active_seconds + elapsed, end_latitude: latitude, end_longitude: longitude }).eq('id',id);
}

export async function startWorkSession(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude'));
    if (latitude === null || longitude === null) return { error: 'Location is required to start a work session.' };
    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());
    const { data: attendance } = await supabase.from('attendance').select('id,check_in_at,check_out_at').eq('employee_id', employee.id).eq('attendance_date', today).maybeSingle();
    if (!attendance?.check_in_at || attendance.check_out_at) return { error: 'Check in first, then start your work session.' };
    const { data: active } = await supabase.from('work_sessions').select('id').eq('employee_id', employee.id).eq('status','ACTIVE').maybeSingle();
    if (active) return { error: 'A work session is already active.' };
    const { error } = await supabase.from('work_sessions').insert({ company_id: employee.company_id, employee_id: employee.id, attendance_id: attendance.id, status:'ACTIVE', started_at:new Date().toISOString(), start_latitude:latitude, start_longitude:longitude });
    if (error) return { error: error.message };
    revalidatePath('/field'); revalidatePath('/');
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to start work session.' }; }
}

export async function endWorkSession(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude'));
    const { data: active } = await supabase.from('work_sessions').select('id').eq('employee_id', employee.id).eq('status','ACTIVE').maybeSingle();
    if (!active) return { error: 'No active work session found.' };
    await endWorkSessionInternal(supabase, employee.id, active.id, latitude, longitude);
    revalidatePath('/field'); revalidatePath('/');
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to end work session.' }; }
}

export async function recordLocationPing(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const sessionId = text(formData.get('work_session_id')); const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude')); const accuracy = num(formData.get('accuracy'));
    if (!sessionId || latitude === null || longitude === null) return { error: 'A valid active session and location are required.' };
    const { data: session } = await supabase.from('work_sessions').select('id,status').eq('id',sessionId).eq('employee_id',employee.id).maybeSingle();
    if (!session || session.status !== 'ACTIVE') return { error: 'The work session is not active.' };
    const { error } = await supabase.from('work_session_location_points').insert({ company_id:employee.company_id,work_session_id:sessionId,employee_id:employee.id,latitude,longitude,accuracy_m:accuracy });
    if (error) return { error: error.message };
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Unable to record location.' }; }
}

export async function createVisit(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const customerId = text(formData.get('customer_id')); if (!customerId) return { error: 'Customer is required.' };
    const { data: customer } = await supabase.from('customers').select('id,company_id').eq('id',customerId).maybeSingle();
    if (!customer) return { error: 'Customer not found.' };
    const { error } = await supabase.from('customer_visits').insert({ company_id:employee.company_id,customer_id:customer.id,employee_id:employee.id,lead_id:nullableText(formData.get('lead_id')),scheduled_at:nullableText(formData.get('scheduled_at')),notes:nullableText(formData.get('notes')),status:'PLANNED' });
    if (error) return { error:error.message };
    revalidatePath('/field'); revalidatePath('/visits');
    return { success:true };
  } catch(e) { return { error:e instanceof Error?e.message:'Unable to create visit.' }; }
}

export async function startVisit(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const id = text(formData.get('id')); const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude')); const accuracy = num(formData.get('accuracy'));
    if (!id || latitude === null || longitude === null) return { error:'Current location is required to start a visit.' };
    const { data: visit } = await supabase.from('customer_visits').select('id,customer_id,status').eq('id',id).eq('employee_id',employee.id).maybeSingle();
    if (!visit) return { error:'Visit not found.' }; if (visit.status === 'COMPLETED') return { error:'This visit is already completed.' };
    const { data: customer } = await supabase.from('customers').select('latitude,longitude,geofence_radius_m').eq('id',visit.customer_id).maybeSingle();
    if (!customer?.latitude || !customer?.longitude) return { error:'Set the customer GPS coordinates before starting a verified visit.' };
    const { data: distance } = await supabase.rpc('haversine_meters',{lat1:latitude,lon1:longitude,lat2:customer.latitude,lon2:customer.longitude});
    const distanceM = Number(distance);
    const verified = Number.isFinite(distanceM) && distanceM <= customer.geofence_radius_m;
    if (!verified) return { error:`You are about ${Math.round(distanceM)}m away. Move within ${customer.geofence_radius_m}m of the customer to check in.` };
    const { error } = await supabase.from('customer_visits').update({ status:'STARTED',started_at:new Date().toISOString(),check_in_latitude:latitude,check_in_longitude:longitude,check_in_accuracy_m:accuracy,check_in_distance_m:distanceM,geofence_verified:true }).eq('id',id);
    if (error) return { error:error.message };
    revalidatePath('/field'); revalidatePath('/visits'); revalidatePath(`/visits/${id}`);
    return { success:true,distanceM:Math.round(distanceM) };
  } catch(e) { return { error:e instanceof Error?e.message:'Unable to start visit.' }; }
}

export async function completeVisit(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const id=text(formData.get('id')); if(!id) return {error:'Visit id is required.'};
    const { data: visit } = await supabase.from('customer_visits').select('id,status').eq('id',id).eq('employee_id',employee.id).maybeSingle();
    if(!visit) return {error:'Visit not found.'}; if(visit.status!=='STARTED') return {error:'Start the visit before completing it.'};
    const { error } = await supabase.from('customer_visits').update({status:'COMPLETED',completed_at:new Date().toISOString(),outcome:nullableText(formData.get('outcome')),notes:nullableText(formData.get('notes')),next_follow_up_at:nullableText(formData.get('next_follow_up_at'))}).eq('id',id);
    if(error) return {error:error.message};
    const { data: rewardData, error: rewardError } = await supabase.rpc('complete_visit_with_rewards', { p_visit_id: id });
    if (rewardError) return { error: rewardError.message };
    revalidatePath('/field'); revalidatePath('/visits'); revalidatePath(`/visits/${id}`); revalidatePath('/leads'); revalidatePath('/rewards');
    return {success:true, ...(rewardData ?? {})};
  } catch(e) { return {error:e instanceof Error?e.message:'Unable to complete visit.'}; }
}

export async function startTrip(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude'));
    if (latitude === null || longitude === null) return { error: 'Current location is required to start a trip.' };
    const { data: active } = await supabase.from('trips').select('id').eq('employee_id', employee.id).eq('status','ACTIVE').maybeSingle();
    if (active) return { error: 'A trip is already active.' };
    const { error } = await supabase.from('trips').insert({ company_id: employee.company_id, employee_id: employee.id, status:'ACTIVE', start_latitude:latitude, start_longitude:longitude, purpose:nullableText(formData.get('purpose')), notes:nullableText(formData.get('notes')) });
    if (error) return { error: error.message };
    revalidatePath('/trips'); revalidatePath('/map');
    return { success:true };
  } catch (e) { return { error:e instanceof Error?e.message:'Unable to start trip.' }; }
}

export async function recordTripPoint(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const tripId = text(formData.get('trip_id')); const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude')); const accuracy = num(formData.get('accuracy'));
    if (!tripId || latitude === null || longitude === null) return { error:'A valid active trip and location are required.' };
    const { data: trip } = await supabase.from('trips').select('id,status').eq('id',tripId).eq('employee_id',employee.id).maybeSingle();
    if (!trip || trip.status !== 'ACTIVE') return { error:'The trip is not active.' };
    const { data: previous } = await supabase.from('trip_points').select('latitude,longitude').eq('trip_id',tripId).order('recorded_at',{ascending:false}).limit(1).maybeSingle();
    const { error } = await supabase.from('trip_points').insert({ company_id:employee.company_id,trip_id:tripId,employee_id:employee.id,latitude,longitude,accuracy_m:accuracy });
    if (error) return { error:error.message };
    if (previous) {
      const { data: segment } = await supabase.rpc('haversine_meters',{lat1:previous.latitude,lon1:previous.longitude,lat2:latitude,lon2:longitude});
      if (typeof segment === 'number' && segment >= 0) {
        const { data: current } = await supabase.from('trips').select('distance_m').eq('id',tripId).single();
        await supabase.from('trips').update({ distance_m:(current?.distance_m ?? 0)+segment }).eq('id',tripId).eq('employee_id',employee.id);
      }
    }
    return { success:true };
  } catch(e) { return { error:e instanceof Error?e.message:'Unable to record trip location.' }; }
}

export async function endTrip(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const id = text(formData.get('trip_id')); const latitude = num(formData.get('latitude')); const longitude = num(formData.get('longitude'));
    if (!id) return { error:'Trip is required.' };
    const { data: trip } = await supabase.from('trips').select('id,status').eq('id',id).eq('employee_id',employee.id).maybeSingle();
    if (!trip || trip.status !== 'ACTIVE') return { error:'Active trip not found.' };
    const { error } = await supabase.from('trips').update({ status:'COMPLETED',ended_at:new Date().toISOString(),end_latitude:latitude,end_longitude:longitude }).eq('id',id).eq('employee_id',employee.id);
    if (error) return { error:error.message };
    revalidatePath('/trips'); revalidatePath('/map');
    return { success:true };
  } catch(e) { return { error:e instanceof Error?e.message:'Unable to end trip.' }; }
}

export async function checkInWithType(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const mode = text(formData.get('mode')) || 'OFFICE';
    const latitude = num(formData.get('latitude')) ?? 26.8467;
    const longitude = num(formData.get('longitude')) ?? 80.9462;
    const accuracy = num(formData.get('accuracy')) ?? 20;
    const photoData = text(formData.get('photo'));
    const customNote = text(formData.get('note'));
    const allowRecheckin = formData.get('allow_recheckin') === 'true';

    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());

    const { data: existing } = await supabase
      .from('attendance')
      .select('id,check_in_at,check_out_at,check_in_note')
      .eq('employee_id', employee.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (existing?.check_in_at && !existing.check_out_at && !allowRecheckin) {
      return { error: 'You are already checked in today.' };
    }

    // Process camera photo upload if provided
    let photoUrl: string | null = null;
    if (photoData && photoData.startsWith('data:image/')) {
      try {
        const admin = createAdminClient();
        const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${employee.id}/${today}_${Date.now()}.jpg`;
        const { data: uploadRes, error: uploadErr } = await admin.storage
          .from('attendance-photos')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadErr && uploadRes) {
          const { data: pubUrl } = admin.storage
            .from('attendance-photos')
            .getPublicUrl(fileName);
          photoUrl = pubUrl.publicUrl;
        }
      } catch (err) {
        console.warn('Failed to upload attendance photo:', err);
      }
    }

    let note = mode === 'OFFICE' ? 'OFFICE' : 'FIELD';
    if (photoUrl) {
      note += ` | PHOTO:${photoUrl}`;
    } else if (existing?.check_in_note && existing.check_in_note.includes('PHOTO:')) {
      const match = existing.check_in_note.match(/PHOTO:[^\s|]+/);
      if (match) note += ` | ${match[0]}`;
    }
    if (customNote) {
      note += ` | NOTE:${customNote}`;
    }

    const { data: attData, error: attErr } = await supabase
      .from('attendance')
      .upsert(
        {
          company_id: employee.company_id,
          employee_id: employee.id,
          attendance_date: today,
          status: 'PRESENT',
          check_in_at: new Date().toISOString(),
          check_out_at: null,
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          check_in_accuracy_m: accuracy,
          check_in_note: note,
          check_out_note: null,
        },
        { onConflict: 'employee_id,attendance_date' }
      )
      .select('id')
      .single();

    if (attErr) return { error: attErr.message };

    // Automatically initialize an active work session
    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    let sessionId = activeSession?.id;

    if (!activeSession) {
      const { data: newSession, error: sessErr } = await supabase
        .from('work_sessions')
        .insert({
          company_id: employee.company_id,
          employee_id: employee.id,
          attendance_id: attData?.id,
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
          start_latitude: latitude,
          start_longitude: longitude,
        })
        .select('id')
        .single();

      if (!sessErr && newSession) {
        sessionId = newSession.id;
      }
    }

    if (sessionId) {
      await supabase.from('work_session_location_points').insert({
        company_id: employee.company_id,
        work_session_id: sessionId,
        employee_id: employee.id,
        latitude,
        longitude,
        accuracy_m: accuracy,
        recorded_at: new Date().toISOString(),
      });
    }

    revalidatePath('/field');
    revalidatePath('/attendance');
    revalidatePath('/map');
    revalidatePath('/');

    return { success: true, mode };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to check in.' };
  }
}

export async function autoCheckOutAt1800() {
  try {
    const { supabase, employee } = await requireEmployee();
    const today = new Intl.DateTimeFormat('en-CA').format(new Date());

    const { data: attendance } = await supabase
      .from('attendance')
      .select('id,check_in_at,check_out_at,check_in_latitude,check_in_longitude')
      .eq('employee_id', employee.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (!attendance?.check_in_at) {
      return { error: 'No active check-in found for today.' };
    }
    if (attendance.check_out_at) {
      return { success: true, alreadyCheckedOut: true };
    }

    const { error: attErr } = await supabase
      .from('attendance')
      .update({
        check_out_at: new Date().toISOString(),
        check_out_latitude: attendance.check_in_latitude,
        check_out_longitude: attendance.check_in_longitude,
        check_out_note: 'AUTO_LOGOUT_1800: Shift ended at 6:00 PM (Office Day Completed)',
      })
      .eq('id', attendance.id);

    if (attErr) return { error: attErr.message };

    const { data: active } = await supabase
      .from('work_sessions')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (active) {
      await endWorkSessionInternal(supabase, employee.id, active.id, attendance.check_in_latitude, attendance.check_in_longitude);
    }

    revalidatePath('/field');
    revalidatePath('/attendance');
    revalidatePath('/map');
    revalidatePath('/');

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to complete auto logout.' };
  }
}

export async function continueOvertime(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const reason = text(formData.get('reason')) || 'Field Overtime';
    const durationHours = text(formData.get('duration_hours')) || '2';
    const notes = nullableText(formData.get('notes'));
    const latitude = num(formData.get('latitude'));
    const longitude = num(formData.get('longitude'));
    const accuracy = num(formData.get('accuracy'));

    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());

    const { data: attendance } = await supabase
      .from('attendance')
      .select('id,check_in_at')
      .eq('employee_id', employee.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (!attendance?.check_in_at) {
      return { error: 'Please check in first before activating overtime.' };
    }

    const overtimeTag = `OVERTIME: ${reason} (+${durationHours}h)${notes ? ` - ${notes}` : ''}`;

    const { error: attErr } = await supabase
      .from('attendance')
      .update({
        check_out_at: null,
        check_in_note: overtimeTag,
        check_out_note: null,
      })
      .eq('id', attendance.id);

    if (attErr) return { error: attErr.message };

    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    let sessionId = activeSession?.id;

    if (!activeSession) {
      const { data: newSession } = await supabase
        .from('work_sessions')
        .insert({
          company_id: employee.company_id,
          employee_id: employee.id,
          attendance_id: attendance.id,
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
          start_latitude: latitude,
          start_longitude: longitude,
        })
        .select('id')
        .single();

      if (newSession) sessionId = newSession.id;
    }

    if (sessionId && latitude !== null && longitude !== null) {
      await supabase.from('work_session_location_points').insert({
        company_id: employee.company_id,
        work_session_id: sessionId,
        employee_id: employee.id,
        latitude,
        longitude,
        accuracy_m: accuracy,
        recorded_at: new Date().toISOString(),
      });
    }

    try {
      const { data: gam } = await supabase
        .from('employee_gamification')
        .select('xp_total,tasks_completed')
        .eq('employee_id', employee.id)
        .maybeSingle();

      await supabase.from('employee_gamification').upsert({
        employee_id: employee.id,
        company_id: employee.company_id,
        xp_total: (gam?.xp_total ?? 0) + 150,
        tasks_completed: (gam?.tasks_completed ?? 0) + 1,
        updated_at: new Date().toISOString(),
      });
    } catch (gamErr) {
      console.warn('Could not award overtime gamification XP:', gamErr);
    }

    revalidatePath('/field');
    revalidatePath('/attendance');
    revalidatePath('/map');
    revalidatePath('/rewards');
    revalidatePath('/');

    return { success: true, xpAwarded: 150, overtimeTag };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to continue overtime.' };
  }
}

export async function claimLateNightAllowance(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const claimType = text(formData.get('claim_type')) || 'CAB_FARE';
    const amount = num(formData.get('amount')) || 0;
    const notes = text(formData.get('notes')) || 'Late night field conveyance';

    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());

    const { data: attendance } = await supabase
      .from('attendance')
      .select('id,check_out_note')
      .eq('employee_id', employee.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (!attendance) {
      return { error: 'No attendance record found for today.' };
    }

    const claimDetail = `LATE_ALLOWANCE: ${claimType} (₹${amount}) - ${notes}`;
    const updatedNote = attendance.check_out_note
      ? `${attendance.check_out_note} | ${claimDetail}`
      : claimDetail;

    const { error: attErr } = await supabase
      .from('attendance')
      .update({ check_out_note: updatedNote })
      .eq('id', attendance.id);

    if (attErr) return { error: attErr.message };

    revalidatePath('/field');
    revalidatePath('/attendance');
    revalidatePath('/payouts');
    revalidatePath('/');

    return { success: true, amount };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to log allowance claim.' };
  }
}

export async function completeDayAndCheckout(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const latitude = num(formData.get('latitude'));
    const longitude = num(formData.get('longitude'));
    const accuracy = num(formData.get('accuracy'));
    const summaryNotes = text(formData.get('summary_notes')) || 'Work day concluded';

    const today = text(formData.get('local_date')) || new Intl.DateTimeFormat('en-CA').format(new Date());

    const { data: attendance } = await supabase
      .from('attendance')
      .select('id,check_in_at,check_out_note')
      .eq('employee_id', employee.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (!attendance?.check_in_at) {
      return { error: 'Check in before checking out.' };
    }

    const finalNote = attendance.check_out_note
      ? `${attendance.check_out_note} | DAY_COMPLETED: ${summaryNotes}`
      : `DAY_COMPLETED: ${summaryNotes}`;

    const { error } = await supabase
      .from('attendance')
      .update({
        check_out_at: new Date().toISOString(),
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        check_out_accuracy_m: accuracy,
        check_out_note: finalNote,
      })
      .eq('id', attendance.id);

    if (error) return { error: error.message };

    const { data: active } = await supabase
      .from('work_sessions')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (active) {
      await endWorkSessionInternal(supabase, employee.id, active.id, latitude, longitude);
    }

    revalidatePath('/field');
    revalidatePath('/attendance');
    revalidatePath('/map');
    revalidatePath('/');

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to complete day checkout.' };
  }
}

export async function correctAttendance(formData: FormData) {
  try {
    const { supabase, employee } = await requireEmployee();
    const attendanceId = formData.get('attendance_id') as string;
    const actionType = formData.get('action_type') as string;
    const newMode = (formData.get('mode') as string) || 'OFFICE';
    const reason = (formData.get('reason') as string) || 'Correction requested';

    if (!attendanceId) {
      return { error: 'Attendance ID is required.' };
    }

    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', attendanceId)
      .eq('employee_id', employee.id)
      .single();

    if (attErr || !attendance) {
      return { error: 'Attendance record not found.' };
    }

    if (actionType === 'CHANGE_MODE') {
      let note = attendance.check_in_note || '';
      if (note.startsWith('OFFICE') || note.startsWith('FIELD')) {
        note = note.replace(/^(OFFICE|FIELD)/, newMode);
      } else {
        note = `${newMode} | ${note}`;
      }
      note = `${note} | CORRECTION: Switched to ${newMode} (Reason: ${reason})`;

      const { error: updateErr } = await supabase
        .from('attendance')
        .update({ check_in_note: note })
        .eq('id', attendanceId);

      if (updateErr) return { error: updateErr.message };
    } else if (actionType === 'REOPEN_SHIFT') {
      let note = attendance.check_out_note || '';
      note = note
        ? `${note} | REOPENED: Shift reopened at ${new Date().toLocaleTimeString()} (Reason: ${reason})`
        : `REOPENED: Shift reopened at ${new Date().toLocaleTimeString()} (Reason: ${reason})`;

      const { error: updateErr } = await supabase
        .from('attendance')
        .update({
          check_out_at: null,
          check_out_note: note,
        })
        .eq('id', attendanceId);

      if (updateErr) return { error: updateErr.message };

      // Ensure an active work session exists
      const { data: activeSession } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (!activeSession) {
        await supabase.from('work_sessions').insert({
          company_id: employee.company_id,
          employee_id: employee.id,
          attendance_id: attendance.id,
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
          start_latitude: attendance.check_in_latitude,
          start_longitude: attendance.check_in_longitude,
        });
      }
    } else if (actionType === 'RESET') {
      // Clear location points and work sessions for today's attendance
      const { data: sessions } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('attendance_id', attendance.id);

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        await supabase
          .from('work_session_location_points')
          .delete()
          .in('work_session_id', sessionIds);
        await supabase
          .from('work_sessions')
          .delete()
          .in('id', sessionIds);
      }

      const { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('id', attendance.id);

      if (delErr) return { error: delErr.message };
    } else {
      return { error: 'Unknown correction action.' };
    }

    revalidatePath('/field');
    revalidatePath('/attendance');
    revalidatePath('/map');
    revalidatePath('/');

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to apply attendance correction.' };
  }
}

