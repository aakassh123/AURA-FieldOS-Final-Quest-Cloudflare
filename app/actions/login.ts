'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export async function resolveEmailFromIdentifier(identifier: string): Promise<string> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) {
    return clean;
  }

  if (clean === 'admin' || clean === 'superadmin') {
    return 'admin@aura.local';
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

    // 1. Search employees by employee_code
    const { data: empByCode } = await admin
      .from('employees')
      .select('email,employee_code')
      .or(searchFilters.map((code) => `employee_code.ilike.${code}`).join(','))
      .limit(1);

    if (empByCode && empByCode.length > 0 && empByCode[0].email) {
      return empByCode[0].email;
    }

    // 2. Search employees by full_name or email
    const { data: empByName } = await admin
      .from('employees')
      .select('email')
      .or(`full_name.ilike.%${clean}%,email.ilike.%${clean}%`)
      .limit(1);

    if (empByName && empByName.length > 0 && empByName[0].email) {
      return empByName[0].email;
    }

    // 3. Fallback: Search in auth users list
    const { data: authUsers } = await admin.auth.admin.listUsers();
    if (authUsers?.users) {
      const match = authUsers.users.find((u) => {
        const uCode = (u.user_metadata?.employee_code as string)?.toUpperCase();
        const uName = (u.user_metadata?.full_name as string)?.toLowerCase();
        const uEmail = u.email?.toLowerCase();
        return (
          (uCode && searchFilters.includes(uCode)) ||
          uCode === upper ||
          (uName && uName.includes(clean)) ||
          (uEmail && uEmail.includes(clean))
        );
      });
      if (match?.email) {
        return match.email;
      }
    }
  } catch (err) {
    console.warn('Error resolving employee code to email:', err);
  }

  return clean;
}
