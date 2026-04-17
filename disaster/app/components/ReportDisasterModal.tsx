'use client';

import { useState, useRef } from 'react';
import { AlertTriangle, MapPin, Upload, X, ImageIcon } from 'lucide-react';
import { useLocationStore } from '@/store/useLocationStore';
import { createClient } from '@/utils/supabase/client';
import { Geolocation } from '@capacitor/geolocation';

interface Props {
  userId?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ReportDisasterModal({ userId }: Props) {
  const [disasterType, setDisasterType] = useState('Fire');
  const [description, setDescription] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [useMapPick, setUseMapPick] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const {
    currentLocation,
    setCurrentLocation,
    isReportModalOpen,
    setIsReportModalOpen,
    isPickingLocation,
    setIsPickingLocation,
    pickedLocation,
    anonymousId
  } = useLocationStore();
  const clearPickedLocation = useLocationStore(s => s.clearPickedLocation);

  const handlePickOnMapClick = () => {
    setIsPickingLocation(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setStatusMsg('Image must be less than 5MB.');
      return;
    }

    setImageFile(file);
    setStatusMsg('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImageToSupabase = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `disaster-reports/${fileName}`;

    const { error } = await supabase.storage
      .from('disaster-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('disaster-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const submitReportToDB = async (lat: number, lng: number, imageUrl?: string) => {
    // Cancel previous active alerts for this user/anonymousId
    if (userId) {
      await supabase.from('sos_alerts').update({ status: 'cancelled' }).eq('status', 'active').eq('user_id', userId);
    } else if (anonymousId) {
      await supabase.from('sos_alerts').update({ status: 'cancelled' }).eq('status', 'active').eq('anonymous_id', anonymousId);
    }

    const payload: any = {
      lat,
      lng,
      status: 'active',
      disaster_type: disasterType,
      description: description,
    };

    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    if (userId) {
      payload.user_id = userId;
    } else {
      payload.anonymous_id = anonymousId;
    }

    console.log('Final step: Attempting DB Insert with payload:', payload);
    const { error } = await supabase.from('sos_alerts').insert(payload);

    if (error) {
      console.error("Report Insert Error:", error);
      setStatusMsg('Failed to report. Please try again!');
    } else {
      setStatusMsg('Report successfully submitted!');
      // Notify all nearby volunteers via push notification + siren
      fetch('/api/volunteers/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          disasterType: disasterType,
          senderName: 'Disaster Report',
        }),
      }).catch((err) => console.warn('Push notify failed:', err));
      setTimeout(() => {
        setIsReportModalOpen(false);
        setDisasterType('Fire');
        setDescription('');
        setStatusMsg('');
        setUseMapPick(false);
        clearPickedLocation();
        removeImage();
      }, 2000);
    }
    setIsReporting(false);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      setStatusMsg('An image is required to report a disaster.');
      return;
    }

    setIsReporting(true);

    let uploadedImageUrl: string | undefined;

    // Step 1: Upload image if provided
    if (imageFile) {
      setStatusMsg('Uploading image...');
      const url = await uploadImageToSupabase(imageFile);
      if (!url) {
        setStatusMsg('Failed to upload image. Please try again.');
        setIsReporting(false);
        return;
      }
      uploadedImageUrl = url;

      // Step 2: Verify with Gemini
      setStatusMsg('Verifying disaster with AI...');
      try {
        const verifyRes = await fetch('/api/verify-disaster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: uploadedImageUrl,
            disasterType: disasterType,
          }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyData.success) {
          setStatusMsg(verifyData.message || 'Image verification failed.');
          setIsReporting(false);
          return;
        }

        setStatusMsg('Disaster verified! Submitting report...');
      } catch (err) {
        console.error('Verification error:', err);
        setStatusMsg('AI verification failed. Please try again.');
        setIsReporting(false);
        return;
      }
    }

    // Step 3: Get location and submit
    setStatusMsg('Locating...');

    if (useMapPick && pickedLocation) {
      await submitReportToDB(pickedLocation.lat, pickedLocation.lng, uploadedImageUrl);
    } else {
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLocation(lat, lng);
        await submitReportToDB(lat, lng, uploadedImageUrl);
      } catch (err) {
        console.error("Geolocation error:", err);
        setStatusMsg('Could not get precise location. Enable GPS or pick on map.');
        setIsReporting(false);
      }
    }
  };

  const disasterTypes = [
    'Fire', 'Earthquake', 'Building Collapse', 'Flood',
    'Medical Emergency', 'Biohazard/Chemical Spill', 'Traffic Accident', 'Other'
  ];

  if (!isReportModalOpen && !isPickingLocation) return null;

  return (
    <>
      {isPickingLocation && (
        <div className="fixed inset-x-0 bottom-6 z-[110] flex justify-center pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur border border-blue-500/50 px-6 py-3 rounded-full shadow-2xl text-white font-medium flex items-center gap-3 animate-bounce">
            <MapPin className="w-5 h-5 text-blue-400" />
            Click anywhere on the map to place your pin
          </div>
        </div>
      )}

      {isReportModalOpen && !isPickingLocation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-bold text-white">Report a Disaster</h2>
            </div>

            <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Disaster Type</label>
                <select
                  value={disasterType}
                  onChange={(e) => setDisasterType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {disasterTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the severity and specifics..."
                />
              </div>

              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Upload Disaster Image <span className="text-red-500">*</span>
                </label>

                {!imagePreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-red-500/50 hover:border-red-500 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-slate-800/50 hover:bg-slate-800"
                  >
                    <Upload className="w-8 h-8 text-slate-400" />
                    <p className="text-sm text-slate-400">Click to upload an image</p>
                    <p className="text-xs text-slate-500">Max 5MB • JPG, PNG, WEBP</p>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border border-slate-700">
                    <img
                      src={imagePreview}
                      alt="Disaster preview"
                      className="w-full h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full p-1 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-xs text-white px-2 py-1 rounded flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {imageFile?.name}
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <input
                  type="checkbox"
                  id="useMapPick"
                  checked={useMapPick}
                  onChange={(e) => setUseMapPick(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 bg-slate-700 border-slate-600"
                />
                <label htmlFor="useMapPick" className="text-sm font-medium text-slate-300 cursor-pointer">
                  Pick location on map
                </label>
                {useMapPick && (
                  <button
                    type="button"
                    onClick={handlePickOnMapClick}
                    className="ml-auto text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-2 py-1 rounded"
                  >
                    Select Pos
                  </button>
                )}
              </div>

              {statusMsg && (
                <p className={`text-sm font-medium ${statusMsg.includes('error') || statusMsg.includes('Failed') || statusMsg.includes('Could not') || statusMsg.includes('Not a valid') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {statusMsg}
                </p>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { clearPickedLocation(); setIsReportModalOpen(false); }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
