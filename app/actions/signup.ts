'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface RegisterResult {
  success?: boolean;
  error?: string;
  employeeCode?: string;
  email?: string;
  fullName?: string;
}

function normalizeRole(
  roleInput: string
): 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SALES_MANAGER' | 'SALESMAN' | 'HR_ACCOUNTS' {
  const upper = roleInput.toUpperCase();
  if (upper.includes('ADMIN')) return 'COMPANY_ADMIN';
  if (upper.includes('MANAGER')) return 'SALES_MANAGER';
  if (upper.includes('HR') || upper.includes('ACCOUNT')) return 'HR_ACCOUNTS';
  return 'SALESMAN';
}

export async function registerUser(formData: FormData): Promise<RegisterResult> {
  const fullName = String(formData.get('full_name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const roleRaw = String(formData.get('role') || 'SALESMAN').trim();
  const validRole = normalizeRole(roleRaw);

  if (!fullName || fullName.length < 2) {
    return { error: 'Full name must be at least 2 characters.' };
  }
  if (!email || !email.includes('@')) {
    return { error: 'Please provide a valid email address.' };
  }
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }

  try {
    const admin = createAdminClient();

    // 1. Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const alreadyRegistered = (existingUsers?.users || []).some(
      (u) => u.email?.toLowerCase() === email
    );
    if (alreadyRegistered) {
      return { error: 'An account with this email already exists. Please sign in instead.' };
    }

    // 2. Fetch primary company (AURA Technologies)
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1);

    const defaultCompany = companies?.[0] || {
      id: 'f9e69ac7-7082-41db-a35a-5c77900af472',
      name: 'AURA Technologies',
    };

    // 3. Compute next employee code (scan employees and auth users to guarantee uniqueness)
    let maxNum = 0;
    const { data: allEmployees } = await admin
      .from('employees')
      .select('employee_code');

    for (const emp of allEmployees || []) {
      const match = emp.employee_code?.match(/EMP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    for (const u of existingUsers?.users || []) {
      const match = (u.user_metadata?.employee_code as string)?.match(/EMP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextCode = `EMP-${String(maxNum + 1).padStart(3, '0')}`;

    // 4. Create user in Supabase auth (pre-confirmed, metadata attached)
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        employee_code: nextCode,
        role: validRole,
        company_id: defaultCompany.id,
        company_name: defaultCompany.name,
      },
    });

    if (createError || !newUser?.user) {
      return { error: createError?.message || 'Failed to create user account.' };
    }

    const userId = newUser.user.id;

    // 5. Upsert public.profiles
    const { error: profErr } = await admin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        company_id: defaultCompany.id,
        role: validRole,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (profErr) {
      console.warn('Profile upsert warning:', profErr.message);
    }

    // 6. Safe insert/update into public.employees
    const designation =
      validRole === 'COMPANY_ADMIN'
        ? 'Administrator'
        : validRole === 'SALES_MANAGER'
        ? 'Sales Manager'
        : validRole === 'HR_ACCOUNTS'
        ? 'HR & Accounts Executive'
        : 'Field Executive';

    const { data: existingEmp } = await admin
      .from('employees')
      .select('id')
      .or(`user_id.eq.${userId},email.eq.${email}`)
      .limit(1);

    if (existingEmp && existingEmp.length > 0) {
      await admin
        .from('employees')
        .update({
          company_id: defaultCompany.id,
          user_id: userId,
          employee_code: nextCode,
          full_name: fullName,
          email,
          role: validRole,
          designation,
          status: 'ACTIVE',
        })
        .eq('id', existingEmp[0].id);
    } else {
      await admin.from('employees').insert({
        company_id: defaultCompany.id,
        user_id: userId,
        employee_code: nextCode,
        full_name: fullName,
        email,
        role: validRole,
        designation,
        status: 'ACTIVE',
        joined_at: new Intl.DateTimeFormat('en-CA').format(new Date()),
      });
    }

    return {
      success: true,
      employeeCode: nextCode,
      email,
      fullName,
    };
  } catch (err: any) {
    console.error('Registration error:', err);
    return { error: err.message || 'An unexpected error occurred during registration.' };
  }
}
