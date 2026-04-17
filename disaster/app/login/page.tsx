import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  const signIn = async (formData: FormData) => {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign-in error:', error.message);
      return redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    return redirect('/');
  };

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto h-screen items-center">
      <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground" action={signIn}>
        <h1 className="text-3xl font-bold mb-6 text-center text-slate-100">Login to Technovate</h1>

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

        <label className="text-md text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-slate-800 border border-slate-700 mb-6 text-slate-100"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md text-slate-300" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-slate-800 border border-slate-700 mb-6 text-slate-100"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        <button className="bg-blue-600 hover:bg-blue-500 text-white rounded-md px-4 py-2 text-foreground mb-2">
          Sign In
        </button>
        <p className="text-sm text-center text-slate-400 mt-4">
          Don't have an account? <a href="/signup" className="text-blue-400 hover:underline">Sign Up</a>
        </p>
      </form>
    </div>
  );
}
