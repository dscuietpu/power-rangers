'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

const DynamicMap = dynamic(() => import('./Map'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-2xl relative shadow-inner">
      <MapPin className="w-12 h-12 text-blue-500 mb-3 animate-bounce shadow-xl" />
      <p className="text-slate-300 font-medium text-lg">Loading Interactive Map...</p>
    </div>
  )
});

interface Props {
  isVolunteer: boolean;
}

export default function MapWrapper({ isVolunteer }: Props) {
  return <DynamicMap isVolunteer={isVolunteer} />;
}
