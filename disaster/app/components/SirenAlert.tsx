'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertTriangle, Volume2 } from 'lucide-react';

// Generates a siren sound using the Web Audio API
function playSiren(durationMs: number = 5000): { stop: () => void } {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();

  // Siren effect: oscillate frequency between 440Hz and 880Hz
  const interval = 150; // ms per step
  const steps = Math.ceil(durationMs / interval);
  let step = 0;
  let goingUp = true;

  const sirenInterval = setInterval(() => {
    step++;
    if (step >= steps) {
      clearInterval(sirenInterval);
      oscillator.stop();
      audioCtx.close();
      return;
    }

    const freq = goingUp
      ? 440 + ((step % 20) / 20) * 440
      : 880 - ((step % 20) / 20) * 440;

    if (step % 20 === 0) goingUp = !goingUp;

    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
  }, interval);

  const stop = () => {
    clearInterval(sirenInterval);
    try {
      oscillator.stop();
      audioCtx.close();
    } catch (e) { /* already stopped */ }
  };

  // Auto-stop after duration
  setTimeout(stop, durationMs);

  return { stop };
}

interface PingData {
  title: string;
  body: string;
  disasterType?: string;
  senderName?: string;
}

export default function SirenAlert() {
  const [pingData, setPingData] = useState<PingData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sirenRef = useRef<{ stop: () => void } | null>(null);

  const dismiss = useCallback(() => {
    if (sirenRef.current) {
      sirenRef.current.stop();
      sirenRef.current = null;
    }
    setIsVisible(false);
    setTimeout(() => setPingData(null), 300);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'DISASTER_PING') {
        const data = event.data.payload as PingData;
        setPingData(data);
        setIsVisible(true);

        // Play siren for 5 seconds
        if (sirenRef.current) sirenRef.current.stop();
        sirenRef.current = playSiren(5000);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }, []);

  if (!pingData) return null;

  return (
    <div
      className={`fixed inset-0 z-[500] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Pulsing red backdrop */}
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md animate-pulse" />

      {/* Alert card */}
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-red-500 rounded-2xl shadow-[0_0_60px_rgba(239,68,68,0.4)] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Animated top bar */}
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse" />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-600/30 border-2 border-red-500 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-red-400 tracking-tight">
                🚨 EMERGENCY ALERT
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Volume2 className="w-3 h-3 text-red-400 animate-pulse" />
                <span className="text-[11px] text-red-400/80 uppercase tracking-wider font-semibold">
                  Siren Active
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4 mb-5">
            <p className="text-white text-sm font-medium leading-relaxed">
              {pingData.body}
            </p>
            {pingData.disasterType && (
              <div className="mt-3 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-red-600/30 border border-red-500/40 rounded text-xs text-red-300 font-semibold uppercase">
                  {pingData.disasterType}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={dismiss}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4 inline mr-1" />
              Dismiss
            </button>
            <button
              onClick={dismiss}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-900/30"
            >
              🏃 I'm Responding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
