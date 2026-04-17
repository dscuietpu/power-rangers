import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  const signUp = async (formData: FormData) => {
    'use server';
    
    // We will let Supabase store the email, and then we will manually insert into profiles
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const role = 'user';

    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          role,
        }
      }
    });

    if (authError) {
      console.error('Sign-up error:', authError.message);
      return redirect(`/signup?error=${encodeURIComponent(authError.message)}`);
    }

    // Profile is auto-created by a database trigger on auth.users INSERT.
    // No manual insert needed here.

    return redirect('/');
  };

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto h-screen items-center">
      <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground" action={signUp}>
        <h1 className="text-3xl font-bold mb-6 text-center text-slate-100">Sign Up</h1>

        {params?.error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-md px-4 py-3 mb-4 text-sm">
            {params.error}
          </div>
        )}
        {params?.message && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-md px-4 py-3 mb-4 text-sm">
            {params.message}
          </div>
        )}
        
        <label className="text-md text-slate-300" htmlFor="name">Full Name</label>
        <input className="rounded-md px-4 py-2 bg-slate-800 border border-slate-700 mb-4 text-slate-100" name="name" placeholder="John Doe" required />

        <label className="text-md text-slate-300" htmlFor="phone">Phone Number</label>
        <input className="rounded-md px-4 py-2 bg-slate-800 border border-slate-700 mb-4 text-slate-100" name="phone" placeholder="+123456789" />


        <label className="text-md text-slate-300" htmlFor="email">Email</label>
        <input className="rounded-md px-4 py-2 bg-slate-800 border border-slate-700 mb-4 text-slate-100" name="email" placeholder="you@example.com" required />
        
        <label className="text-md text-slate-300" htmlFor="password">Password</label>
        <input className="rounded-md px-4 py-2 bg-slate-800 border border-slate-700 mb-6 text-slate-100" type="password" name="password" placeholder="••••••••" required />
        
        <button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-md px-4 py-2 text-foreground mb-2">
          Create Account
        </button>
        <p className="text-sm text-center text-slate-400 mt-4">
          Already have an account? <a href="/login" className="text-blue-400 hover:underline">Log In</a>
        </p>
      </form>
    </div>
  );
}

