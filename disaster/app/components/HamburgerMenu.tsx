'use client';

import { useState } from 'react';
import { Menu, X, UserPlus, HeartHandshake } from 'lucide-react';
import { useRouter } from 'next/navigation';
import NearbyVolunteersModal from './NearbyVolunteersModal';

interface Props {
  userId?: string;
  isVolunteer: boolean;
  userName?: string;
}

export default function HamburgerMenu({ userId, isVolunteer, userName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVolunteersModalOpen, setIsVolunteersModalOpen] = useState(false);
  const router = useRouter();

  const handleRegister = () => {
    if (!userId) {
      alert("Please log in to register as a volunteer.");
      return;
    }
    if (isVolunteer) {
      alert("You are already registered as a volunteer!");
      return;
    }

    setIsOpen(false);
    router.push('/register-volunteer');
  };

  const handleNeedHelp = () => {
    setIsOpen(false);
    setIsVolunteersModalOpen(true);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-600"
      >
        <Menu className="w-6 h-6 text-slate-300" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Drawer */}
          <div className="relative w-72 max-w-sm h-full bg-slate-900 border-r border-slate-800 p-6 flex flex-col shadow-2xl animate-in slide-in-from-left">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-md transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-8 mt-2">Menu</h2>
            
            <div className="space-y-4">
              <button 
                onClick={handleRegister}
                disabled={isVolunteer}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isVolunteer ? 'bg-emerald-900/40 border-emerald-800' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} border rounded-xl text-left font-medium transition-all focus:ring-2 focus:ring-emerald-500 shadow-sm disabled:opacity-70`}
              >
                <UserPlus className={`w-5 h-5 ${isVolunteer ? 'text-emerald-500' : 'text-emerald-400'}`} />
                {isVolunteer ? 'Active Volunteer' : 'Register as a Volunteer'}
              </button>

              <button 
                onClick={handleNeedHelp}
                className="w-full flex items-center gap-3 px-4 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left font-medium transition-all focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                <HeartHandshake className="w-5 h-5 text-blue-400" />
                Need Help / Volunteers Nearby
              </button>
            </div>
          </div>
        </div>
      )}

      <NearbyVolunteersModal
        isOpen={isVolunteersModalOpen}
        onClose={() => setIsVolunteersModalOpen(false)}
        userName={userName}
      />
    </>
  );
}
