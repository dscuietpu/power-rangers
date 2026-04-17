'use client';

import { Megaphone } from 'lucide-react';
import SOSButton from './SOSButton';
import { useLocationStore } from '@/store/useLocationStore';

interface Props {
  userId?: string;
}

export default function MobileActionBar({ userId }: Props) {
  const { isMapFullscreen, setIsReportModalOpen } = useLocationStore();

  if (isMapFullscreen) return null;

  return (
    <div className="md:hidden w-full shrink-0 p-4 bg-slate-900 border-t border-slate-800 flex justify-evenly items-center z-20 shadow-2xl gap-4 h-32">
      <div className="scale-90 origin-center">
        <button 
          onClick={() => setIsReportModalOpen(true)}
          className="flex items-center justify-center w-28 h-28 bg-slate-800 hover:bg-slate-700 border-4 border-slate-700 rounded-full transition-all focus:ring-2 focus:ring-blue-500 shadow-xl"
          title="Report Disaster"
        >
          <Megaphone className="w-10 h-10 text-blue-400" />
        </button>
      </div>

      <div className="scale-90 origin-center -mb-8">
        <SOSButton userId={userId} />
      </div>
    </div>
  );
}
