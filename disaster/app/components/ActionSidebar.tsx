'use client';

import { useState, useEffect } from 'react';
import { Megaphone, AlertTriangle, MapPin } from 'lucide-react';
import { useLocationStore } from '@/store/useLocationStore';
import { createClient } from '@/utils/supabase/client';

interface Props {
  userId?: string;
}

export default function ActionSidebar({ userId }: Props) {
  const supabase = createClient();
  const {
    currentLocation,
    sosAlerts,
    removeSOSAlert,
    anonymousId,
    setIsReportModalOpen
  } = useLocationStore();

  // --- Haversine Distance helper ---
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Nearby alerts
  const nearbyAlerts = currentLocation
    ? sosAlerts.filter(a => a.status === 'active' && getDistance(currentLocation.lat, currentLocation.lng, a.lat, a.lng) <= 5.0)
    : [];

  // My pins
  const myPins = sosAlerts.filter(a =>
    a.status === 'active' &&
    (userId ? a.user_id === userId : (anonymousId && a.anonymous_id === anonymousId))
  );

  const handleDismissPin = async (id: string) => {
    const { error } = await supabase.from('sos_alerts').update({ status: 'cancelled' }).eq('id', id);
    if (!error) removeSOSAlert(id);
  };


  return (
    <>
      <div className="space-y-4 mb-6">
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left font-medium transition-all focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <Megaphone className="w-5 h-5 text-blue-400" />
          Report a New Disaster
        </button>
      </div>

      {nearbyAlerts.length > 0 && (
        <div className="mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 shrink-0">Nearby Disasters (5km)</h3>
          <ul className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {nearbyAlerts.map(a => {
              const d = currentLocation ? getDistance(currentLocation.lat, currentLocation.lng, a.lat, a.lng).toFixed(1) : '?';
              return (
                <li key={a.id} className="text-sm bg-slate-900/80 p-2 rounded border border-slate-700 flex justify-between items-center shadow-sm">
                  <span className="font-medium text-slate-200">{a.disaster_type || 'SOS Alert'}</span>
                  <span className="text-orange-400 font-mono text-xs">{d} km</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {myPins.length > 0 && (
        <div className="mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 shrink-0">My Reported Pins</h3>
          <ul className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {myPins.map(a => (
              <li key={a.id} className="text-sm bg-slate-900/80 p-2 rounded border border-emerald-900/50 flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-medium text-slate-200">{a.disaster_type || 'SOS Alert'}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[120px]">{new Date(a.created_at).toLocaleTimeString()}</div>
                </div>
                <button
                  onClick={() => handleDismissPin(a.id)}
                  className="px-2 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-200 rounded text-xs transition-colors"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

    </>
  );
}
