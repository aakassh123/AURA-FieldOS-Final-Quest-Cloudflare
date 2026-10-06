'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface RegisterResult {
  success?: boolean;
  error?: string;
  employeeCode?: string;
  email?: string;
}

export async function registerUser(formData: FormData): Promise<RegisterResult> {
  const fullName = String(formData.get('full_name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || 'FIELD_OFFICER').trim();

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

    // 2. Fetch default company
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1);

    const defaultCompany = companies?.[0] || null;

    // 3. Compute next employee code (e.g. EMP-003)
    let nextCode = 'EMP-001';
    const { data: allEmployees } = await admin
      .from('employees')
      .select('employee_code');

    if (allEmployees && allEmployees.length > 0) {
      let maxNum = 0;
      for (const emp of allEmployees) {
        const match = emp.employee_code?.match(/EMP-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      nextCode = `EMP-${String(maxNum + 1).padStart(3, '0')}`;
    }

    // 4. Create user with admin privileges (bypasses email rate limits & auto-confirms)
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        employee_code: nextCode,
        company_name: defaultCompany?.name || 'AURA Technologies',
      },
    });

    if (createError || !newUser?.user) {
      return { error: createError?.message || 'Failed to create user account.' };
    }

    const userId = newUser.user.id;

    // 5. Update public.profiles
    if (defaultCompany) {
      await admin
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fullName,
          company_id: defaultCompany.id,
          role: role as any,
          updated_at: new Date().toISOString(),
        });

      // 6. Insert public.employees
      await admin
        .from('employees')
        .upsert({
          company_id: defaultCompany.id,
          user_id: userId,
          employee_code: nextCode,
          full_name: fullName,
          email,
          role: role as any,
          designation: role === 'COMPANY_ADMIN' ? 'Administrator' : 'Field Executive',
          joined_at: new Date().toISOString(),
          is_active: true,
        });
    }

    return {
      success: true,
      employeeCode: nextCode,
      email,
    };
  } catch (err: any) {
    console.error('Registration error:', err);
    return { error: err.message || 'An unexpected error occurred during registration.' };
  }
}
