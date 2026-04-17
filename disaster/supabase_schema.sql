-- Run this in the Supabase Dashboard SQL Editor
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'volunteer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can select and update their own profile
CREATE POLICY "Users can manage their own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- Profiles: everyone authenticated can view profiles (to know who reported what)
CREATE POLICY "Anyone authenticated can view profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Auto-create a profile row when a new user signs up
-- This trigger runs as SECURITY DEFINER (superuser) so it
-- bypasses RLS and always succeeds, even before email confirm.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists, then create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create sos_alerts table
CREATE TABLE IF NOT EXISTS sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reporter_name TEXT,
  reporter_phone TEXT,
  disaster_type TEXT,
  description TEXT,
  anonymous_id TEXT
);

-- Enable RLS on sos_alerts
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

-- SOS Alerts: Anyone can create an alert (public)
CREATE POLICY "Public can create SOS alerts"
  ON sos_alerts FOR INSERT
  WITH CHECK (true);

-- SOS Alerts: Anyone can view active alerts (public)
CREATE POLICY "Anyone can view alerts"
  ON sos_alerts FOR SELECT
  USING (true);

-- SOS Alerts: Users can update their own alerts or anonymous alerts
CREATE POLICY "Users can update their own SOS alerts"
  ON sos_alerts FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Enable realtime for sos_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE sos_alerts;

-- ============================================================
-- Volunteer Profiles & Geospatial Setup
-- ============================================================

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create volunteer_profiles table
CREATE TABLE IF NOT EXISTS volunteer_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  skills TEXT[],
  transport_type TEXT,
  id_document_url TEXT,
  location GEOGRAPHY(POINT),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on volunteer_profiles
ALTER TABLE volunteer_profiles ENABLE ROW LEVEL SECURITY;

-- Volunteer Profiles Policies
CREATE POLICY "Volunteers can view their own profile"
  ON volunteer_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Volunteers can insert their own profile"
  ON volunteer_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all volunteer profiles"
  ON volunteer_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all volunteer profiles"
  ON volunteer_profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RPC for finding nearby volunteers
CREATE OR REPLACE FUNCTION get_nearby_volunteers(
  query_lat DOUBLE PRECISION,
  query_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  skills TEXT[],
  transport_type TEXT,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vp.id,
    p.name,
    p.phone,
    vp.skills,
    vp.transport_type,
    ST_Distance(vp.location, ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography) AS distance_meters
  FROM volunteer_profiles vp
  JOIN profiles p ON p.id = vp.id
  WHERE vp.status = 'approved'
    AND ST_DWithin(
      vp.location, 
      ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography, 
      radius_meters
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Storage Policies for Volunteer Documents
-- ============================================================

-- Allow authenticated users to upload their own documents
CREATE POLICY "Allow authenticated users to upload ID documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'volunteer-docs' AND
  (storage.foldername(name))[1] = 'id-docs'
);

-- Allow admins to view all volunteer documents
CREATE POLICY "Allow admins to view all volunteer documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'volunteer-docs' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow users to view their own documents
CREATE POLICY "Allow users to view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'volunteer-docs' AND
  (storage.foldername(name))[1] = 'id-docs' AND
  name LIKE 'id-docs/' || auth.uid()::text || '%'
);

-- ============================================================
-- Push Subscriptions for Web Push Notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Allow authenticated users to read all (needed by notify API via SECURITY DEFINER or service role)
CREATE POLICY "Authenticated users can view push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Volunteer Pings Log
-- ============================================================

CREATE TABLE IF NOT EXISTS volunteer_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  disaster_type TEXT,
  sender_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE volunteer_pings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert pings
CREATE POLICY "Authenticated users can create pings"
  ON volunteer_pings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own received pings
CREATE POLICY "Users can view their own pings"
  ON volunteer_pings FOR SELECT
  USING (auth.uid() = volunteer_id);

-- ============================================================
-- RPC for fetching push subscriptions by user IDs
-- SECURITY DEFINER so it works even when called by anon/unauthenticated
-- (needed by /api/volunteers/notify for anonymous SOS)
-- ============================================================
CREATE OR REPLACE FUNCTION get_push_subscriptions_for_users(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  user_id UUID,
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth
  FROM push_subscriptions ps
  WHERE ps.user_id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
