import { supabase } from "@/api/supabaseClient";

/**
 * Permanently delete the signed-in user's account and their data.
 * Calls the `delete_my_account` Postgres function, which can only ever delete the
 * caller's own auth user; foreign keys cascade to their rows.
 */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(error.message || "Couldn't delete your account. Please try again.");
}
