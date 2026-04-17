import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { subscription: any };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { subscription } = body;
  if (!subscription || !subscription.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
  }

  // Upsert: delete old subscriptions for this user, then insert new one
  // This ensures one active subscription per user (they may re-subscribe)
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('push_subscriptions')
    .insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
    });

  if (error) {
    console.error('Push subscription save error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
