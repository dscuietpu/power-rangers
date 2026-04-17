'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function registerAsVolunteer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to register as a volunteer.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: 'volunteer' })
    .eq('id', user.id);

  if (error) {
    console.error('Error updating role:', error);
    return { error: 'Failed to update role.' };
  }

  revalidatePath('/');
  return { success: true };
}

export async function assignVolunteerRole(userId: string, targetRole: 'volunteer' | 'user' = 'volunteer') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to perform this action.' };
  }

  // Check if current user is an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Unauthorized access. Admins only.' };
  }

  // Note: For this to work in production with RLS enabled on profiles, 
  // you'll need the admin policy added to the profiles table OR use the service_role key.
  // To use the service_role key, you would import createClient from '@supabase/supabase-js' 
  // and pass process.env.SUPABASE_SERVICE_ROLE_KEY.
  const { error } = await supabase
    .from('profiles')
    .update({ role: targetRole })
    .eq('id', userId);

  if (error) {
    console.error(`Error updating role to ${targetRole}:`, error);
    return { error: `Failed to update role to ${targetRole}.` };
  }

  revalidatePath('/admin/volunteers');
  return { success: true };
}
