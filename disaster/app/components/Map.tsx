'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useLocationStore } from '@/store/useLocationStore';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { getDisasterMarkerIcon } from './utils/disasterMarkers';

import { Maximize, Minimize, LocateFixed } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Fix for default Leaflet icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

// Custom pulsing red marker for SOS alerts
const sosIcon = new L.DivIcon({
  className: 'custom-sos-icon',
  html: `<div class="w-6 h-6 bg-red-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] sos-marker-pulse"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// A standard blue marker for the user's location
const userIcon = new L.DivIcon({
  className: 'custom-user-icon',
  html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// An orange marker for picked locations
const pickedIcon = new L.DivIcon({
  className: 'custom-picked-icon',
  html: `<div class="w-6 h-6 bg-orange-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-bounce"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function LocationUpdater() {
  const { currentLocation } = useLocationStore();
  const map = useMap();

  useEffect(() => {
    if (currentLocation) {
      map.flyTo([currentLocation.lat, currentLocation.lng], 14);
    }
  }, [currentLocation, map]);

  return null;
}

function MapEventsHandler() {
  const { isPickingLocation, setIsPickingLocation, setPickedLocation } = useLocationStore();

  useMapEvents({
    click(e) {
      if (isPickingLocation) {
        setPickedLocation(e.latlng.lat, e.latlng.lng);
        setIsPickingLocation(false);
      }
    }
  });

  return null;
}

function RecenterControl() {
  const { currentLocation } = useLocationStore();
  const map = useMap();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (currentLocation) {
          map.flyTo([currentLocation.lat, currentLocation.lng], 15, { animate: true });
        }
      }}
      title="Locate Me"
      className="absolute bottom-6 right-4 z-[400] p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 active:scale-95 border-2 border-emerald-400/50 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white"
    >
      <LocateFixed className="w-6 h-6" />
    </button>
  );
}

interface MapProps {
  isVolunteer: boolean;
}

export default function Map({ isVolunteer }: MapProps) {
  const { currentLocation, setCurrentLocation, initializeLocation, anonymousId, sosAlerts, setSOSAlerts, addSOSAlert, pickedLocation, isMapFullscreen, setIsMapFullscreen } = useLocationStore();
  const supabase = createClient();

  const watchIdRef = useRef<any>(null);

  useEffect(() => {
    // 1. Initialize from localStorage for instant map render
    initializeLocation();

    // 2. Shared handler for position updates (10m throttling + SOS sync)
    const handlePosition = async (pos: GeolocationPosition) => {
      const newLat = pos.coords.latitude;
      const newLng = pos.coords.longitude;

      const currentState = useLocationStore.getState();
      const prevLoc = currentState.currentLocation;

      // Only update if moved > 10m (or first fix)
      let shouldUpdate = true;
      if (prevLoc) {
        const distance = L.latLng(prevLoc.lat, prevLoc.lng).distanceTo(L.latLng(newLat, newLng));
        if (distance < 10) {
          shouldUpdate = false;
        }
      }

      if (shouldUpdate) {
        setCurrentLocation(newLat, newLng);

        // Sync to supabase ONLY if user has an active SOS
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;

          const hasActiveSOS = currentState.sosAlerts.some(alert =>
            alert.status === 'active' &&
            ((userId && alert.user_id === userId) || (currentState.anonymousId && alert.anonymous_id === currentState.anonymousId))
          );

          if (hasActiveSOS) {
            console.log('Attempting DB Update for SOS location:', { lat: newLat, lng: newLng });
            let query = supabase.from('sos_alerts').update({ lat: newLat, lng: newLng });
            if (userId) {
              query = query.eq('user_id', userId).eq('status', 'active');
            } else if (currentState.anonymousId) {
              query = query.eq('anonymous_id', currentState.anonymousId).eq('status', 'active');
            }
            const { error } = await query;
            if (error) console.error('Error updating SOS location:', error);
          }
        } catch (e) {
          // Don't let sync failures break location tracking
          console.warn('SOS sync failed, will retry on next update:', e);
        }
      }
    };

    // 3. Start watching — use permissive settings so it works on HTTP dev & poor GPS
    const startWatch = async () => {
      try {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 },
          (pos, err) => {
            if (err) {
              console.warn('Geolocation watch error:', err);
              return;
            }
            if (pos) handlePosition(pos as any);
          }
        );
        watchIdRef.current = id;
      } catch (e) {
        console.warn('Failed to start geolocation watch:', e);
      }
    };
    startWatch();

    // 2. Fetch existing active SOS alerts
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('sos_alerts')
        .select(`
          *,
          profiles(name, phone)
        `)
        .eq('status', 'active');

      if (data) {
        setSOSAlerts(data as any);
      }
    };
    fetchAlerts();

    // Re-fetch alerts when user returns to tab (browser throttles background tabs,
    // causing the WebSocket heartbeat to drop and Supabase to close the connection)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible again — re-syncing alerts & reconnecting Realtime...');
        fetchAlerts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Subscribe to real-time new SOS alerts
    // IMPORTANT: Use unique channel name to prevent Strict Mode WebSocket race conditions
    const channelName = `sos_alerts_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts' },
        async (payload) => {
          console.log('Realtime INSERT received:', payload);
          const newAlert = payload.new as any;
          if (newAlert.status === 'active') {
            // Immediately fetch the profile for this user
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, phone')
              .eq('id', newAlert.user_id)
              .single();

            const alertWithProfile = {
              ...newAlert,
              profiles: profile || null
            };

            addSOSAlert(alertWithProfile);

            if (profile?.name) {
              toast.error(`SOS Alert from ${profile.name}!`, {
                description: 'A new emergency pin has been dropped on the map.',
                duration: 10000,
              });
            } else {
              toast.error(`New SOS Alert!`, {
                description: 'A new emergency pin has been dropped on the map.',
                duration: 10000,
              });
            }

            if (Capacitor.isNativePlatform()) {
              const msg = profile?.name ? `SOS Alert from ${profile.name}!` : 'New SOS Alert!';
              LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Math.random() * 100000),
                    title: 'Disaster Emergency!',
                    body: msg,
                    channelId: 'disaster_alerts',
                  }
                ]
              }).catch(err => console.error("Native notification failed:", err));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_alerts' },
        (payload) => {
          console.log('Realtime UPDATE received:', payload);
          const updatedAlert = payload.new as any;
          if (updatedAlert.status !== 'active') {
            useLocationStore.getState().removeSOSAlert(updatedAlert.id);
          }
        }
      )
      .subscribe(async (status, err) => {
        console.log(`Supabase Realtime Status changed to: ${status} [Channel: ${channelName}]`);
        
        if (status === 'TIMED_OUT') {
          console.error('Supabase Realtime Connection Timed Out. The server took too long to negotiate the socket connection.');
          toast.error('Map Connection Interrupted', { description: 'Reconnecting to emergency network...' });
        }
        
        if (status === 'CLOSED') {
          console.error('Supabase Realtime Connection Closed. usually happens when channel is manually removed or under heavy tab throttling.');
        }

        if (status === 'CHANNEL_ERROR') {
          console.error('Supabase Channel Error. Could be invalid permissions, RLS policies blocking the socket, or network drop. Details:', err);
          toast.error('Map Sync Error', { description: 'Lost connection to dispatcher. Refreshing...' });
        }

        if (err) {
          console.error('Supabase Subscribe Error Object Details:', JSON.stringify(err, null, 2));
        }
      });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({ id: watchIdRef.current as unknown as string }).catch(console.error);
        watchIdRef.current = null;
      }
    };
  }, [initializeLocation, setCurrentLocation, supabase]);

  const center = currentLocation
    ? [currentLocation.lat, currentLocation.lng] as L.LatLngTuple
    : [0, 0] as L.LatLngTuple;

  return (
    <div className={`w-full h-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden relative shadow-inner ${isMapFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''}`}>

      {/* Fullscreen Toggle Button (Mobile Only) */}
      <button
        onClick={() => setIsMapFullscreen(!isMapFullscreen)}
        className="md:hidden absolute top-4 right-4 z-[400] p-2 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
      >
        {isMapFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>

      <MapContainer
        center={center}
        zoom={currentLocation ? 14 : 2}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationUpdater />
        <MapEventsHandler />
        <RecenterControl />

        {currentLocation && (
          <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {pickedLocation && (
          <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickedIcon}>
            <Popup>Selected Drop Location</Popup>
          </Marker>
        )}

        {sosAlerts.map((alert) => {
          // SOS alerts (no disaster_type) keep the blinking red pin.
          // Disaster reports get a type-specific icon pin.
          const isSOS = !alert.disaster_type;
          const markerIcon = isSOS ? sosIcon : getDisasterMarkerIcon(alert.disaster_type!);

          return (
            <Marker key={alert.id} position={[alert.lat, alert.lng]} icon={markerIcon}>
              <Popup>
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <strong className={`text-base border-b border-gray-200 pb-1 mb-1 ${isSOS ? 'text-red-600' : 'text-orange-600'}`}>
                    {isSOS ? '🚨 SOS Alert!' : `⚠️ ${alert.disaster_type}`}
                  </strong>
                  <div className="text-sm">
                    {isVolunteer ? (
                      <>
                        <p className="mb-1 text-slate-900"><strong className="text-slate-700">Name:</strong> {alert.profiles?.name || alert.reporter_name || 'Unknown'}</p>
                        <p className="mb-1 text-slate-900"><strong className="text-slate-700">Phone:</strong> {alert.profiles?.phone || alert.reporter_phone || 'N/A'}</p>
                      </>
                    ) : (
                      <p className="text-slate-900 italic mb-2">{isSOS ? 'Emergency Reported' : alert.description || 'Disaster Reported'}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-2 bg-slate-100 p-1 rounded inline-block text-center w-full shadow-sm">
                      Time: {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${alert.lat},${alert.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow transition-colors no-underline"
                      style={{ textDecoration: 'none', color: 'white' }}
                    >
                      🧭 Get Directions
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
