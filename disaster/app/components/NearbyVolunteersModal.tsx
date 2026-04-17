'use client';

import { useState, useEffect } from 'react';
import { X, Users, MapPin, Loader2, Car, Wrench, Phone, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';

interface Volunteer {
  id: string;
  name: string;
  phone: string;
  skills: string[];
  transport_type: string;
  distance_meters: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

export default function NearbyVolunteersModal({ isOpen, onClose, userName }: Props) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pingingIds, setPingingIds] = useState<Set<string>>(new Set());
  const [pingedIds, setPingedIds] = useState<Set<string>>(new Set());

  const fetchVolunteers = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/volunteers/nearby?lat=${lat}&lng=${lng}&radius=10000`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch volunteers');
        setVolunteers([]);
      } else {
        setVolunteers(data.volunteers || []);
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please try again.');
      setVolunteers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Reset pinged state when reopening
    setPingedIds(new Set());

    // Try stored location first
    const stored = localStorage.getItem('technovate_last_location');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.lat && parsed?.lng) {
          setUserLocation(parsed);
          fetchVolunteers(parsed.lat, parsed.lng);
          return;
        }
      } catch (e) { /* ignore */ }
    }

    // Fallback to geolocation
    const locate = async () => {
      try {
        setLoading(true);
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        fetchVolunteers(loc.lat, loc.lng);
      } catch (err) {
        setError('Could not get your location. Please enable GPS.');
        setLoading(false);
      }
    };
    locate();
  }, [isOpen]);

  const handleRefresh = () => {
    if (userLocation) {
      fetchVolunteers(userLocation.lat, userLocation.lng);
    }
  };

  const handlePing = async (volunteer: Volunteer) => {
    const name = getName(volunteer);
    const phone = getPhone(volunteer);

    if (!phone) {
      toast.error(`${name} has no phone number on file.`);
      return;
    }

    // Confirm before sending
    const confirmed = window.confirm(
      `Send an urgent disaster ping SMS to ${name} (${phone})?\n\nThey will receive an alert asking them to respond immediately.`
    );
    if (!confirmed) return;

    setPingingIds((prev) => new Set(prev).add(volunteer.id));

    try {
      const res = await fetch('/api/volunteers/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId: volunteer.id,
          disasterType: 'Emergency',
          senderName: userName || 'A community member',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to ping volunteer.');
      } else {
        toast.success(`🚨 Ping sent to ${name}! SMS delivered.`);
        setPingedIds((prev) => new Set(prev).add(volunteer.id));

        // Also send push notifications to all nearby volunteers (5km)
        if (userLocation) {
          fetch('/api/volunteers/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: userLocation.lat,
              lng: userLocation.lng,
              disasterType: 'Emergency',
              senderName: userName || 'A community member',
            }),
          }).catch((err) => console.warn('Push notify failed (non-critical):', err));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Could not send ping.');
    } finally {
      setPingingIds((prev) => {
        const next = new Set(prev);
        next.delete(volunteer.id);
        return next;
      });
    }
  };

  if (!isOpen) return null;

  const getName = (v: Volunteer) => v.name || 'Volunteer';
  const getPhone = (v: Volunteer) => v.phone || null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Volunteers Nearby</h2>
              <p className="text-xs text-slate-400">Within 10 km radius &middot; Tap ⚡ to ping</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm text-slate-400">Finding volunteers near you...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <MapPin className="w-10 h-10 text-red-400/60" />
              <p className="text-sm text-red-400 font-medium">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && volunteers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <Users className="w-10 h-10 text-slate-600" />
              <p className="text-sm text-slate-400 font-medium">No volunteers found nearby</p>
              <p className="text-xs text-slate-500">There are no approved volunteers within 10 km of your current location.</p>
            </div>
          )}

          {!loading && !error && volunteers.length > 0 && (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold px-1">
                {volunteers.length} volunteer{volunteers.length !== 1 ? 's' : ''} found
              </p>
              {volunteers.map((v) => {
                const isPinging = pingingIds.has(v.id);
                const isPinged = pingedIds.has(v.id);

                return (
                  <div
                    key={v.id}
                    className={`bg-slate-800/60 border rounded-xl p-4 transition-all group ${isPinged ? 'border-emerald-600/40 bg-emerald-900/10' : 'border-slate-700/60 hover:border-slate-600'}`}
                  >
                    {/* Top row: name + distance */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm shrink-0">
                          {getName(v).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{getName(v)}</p>
                          {getPhone(v) && (
                            <a
                              href={`tel:${getPhone(v)}`}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5"
                            >
                              <Phone className="w-3 h-3" />
                              {getPhone(v)}
                            </a>
                          )}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-mono bg-slate-700/60 px-2 py-1 rounded-md text-orange-400 border border-slate-600/50 shrink-0">
                        <MapPin className="w-3 h-3" />
                        {v.distance_meters != null ? `${(v.distance_meters / 1000).toFixed(1)} km` : '—'}
                      </span>
                    </div>

                    {/* Skills */}
                    {v.skills && v.skills.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Wrench className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Skills</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {v.skills.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 bg-blue-900/25 text-blue-300 rounded text-[11px] border border-blue-800/40"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transport + Ping Button Row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/40">
                      {v.transport_type ? (
                        <div className="flex items-center gap-1.5">
                          <Car className="w-3 h-3 text-slate-500" />
                          <span className="text-[11px] text-slate-400">{v.transport_type}</span>
                        </div>
                      ) : (
                        <div />
                      )}

                      <button
                        onClick={() => handlePing(v)}
                        disabled={isPinging || isPinged}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                          isPinged
                            ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 cursor-default'
                            : isPinging
                            ? 'bg-amber-600/20 border border-amber-500/30 text-amber-300 cursor-wait'
                            : 'bg-red-600/80 hover:bg-red-500 border border-red-500/60 text-white hover:shadow-red-900/30 hover:shadow-md active:scale-95'
                        }`}
                      >
                        {isPinged ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Pinged
                          </>
                        ) : isPinging ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            Ping
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
