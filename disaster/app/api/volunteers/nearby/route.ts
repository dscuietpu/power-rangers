import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '10000'; // Default 10km (in meters)

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng parameters are required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Call the PostGIS RPC function created in the schema
  const { data, error } = await supabase.rpc('get_nearby_volunteers', {
    query_lat: parseFloat(lat),
    query_lng: parseFloat(lng),
    radius_meters: parseFloat(radius)
  });

  if (error) {
    console.error('RPC Error:', error);
    return NextResponse.json({ error: 'Failed to fetch nearby volunteers', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ volunteers: data });
}
