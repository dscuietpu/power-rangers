import { create } from 'zustand';

export interface SOSAlert {
  id: string;
  user_id: string | null;
  lat: number;
  lng: number;
  status: 'active' | 'resolved' | 'cancelled';
  created_at: string;
  reporter_name?: string | null;
  reporter_phone?: string | null;
  anonymous_id?: string | null;
  disaster_type?: string | null;
  description?: string | null;
  profiles?: {
    name: string | null;
    phone: string | null;
  } | null;
}

interface LocationState {
  currentLocation: { lat: number; lng: number } | null;
  setCurrentLocation: (lat: number, lng: number) => void;
  initializeLocation: () => void;
  sosAlerts: SOSAlert[];
  setSOSAlerts: (alerts: SOSAlert[]) => void;
  addSOSAlert: (alert: SOSAlert) => void;
  removeSOSAlert: (id: string) => void;
  isPickingLocation: boolean;
  setIsPickingLocation: (val: boolean) => void;
  pickedLocation: { lat: number; lng: number } | null;
  setPickedLocation: (lat: number, lng: number) => void;
  clearPickedLocation: () => void;
  anonymousId: string | null;
  initializeAnonymousId: () => void;
  isReportModalOpen: boolean;
  setIsReportModalOpen: (val: boolean) => void;
  isMapFullscreen: boolean;
  setIsMapFullscreen: (val: boolean) => void;
  isEmergencyModalOpen: boolean;
  setIsEmergencyModalOpen: (val: boolean) => void;
  emergencyName: string;
  setEmergencyName: (val: string) => void;
  emergencyPhone: string;
  setEmergencyPhone: (val: string) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  setCurrentLocation: (lat, lng) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('technovate_last_location', JSON.stringify({ lat, lng }));
    }
    set({ currentLocation: { lat, lng } });
  },
  initializeLocation: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('technovate_last_location');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          set({ currentLocation: parsed });
        }
      } catch (e) {
        console.error('Failed to parse stored location', e);
      }
    }
  },
  sosAlerts: [],
  setSOSAlerts: (alerts) => set({ sosAlerts: alerts }),
  addSOSAlert: (alert) => set((state) => ({ 
    // Prevent duplicates if already present
    sosAlerts: state.sosAlerts.some(a => a.id === alert.id) 
      ? state.sosAlerts 
      : [...state.sosAlerts, alert] 
  })),
  removeSOSAlert: (id) => set((state) => ({
    sosAlerts: state.sosAlerts.filter(a => a.id !== id)
  })),
  isPickingLocation: false,
  setIsPickingLocation: (val) => set({ isPickingLocation: val }),
  pickedLocation: null,
  setPickedLocation: (lat, lng) => set({ pickedLocation: { lat, lng } }),
  clearPickedLocation: () => set({ pickedLocation: null }),
  anonymousId: null,
  initializeAnonymousId: () => {
    if (typeof window === 'undefined') return;
    let storedId = localStorage.getItem('technovate_anon_id');
    if (!storedId) {
      storedId = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('technovate_anon_id', storedId);
    }
    set({ anonymousId: storedId });
  },
  isReportModalOpen: false,
  setIsReportModalOpen: (val) => set({ isReportModalOpen: val }),
  isMapFullscreen: false,
  setIsMapFullscreen: (val) => set({ isMapFullscreen: val }),
  isEmergencyModalOpen: false,
  setIsEmergencyModalOpen: (val) => set({ isEmergencyModalOpen: val }),
  emergencyName: '',
  setEmergencyName: (val) => set({ emergencyName: val }),
  emergencyPhone: '',
  setEmergencyPhone: (val) => set({ emergencyPhone: val }),
}));
