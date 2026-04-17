import React from 'react';
import { Menu, User, MapPin, Megaphone, UserPlus, LogOut, LogIn } from 'lucide-react';
export const dynamic = 'force-dynamic';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

import Link from 'next/link';
import SOSButton from './components/SOSButton';
import ActionSidebar from './components/ActionSidebar';
import HamburgerMenu from './components/HamburgerMenu';
import MobileActionBar from './components/MobileActionBar';
import ReportDisasterModal from './components/ReportDisasterModal';
import EmergencyDetailsModal from './components/EmergencyDetailsModal';
import MapWrapper from './components/MapWrapper';
import SirenAlert from './components/SirenAlert';

export default async function DashboardLayout() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileData = null;
  let isVolunteer = false;
  let volunteerStatus: string | null = null;
  if (user) {
    const { data: profile, error: pError } = await supabase.from('profiles').select('role, name').eq('id', user.id).maybeSingle();
    if (pError) console.error("Profile Fetch Error:", pError);
    profileData = profile;
    isVolunteer = profile?.role === 'volunteer';

    const { data: vProfile, error: vError } = await supabase.from('volunteer_profiles').select('status').eq('id', user.id).maybeSingle();
    if (vError) console.error("Volunteer Profile Fetch Error:", vError);
    
    volunteerStatus = vProfile?.status || null;
    
    console.log(`DEBUG: User ${user.id} | Role: ${profile?.role} | Status: ${volunteerStatus}`);
  }

  // Handle logout
  const signOut = async () => {
    'use server';
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut();
    return redirect('/login');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* --- Top Navigation Bar --- */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 z-20">
        <div className="flex items-center gap-4">
          <HamburgerMenu userId={user?.id} isVolunteer={isVolunteer} userName={profileData?.name || undefined} />
          
          <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">
            Power Rangers
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <form action={signOut}>
                <button className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                  <LogOut className="w-4 h-4"/> <span className="text-sm">Sign Out</span>
                </button>
              </form>
              <div className="group relative">
                <button className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 active:scale-95 shadow-lg">
                  <User className="w-5 h-5 text-slate-300" />
                </button>
                
                {/* Profile Hover Tooltip */}
                <div className="absolute top-12 right-0 w-64 p-4 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 transition-all duration-200 z-[100]">
                  <div className="flex flex-col gap-1">
                    <p className="text-white font-bold text-sm truncate">{profileData?.name || 'User'}</p>
                    <p className="text-slate-400 text-xs truncate">{user.email}</p>
                    <div className="mt-2 pt-2 border-t border-slate-800">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Account Type</p>
                      <p className={`text-xs font-medium ${isVolunteer ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {isVolunteer ? 'Active Volunteer' : 'Standard User'}
                      </p>
                    </div>
                  </div>
                  {/* Tooltip Arrow */}
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 border-t border-l border-slate-700 rotate-45"></div>
                </div>
              </div>
            </>
          ) : (
            <Link href="/login" className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
              <LogIn className="w-4 h-4"/> <span className="text-sm">Log In / Sign Up</span>
            </Link>
          )}
        </div>
      </header>

      {/* --- Main Application Area --- */}
      <div className="flex flex-1 overflow-hidden relative z-0">
        
        {/* --- Left Sidebar (Desktop Only) --- */}
        <aside className="hidden md:flex w-72 flex-col justify-between p-6 border-r border-slate-800 bg-slate-900/50 z-10">
          
          {/* Action Buttons */}
          <ActionSidebar userId={user?.id} />

          <SOSButton userId={user?.id} />
        </aside>

        {/* --- Map Container (Main Content) --- */}
        <main className="flex-1 p-2 sm:p-4 md:p-6 relative bg-slate-950 z-0 overflow-hidden">
          {/* Dynamic Map Component */}
          <MapWrapper isVolunteer={isVolunteer} />
        </main>

      </div>

      <MobileActionBar userId={user?.id} />
      <ReportDisasterModal userId={user?.id} />
      <EmergencyDetailsModal userId={user?.id} />
      <SirenAlert />
    </div>
  );
}