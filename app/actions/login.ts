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

    const searchFilters = [upper, formattedCode];
    if (padded) searchFilters.push(padded);

    // 1. Search employees by employee_code
    const { data: empByCode } = await admin
      .from('employees')
      .select('email,employee_code')
      .or(searchFilters.map((code) => `employee_code.ilike.${code}`).join(','))
      .maybeSingle();

    if (empByCode?.email) {
      return empByCode.email;
    }

    // 2. Search employees by full_name or email
    const { data: empByName } = await admin
      .from('employees')
      .select('email')
      .or(`full_name.ilike.%${clean}%,email.ilike.%${clean}%`)
      .maybeSingle();

    if (empByName?.email) {
      return empByName.email;
    }
  } catch (err) {
    console.warn('Error resolving employee code to email:', err);
  }

  return clean;
}
