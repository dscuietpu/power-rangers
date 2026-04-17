import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  'mailto:admin@powerrangers.dev',
  vapidPublicKey,
  vapidPrivateKey
);

// Use a direct Supabase client (NOT the cookie-based SSR one) so that
// SECURITY DEFINER RPCs work even when the caller is anonymous/unauthenticated.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export async function POST(request: Request) {
  let body: { lat: number; lng: number; disasterType?: string; senderName?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { lat, lng, disasterType, senderName } = body;

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  // 1. Find approved volunteers within 10km using SECURITY DEFINER RPC
  const { data: nearbyVolunteers, error: rpcError } = await supabase.rpc('get_nearby_volunteers', {
    query_lat: lat,
    query_lng: lng,
    radius_meters: 10000, // 10km
  });

  if (rpcError) {
    console.error('RPC error:', rpcError);
    return NextResponse.json({ error: 'Failed to find nearby volunteers' }, { status: 500 });
  }

  if (!nearbyVolunteers || nearbyVolunteers.length === 0) {
    console.log('Notify: No nearby volunteers found for coords:', { lat, lng });
    return NextResponse.json({ notified: 0, message: 'No volunteers nearby' });
  }

  console.log(`Notify: Found ${nearbyVolunteers.length} nearby volunteers`);

  // 2. Get push subscriptions for these volunteers using SECURITY DEFINER RPC
  const volunteerIds = nearbyVolunteers.map((v: any) => v.id);

  const { data: subscriptions, error: subError } = await supabase.rpc('get_push_subscriptions_for_users', {
    user_ids: volunteerIds,
  });

  if (subError) {
    console.error('Subscription fetch error:', subError);
    
    // Fallback: try direct query (will work if caller IS authenticated)
    console.log('Falling back to direct push_subscriptions query...');
    const { data: fallbackSubs, error: fallbackErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', volunteerIds);
    
    if (fallbackErr || !fallbackSubs || fallbackSubs.length === 0) {
      console.error('Fallback also failed:', fallbackErr);
      return NextResponse.json({ notified: 0, message: 'Could not fetch subscriptions', rpcError: subError.message });
    }
    
    // Use fallback subs
    return await sendPushNotifications(fallbackSubs, disasterType, senderName);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('Notify: No push subscriptions found for volunteers:', volunteerIds);
    return NextResponse.json({ notified: 0, message: 'No subscribers found among nearby volunteers' });
  }

  console.log(`Notify: Found ${subscriptions.length} push subscriptions, sending...`);
  return await sendPushNotifications(subscriptions, disasterType, senderName);
}

async function sendPushNotifications(subscriptions: any[], disasterType?: string, senderName?: string) {
  const disaster = disasterType || 'Emergency';
  const sender = senderName || 'Someone nearby';

  const payload = JSON.stringify({
    title: '🚨 DISASTER PING — URGENT',
    body: `${sender} needs help! Type: ${disaster}. You are within 5km. Respond ASAP!`,
    type: 'disaster_ping',
    disasterType: disaster,
    senderName: sender,
    // Android: use the custom notification channel with siren sound
    android_channel_id: 'disaster_alerts',
  });

  let successCount = 0;
  let failCount = 0;

  const pushPromises = subscriptions.map(async (sub: any) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, payload);
      successCount++;
    } catch (err: any) {
      console.error(`Push failed for ${sub.user_id}:`, err.statusCode, err.body);
      failCount++;

      // If subscription is expired/invalid (410 Gone or 404), remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id);
      }
    }
  });

  await Promise.all(pushPromises);

  return NextResponse.json({
    notified: successCount,
    failed: failCount,
    total: subscriptions.length,
  });
}

