'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { MapPin, UploadCloud, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { subscribeToPush } from '@/utils/pushSubscription';
import { Geolocation } from '@capacitor/geolocation';

const SKILL_OPTIONS = [
  'Medical / First Aid',
  'Search & Rescue',
  'Heavy Machinery Operation',
  'Debris Clearing',
  'Food & Water Distribution',
  'Translation / Multilingual',
  'Shelter Management',
  'Evacuation Assistance'
];

const TRANSPORT_OPTIONS = [
  'None / Walking',
  'Bicycle',
  'Motorcycle',
  'Standard Car',
  '4x4 / Off-Road Vehicle',
  'Truck / Van',
  'Boat / Watercraft'
];

export default function RegisterVolunteerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [skills, setSkills] = useState<string[]>([]);
  const [transport, setTransport] = useState<string>('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to apply.');
        router.push('/login');
      } else {
        setUserId(user.id);
        // Check if already applied
        const { data } = await supabase.from('volunteer_profiles').select('status').eq('id', user.id).single();
        if (data) {
          toast.info(`Your application is currently: ${data.status}`);
          if (data.status === 'pending' || data.status === 'approved') {
            router.push('/');
          }
        }
      }
    }
    checkAuth();
  }, []);

  const toggleSkill = (skill: string) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter(s => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const handleGetLocation = async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success('Location captured successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Could not get your location. Please enable GPS.');
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    
    // Validate
    if (skills.length === 0) {
      toast.error('Please select at least one skill.');
      setStep(1); return;
    }
    if (!transport) {
      toast.error('Please select a transport type.');
      setStep(2); return;
    }
    if (!location) {
      toast.error('Please capture your home base location.');
      setStep(3); return;
    }
    if (!notificationsEnabled) {
      toast.error('Please enable notifications to receive disaster alerts.');
      setStep(5); return;
    }
    
    setIsSubmitting(true);
    
    let idDocUrl = '';
    
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `id-docs/${fileName}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('volunteer-docs')
        .upload(filePath, file);
        
      if (uploadError) {
        toast.error(`File upload failed: ${uploadError.message}`);
        setIsSubmitting(false);
        return;
      }
      
      // Get public URL (Assuming public bucket for now, or relying on signed URLs later)
      const { data: publicUrlData } = supabase.storage.from('volunteer-docs').getPublicUrl(filePath);
      idDocUrl = publicUrlData.publicUrl;
    }

    // Insert into volunteer_profiles
    // Note: ST_Point format is typically 'POINT(lon lat)', and geography constructor reads this.
    // PostGIS geography requires ST_Point(lon, lat).
    const { error: insertError } = await supabase
      .from('volunteer_profiles')
      .insert({
        id: userId,
        skills,
        transport_type: transport,
        id_document_url: idDocUrl,
        location: `POINT(${location.lng} ${location.lat})`
      });

    if (insertError) {
      toast.error(`Registration failed: ${insertError.message}`);
      setIsSubmitting(false);
    } else {
      // Subscribe to push notifications after successful registration
      await subscribeToPush();
      toast.success('Application submitted successfully! Redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  };

  if (!userId) {
    return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-blue-500" />
          <h2 className="mt-4 text-3xl font-extrabold text-white">
            Volunteer Application
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Join the elite response team. Step {step} of 5.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2.5 mb-8 overflow-hidden">
          <div 
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${(step / 5) * 100}%` }}
          ></div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-semibold mb-4 text-white">What are your primary skills?</h3>
              <p className="text-sm text-slate-400 mb-6">Select all that apply to help coordinators deploy you effectively.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SKILL_OPTIONS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`p-3 text-left rounded-lg border transition-all ${skills.includes(skill) ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-semibold mb-4 text-white">How will you travel?</h3>
              <p className="text-sm text-slate-400 mb-6">Select your primary mode of transportation during crisis response.</p>
              
              <div className="space-y-3">
                {TRANSPORT_OPTIONS.map(opt => (
                  <label key={opt} className={`flex items-center p-4 cursor-pointer rounded-lg border transition-all ${transport === opt ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                    <input 
                      type="radio" 
                      name="transport" 
                      value={opt}
                      checked={transport === opt}
                      onChange={(e) => setTransport(e.target.value)}
                      className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                    />
                    <span className={`ml-3 text-sm font-medium ${transport === opt ? 'text-blue-300' : 'text-slate-300'}`}>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-semibold mb-4 text-white">Set Home Base Location</h3>
              <p className="text-sm text-slate-400 mb-6">We use this to notify you of geographically relevant emergencies nearby.</p>
              
              <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 border border-slate-700 border-dashed rounded-xl">
                <MapPin className={`w-12 h-12 mb-4 ${location ? 'text-emerald-500' : 'text-slate-500'} transition-colors`} />
                {location ? (
                  <div className="text-center">
                    <p className="text-emerald-400 font-medium mb-1">Location Captured</p>
                    <p className="text-xs text-slate-500 font-mono">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                    <button onClick={handleGetLocation} className="mt-4 text-sm text-blue-400 hover:underline">Update Location</button>
                  </div>
                ) : (
                  <button 
                    onClick={handleGetLocation}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
                  >
                    Share Current Location
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-semibold mb-4 text-white">Identity Verification</h3>
              <p className="text-sm text-slate-400 mb-6">Upload a valid photo ID (Driver's License, Passport, etc.) to verify your identity. This will only be viewed by administrators.</p>
              
              <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 border border-slate-700 rounded-xl relative overflow-hidden group">
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                <UploadCloud className={`w-10 h-10 mb-3 ${file ? 'text-blue-500' : 'text-slate-500'} group-hover:scale-110 transition-all`} />
                <p className="text-sm font-medium text-slate-300 relative z-0">
                  {file ? file.name : (
                    <>
                      <span className="text-blue-400 underline">Click to upload</span> or drag and drop
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1 relative z-0">PNG, JPG, PDF up to 5MB</p>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-semibold mb-4 text-white">Enable Disaster Alerts</h3>
              <p className="text-sm text-slate-400 mb-6">As a volunteer, you must enable push notifications so we can alert you with a siren when someone nearby needs help.</p>
              
              <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 border border-slate-700 rounded-xl">
                <Bell className={`w-12 h-12 mb-4 ${notificationsEnabled ? 'text-emerald-500' : 'text-slate-500'} transition-colors`} />
                {notificationsEnabled ? (
                  <div className="text-center">
                    <p className="text-emerald-400 font-medium mb-1">Notifications Enabled ✓</p>
                    <p className="text-xs text-slate-500">You will receive disaster pings with a siren alert.</p>
                  </div>
                ) : (
                  <button 
                    onClick={async () => {
                      const result = await subscribeToPush();
                      if (result.success) {
                        setNotificationsEnabled(true);
                        toast.success('Notifications enabled! You will receive disaster alerts.');
                      } else {
                        toast.error(result.error || 'Failed to enable notifications.');
                      }
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
                  >
                    <Bell className="w-5 h-5" />
                    Allow Notifications
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
            {step > 1 ? (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div></div> // Empty div for flex spacing
            )}
            
            {step < 5 ? (
              <button 
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : step === 5 ? (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>Submit Application <CheckCircle2 className="w-4 h-4" /></>
                )}
              </button>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  );
}
