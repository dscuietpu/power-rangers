'use client';

import { useLocationStore } from '@/store/useLocationStore';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';

interface Props {
  userId?: string;
}

const AUTO_CLOSE_SECONDS = 10;

export default function EmergencyDetailsModal({ userId }: Props) {
  const { 
    isEmergencyModalOpen, 
    setIsEmergencyModalOpen,
    emergencyName,
    setEmergencyName,
    emergencyPhone,
    setEmergencyPhone,
    setCurrentLocation,
    sosAlerts,
    removeSOSAlert,
    anonymousId
  } = useLocationStore();
  
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const [userInteracted, setUserInteracted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Execute SOS with given details
  const executeSOS = useCallback(async (name?: string, phone?: string) => {
    setIsSending(true);
    setStatusMsg('');

    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      setCurrentLocation(lat, lng);

      const payload: any = {
        lat,
        lng,
        status: 'active'
      };
      
      if (userId) {
        payload.user_id = userId;
      } else {
        payload.anonymous_id = anonymousId;
        if (name) payload.reporter_name = name;
        if (phone) payload.reporter_phone = phone;
      }

      const { error } = await supabase.from('sos_alerts').insert(payload);

      if (error) {
        console.error("SOS Insert Error:", error);
        setStatusMsg('Failed to send SOS.');
        setIsSending(false);
      } else {
        setStatusMsg('SOS Sent!');
        setEmergencyName('');
        setEmergencyPhone('');

        // Notify nearby volunteers via push notification + siren
        fetch('/api/volunteers/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            disasterType: 'SOS Emergency',
            senderName: name || 'Anonymous',
          }),
        }).catch((err) => console.warn('Push notify failed:', err));
        
        setTimeout(() => {
          setIsEmergencyModalOpen(false);
          setIsSending(false);
          setStatusMsg('');
        }, 1500);
      }
    } catch (err) {
      console.error("Geolocation error:", err);
      setStatusMsg('Location denied. Use HTTPS or enable GPS.');
      setIsSending(false);
    }
  }, [userId, anonymousId, setCurrentLocation, setEmergencyName, setEmergencyPhone, setIsEmergencyModalOpen, supabase]);

  // Auto-close: send anonymous SOS after countdown
  const handleAutoClose = useCallback(() => {
    executeSOS('Anonymous');
  }, [executeSOS]);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Start/restart the auto-close timer
  const startTimer = useCallback(() => {
    clearTimers();
    setCountdown(AUTO_CLOSE_SECONDS);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    timerRef.current = setTimeout(() => {
      clearTimers();
      handleAutoClose();
    }, AUTO_CLOSE_SECONDS * 1000);
  }, [clearTimers, handleAutoClose]);

  // Handle any user interaction — pause the auto-close
  const handleInteraction = useCallback(() => {
    if (!userInteracted) {
      setUserInteracted(true);
      clearTimers();
    }
  }, [userInteracted, clearTimers]);

  // Start timer when modal opens, clean up when it closes
  useEffect(() => {
    if (isEmergencyModalOpen) {
      setUserInteracted(false);
      setCountdown(AUTO_CLOSE_SECONDS);
      startTimer();
    } else {
      clearTimers();
    }

    return () => clearTimers();
  }, [isEmergencyModalOpen]); // intentionally omitting startTimer/clearTimers to avoid restart loops

  if (!isEmergencyModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 relative overflow-hidden"
        onClick={handleInteraction}
        onKeyDown={handleInteraction}
        onTouchStart={handleInteraction}
      >
        {/* Auto-close countdown bar */}
        {!userInteracted && !isSending && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
            <div 
              className="h-full bg-red-500 transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / AUTO_CLOSE_SECONDS) * 100}%` }}
            />
          </div>
        )}

        <h2 className="text-xl font-bold text-white mb-2 text-center text-red-500">Emergency Details</h2>
        
        {/* Auto-close notice */}
        {!userInteracted && !isSending && (
          <p className="text-amber-400 text-xs mb-2 text-center font-medium animate-pulse">
            ⚠ Auto-sending as Anonymous in {countdown}s — interact to stop
          </p>
        )}

        <p className="text-slate-300 text-sm mb-4 text-center">
          You are not logged in. Please provide your details to help rescuers identify you.
        </p>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          handleInteraction(); // stop timer on submit
          executeSOS(emergencyName, emergencyPhone);
        }} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
            <input 
              type="text" 
              value={emergencyName}
              onFocus={handleInteraction}
              onChange={e => { handleInteraction(); setEmergencyName(e.target.value); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
            <input 
              type="tel" 
              value={emergencyPhone}
              onFocus={handleInteraction}
              onChange={e => { handleInteraction(); setEmergencyPhone(e.target.value); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="+1 234 567 8900"
            />
          </div>

          {statusMsg && (
            <p className={`text-sm font-medium ${statusMsg.includes('error') || statusMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400'} text-center px-2`}>
              {statusMsg}
            </p>
          )}
          
          <div className="flex gap-2 mt-2">
            <button 
              type="button"
              disabled={isSending}
              onClick={() => { handleInteraction(); setIsEmergencyModalOpen(false); }}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSending}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]"
            >
              {isSending ? 'Sending...' : 'Broadcast SOS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
