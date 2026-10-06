"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: FormDataEntryValue | null) {
  const v = text(value);
  return v || null;
}

export async function updateMyProfile(formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to update profile." };
    }

    const fullName = text(formData.get("full_name"));
    const phone = nullableText(formData.get("phone"));
    const designation = nullableText(formData.get("designation"));
    const employeeCode = text(formData.get("employee_code")).toUpperCase();
    const avatarUrl = nullableText(formData.get("avatar_url"));
    const joinedAt = nullableText(formData.get("joined_at"));

    if (fullName.length < 2) {
      return { error: "Full name must be at least 2 characters." };
    }

    const admin = createAdminClient();

    // 1. Update Auth user metadata
    const userMeta = {
      ...(user.user_metadata || {}),
      full_name: fullName,
      phone: phone || undefined,
      designation: designation || undefined,
      avatar_url: avatarUrl || undefined,
    };

    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: userMeta,
    });

    if (authError) {
      return { error: `Auth update error: ${authError.message}` };
    }

    // 2. Update public.profiles
    await admin
      .from("profiles")
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // 3. Update or link public.employees
    const employeeUpdates: Record<string, any> = {
      full_name: fullName,
      phone,
      designation,
      updated_at: new Date().toISOString(),
    };

    if (employeeCode) {
      employeeUpdates.employee_code = employeeCode;
    }
    if (joinedAt) {
      employeeUpdates.joined_at = joinedAt;
    }

    const { error: empError } = await admin
      .from("employees")
      .update(employeeUpdates)
      .eq("user_id", user.id);

    if (empError) {
      console.warn("Employee row update error:", empError.message);
    }

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/employees");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update profile." };
  }
}
