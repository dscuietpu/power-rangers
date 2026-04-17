'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLocationStore } from '@/store/useLocationStore';
import { Geolocation } from '@capacitor/geolocation';

interface Props {
  userId?: string;
}

export default function SOSButton({ userId }: Props) {
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    setCurrentLocation,
    sosAlerts,
    removeSOSAlert,
    anonymousId,
    initializeAnonymousId,
    setIsEmergencyModalOpen
  } = useLocationStore();
  const supabase = createClient();

  useEffect(() => {
    initializeAnonymousId();
  }, [initializeAnonymousId]);

  // Check if current user has an active SOS alert
  const activeAlert = sosAlerts.find(a =>
    a.status === 'active' &&
    (userId ? a.user_id === userId : (anonymousId && a.anonymous_id === anonymousId))
  );

  const handleSOSClick = () => {
    if (activeAlert) {
      cancelSOS();
      return;
    }

    if (userId) {
      // Logged in: no modal, execute immediately
      executeSOS();
    } else {
      // Logged out: show emergency details modal (global)
      setIsEmergencyModalOpen(true);
    }
  };

  const cancelSOS = async () => {
    if (!activeAlert) return;
    setIsCancelling(true);
    setStatusMsg('');

    const { error } = await supabase
      .from('sos_alerts')
      .update({ status: 'cancelled' })
      .eq('id', activeAlert.id);

    if (error) {
      console.error("Cancel SOS Error:", error);
      setStatusMsg('Failed to cancel SOS.');
    } else {
      setStatusMsg('SOS Cancelled.');
      removeSOSAlert(activeAlert.id); // Remove from local store map to immediately hide
      setTimeout(() => setStatusMsg(''), 3000);
    }
    setIsCancelling(false);
  };

  const executeSOS = async () => {
    setIsSending(true);
    setStatusMsg('');

    // Use the location already being tracked by Map.tsx's watchPosition
    const storeLocation = useLocationStore.getState().currentLocation;

    // Helper to send the SOS once we have coordinates
    const sendSOS = async (lat: number, lng: number) => {
      setCurrentLocation(lat, lng);

      // Cancel previous active alerts for this user/anonymousId
      if (userId) {
        await supabase.from('sos_alerts').update({ status: 'cancelled' }).eq('status', 'active').eq('user_id', userId);
      } else if (anonymousId) {
        await supabase.from('sos_alerts').update({ status: 'cancelled' }).eq('status', 'active').eq('anonymous_id', anonymousId);
      }

      // Cancel in local store
      const previousAlerts = sosAlerts.filter(a => a.status === 'active' && (userId ? a.user_id === userId : (anonymousId && a.anonymous_id === anonymousId)));
      previousAlerts.forEach(a => removeSOSAlert(a.id));

      const payload: any = {
        lat,
        lng,
        status: 'active'
      };
      
      if (userId) {
        payload.user_id = userId;
      } else {
        payload.anonymous_id = anonymousId;
      }

      const { error } = await supabase
        .from('sos_alerts')
        .insert(payload);

      if (error) {
        console.error("SOS Insert Error:", error);
        setStatusMsg('Failed to send SOS. Please try again!');
      } else {
        setStatusMsg('SOS Sent! Volunteers have been alerted.');
        // Notify all nearby volunteers via push notification + siren
        fetch('/api/volunteers/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            disasterType: 'SOS Emergency',
            senderName: 'SOS Alert',
          }),
        }).catch((err) => console.warn('Push notify failed:', err));
      }
      setIsSending(false);
    };

    if (storeLocation) {
      // Fast path: use the already-tracked location
      await sendSOS(storeLocation.lat, storeLocation.lng);
    } else {
      // Fallback: one-time fetch only if the store has no location at all
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
        await sendSOS(pos.coords.latitude, pos.coords.longitude);
      } catch (err) {
        console.error("Geolocation error:", err);
        setStatusMsg('Could not get location. Enable GPS or allow location access.');
        setIsSending(false);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center pb-8 mt-auto relative">
        <button
          onClick={handleSOSClick}
          disabled={isSending || isCancelling}
          className={`group relative flex items-center justify-center w-28 h-28 ${activeAlert ? 'bg-slate-700 hover:bg-slate-600 border-slate-500' : isSending ? 'bg-orange-600 border-orange-800' : 'bg-red-600 hover:bg-red-500 border-red-800'} text-white rounded-full font-bold shadow-2xl transition-all ${!isSending && !activeAlert ? 'animate-pulse hover:animate-none' : ''} border-4 focus:outline-none disabled:opacity-80`}
        >
          {!isSending && !activeAlert && <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 group-hover:animate-ping"></span>}
          {isCancelling ? '...' : isSending ? '...' : activeAlert ? 'Cancel SOS' : 'SOS'}
        </button>
        {statusMsg && (
          <p className={`mt-4 text-sm font-medium ${statusMsg.includes('error') || statusMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400'} text-center px-2`}>
            {statusMsg}
          </p>
        )}
      </div>
    </>
  );
}
