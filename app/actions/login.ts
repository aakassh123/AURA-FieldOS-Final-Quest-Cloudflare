'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface ResolveLoginResult {
  success: boolean;
  email: string;
  found: boolean;
  isEmail: boolean;
  employeeCode?: string;
  fullName?: string;
  error?: string;
}

export async function resolveEmailFromIdentifier(identifier: string): Promise<ResolveLoginResult> {
  const clean = identifier.trim();
  if (!clean) {
    return { success: false, email: '', found: false, isEmail: false, error: 'Please enter an Employee ID or Email.' };
  }

  // 1. Direct email address
  if (clean.includes('@')) {
    const emailLower = clean.toLowerCase();
    return {
      success: true,
      email: emailLower,
      found: true,
      isEmail: true,
    };
  }

  // 2. Built-in Admin shortcut
  const cleanLower = clean.toLowerCase();
  if (cleanLower === 'admin' || cleanLower === 'superadmin') {
    return {
      success: true,
      email: 'admin@aura.local',
      found: true,
      isEmail: false,
      employeeCode: 'EMP-001',
      fullName: 'AURA Super Admin',
    };
  }

  try {
    const admin = createAdminClient();
    const upper = clean.toUpperCase();
    const digitsOnly = clean.replace(/\D/g, '');
    const padded = digitsOnly ? `EMP-${digitsOnly.padStart(3, '0')}` : '';
    const formattedCode = upper.startsWith('EMP-')
      ? upper
      : upper.startsWith('EMP')
      ? `EMP-${upper.slice(3)}`
      : `EMP-${upper}`;

    const searchFilters = Array.from(new Set([upper, formattedCode, ...(padded ? [padded] : [])]));

    // Check employees table by employee_code
    const { data: empByCode } = await admin
      .from('employees')
      .select('email,employee_code,full_name')
      .or(searchFilters.map((code) => `employee_code.ilike.${code}`).join(','))
      .limit(1);

    if (empByCode && empByCode.length > 0 && empByCode[0].email) {
      return {
        success: true,
        email: empByCode[0].email,
        found: true,
        isEmail: false,
        employeeCode: empByCode[0].employee_code || formattedCode,
        fullName: empByCode[0].full_name || undefined,
      };
    }

    // Check employees by full_name or email
    const { data: empByName } = await admin
      .from('employees')
      .select('email,employee_code,full_name')
      .or(`full_name.ilike.%${clean}%,email.ilike.%${clean}%`)
      .limit(1);

    if (empByName && empByName.length > 0 && empByName[0].email) {
      return {
        success: true,
        email: empByName[0].email,
        found: true,
        isEmail: false,
        employeeCode: empByName[0].employee_code || formattedCode,
        fullName: empByName[0].full_name || undefined,
      };
    }

    // Check auth users metadata
    const { data: authUsers } = await admin.auth.admin.listUsers();
    if (authUsers?.users) {
      const match = authUsers.users.find((u) => {
        const uCode = (u.user_metadata?.employee_code as string)?.toUpperCase();
        const uName = (u.user_metadata?.full_name as string)?.toLowerCase();
        const uEmail = u.email?.toLowerCase();
        return (
          (uCode && searchFilters.includes(uCode)) ||
          uCode === upper ||
          (uName && uName.includes(cleanLower)) ||
          (uEmail && uEmail.includes(cleanLower))
        );
      });
      if (match?.email) {
        return {
          success: true,
          email: match.email,
          found: true,
          isEmail: false,
          employeeCode: (match.user_metadata?.employee_code as string) || formattedCode,
          fullName: (match.user_metadata?.full_name as string) || undefined,
        };
      }
    }
  } catch (err: any) {
    console.warn('Error resolving employee code to email:', err?.message || err);
  }

  // Not found in database
  return {
    success: false,
    email: '',
    found: false,
    isEmail: false,
    error: `Employee ID "${clean.toUpperCase()}" was not found in the workspace. Please verify your ID or create an account.`,
  };
}
